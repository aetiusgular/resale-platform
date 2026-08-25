/**
 * Seed script: creates a system profile, marks 24 founder accounts id-verified,
 * seeds 2 moderators (the ex-"verified checkers"; G10 gates Legit Check to
 * moderators), and creates a demo legit-check thread on the first active listing.
 *
 * Idempotent — safe to run multiple times (upserts everywhere).
 *
 * PRODUCTION GUARD:
 *   - Refuses to run if NODE_ENV === 'production'.
 *   - Requires --confirm flag explicitly.
 *   - Usage: pnpm tsx scripts/seed-founders.ts --confirm
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js'

// ─── Production guard ──────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('[seed] ERROR: refusing to run in production (NODE_ENV=production)')
  process.exit(1)
}
if (!process.argv.includes('--confirm')) {
  console.error('[seed] ERROR: must pass --confirm flag to run seed script')
  console.error('  Usage: pnpm tsx scripts/seed-founders.ts --confirm')
  process.exit(1)
}

const SYSTEM_USER_EMAIL  = 'system@resale-platform.internal'

// 24 alpha seed contacts from docs/USER_FEEDBACK.md §6.
// Two designated verified checkers (per B7 design) keep checker fields.
// All others: id_verified=true, bronze tier.
const FOUNDER_ACCOUNTS: Array<{
  username: string
  verified_checker?: boolean
  checker_category?: string
  moderator?: boolean
}> = [
  // Moderators (the ex-"verified checkers"; only moderators can post Legit Checks — G10)
  { username: 'formcheck',              verified_checker: true, checker_category: 'outerwear', moderator: true },
  { username: 'archivehound',           verified_checker: true, checker_category: 'denim',     moderator: true },
  // Alpha seed list (docs/USER_FEEDBACK.md §6)
  { username: 'tumuhclothes' },
  { username: 'buyselldm' },
  { username: 'marcosqrd' },
  { username: 'blindate' },
  { username: 'refffined' },
  { username: 'brokeclasps' },
  { username: 'shoprokuz' },
  { username: 'hedivietnam' },
  { username: 'fauhlen' },
  { username: 'secondstreetemployee' },
  { username: 'banreps' },
  { username: 'sznny' },
  { username: 'jadedarchivee' },
  { username: 'stevzn' },
  { username: 'cowboipunk' },
  { username: 'ummmmmm_j_i' },
  { username: 'fate_archive_' },
  { username: 'thrashhh' },
  { username: 'zizekcel' },
  { username: 'sparo_stocks' },
  { username: 'maximilian_marco' },
  { username: 'j_pierre' },
  { username: 'crownfoil' },
  // Extra fixture for demo LC thread
  { username: 'tabiwalker' },
]

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── 1. System user ────────────────────────────────────────────────────────
  let systemUserId: string | null = null
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingSystem = existingUsers?.users?.find((u) => u.email === SYSTEM_USER_EMAIL)

  if (existingSystem) {
    systemUserId = existingSystem.id
    console.log(`[seed] system user exists: ${systemUserId}`)
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: SYSTEM_USER_EMAIL,
      password: crypto.randomUUID(),
      email_confirm: true,
    })
    if (error || !newUser.user) throw new Error(`Failed to create system user: ${error?.message}`)
    systemUserId = newUser.user.id
    console.log(`[seed] created system user: ${systemUserId}`)
  }

  // ── 2. System profile ─────────────────────────────────────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles').select('id').eq('id', systemUserId).single()

  if (!existingProfile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: systemUserId, username: 'system', role: 'admin',
    })
    if (profileError && profileError.code !== '23505') {
      throw new Error(`Failed to create system profile: ${profileError.message}`)
    }
    console.log('[seed] created system profile')
  } else {
    console.log('[seed] system profile exists')
  }

  // ── 3. Founder accounts: id-verified ──────────────────────────────────────
  const fixtureIds: Record<string, string> = {}

  for (const founder of FOUNDER_ACCOUNTS) {
    const email = `founder+${founder.username}@example.com`
    let userId: string | null = null

    const existing = existingUsers?.users?.find((u) => u.email === email)
    if (existing) {
      userId = existing.id
      console.log(`[seed] founder exists: ${founder.username}`)
    } else {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
      })
      if (error || !newUser.user) {
        console.warn(`[seed] could not create ${founder.username}: ${error?.message}`)
        continue
      }
      userId = newUser.user.id
      console.log(`[seed] created: ${founder.username}`)
    }

    fixtureIds[founder.username] = userId

    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: userId,
      username: founder.username,
      role: 'member',
      id_verification_status: 'verified',
      verified_checker: founder.verified_checker ?? false,
      checker_category: founder.checker_category ?? null,
      tier: founder.verified_checker ? 'gold' : 'bronze',
      is_moderator: founder.moderator ?? false,
      moderator_since: founder.moderator ? new Date().toISOString() : null,
    }, { onConflict: 'id' })

    if (upsertErr) {
      console.warn(`[seed] upsert ${founder.username}: ${upsertErr.message}`)
    }
  }

  // ── 4. Demo LC thread on first active listing ──────────────────────────────
  const { data: activeListing } = await supabase
    .from('listings').select('id, title').eq('status', 'active')
    .order('created_at', { ascending: true }).limit(1).maybeSingle()

  if (!activeListing) {
    console.log('[seed] no active listings — skipping demo LC thread')
    console.log('[seed] done.')
    return
  }

  console.log(`[seed] demo LC thread on: ${activeListing.title} (${activeListing.id})`)

  const { data: existingComments } = await supabase
    .from('comments').select('id').eq('listing_id', activeListing.id).eq('thread_type', 'lc').limit(1)

  if (existingComments && existingComments.length > 0) {
    console.log('[seed] demo LC thread exists — skipping')
    console.log('[seed] done.')
    return
  }

  const formcheckId = fixtureIds['formcheck']
  if (formcheckId) {
    const { data: verdict, error: vErr } = await supabase.from('comments').insert({
      listing_id: activeListing.id, author_id: formcheckId, thread_type: 'lc',
      body: 'hardware, stitching, and tag are consistent with authentic.',
      pinned: true, status: 'visible', redacted: false,
    }).select('id').single()
    if (vErr) console.warn(`[seed] pinned verdict: ${vErr.message}`)
    else console.log(`[seed] pinned verdict: ${verdict.id}`)
  }

  // Second moderator (archivehound) weighs in — LC is moderators-only (G10).
  const archiveId = fixtureIds['archivehound']
  if (archiveId) {
    for (const body of [
      'seams and bar tacks match my 2004 run. zipper pull font is right.',
      'asked for a macro of the care tag — seller delivered, checks out.',
    ]) {
      const { error: lcErr } = await supabase.from('comments').insert({
        listing_id: activeListing.id, author_id: archiveId, thread_type: 'lc',
        body, pinned: false, status: 'visible', redacted: false,
      })
      if (lcErr) console.warn(`[seed] LC comment: ${lcErr.message}`)
      else console.log('[seed] inserted LC comment by archivehound')
    }
  }

  console.log('[seed] done.')
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message)
  process.exit(1)
})
