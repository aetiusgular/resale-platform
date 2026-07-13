/**
 * Seed script: creates a system profile, 30 founder invite codes,
 * marks founder fixture accounts id-verified, seeds 2 verified checkers,
 * and creates a demo legit-check thread on the first active listing.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   export SUPABASE_DB_PASSWORD=...
 *   pnpm tsx scripts/seed-founders.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js'
import { generateCode } from '../lib/invite-codes'

const SYSTEM_USER_EMAIL  = 'system@resale-platform.internal'
const FOUNDER_CODE_COUNT = 30

// Fixture accounts: id-verified, optional verified_checker
const FOUNDER_FIXTURES = [
  { email: 'founder1@resale-platform.internal', username: 'formcheck',   verified_checker: true,  checker_category: 'outerwear' },
  { email: 'founder2@resale-platform.internal', username: 'archivehound', verified_checker: true, checker_category: 'denim' },
  { email: 'founder3@resale-platform.internal', username: 'tabiwalker',  verified_checker: false, checker_category: null },
] as const

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
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
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

  // ── 3. Founder invite codes ───────────────────────────────────────────────
  const { count: existingCount } = await supabase
    .from('invite_codes').select('code', { count: 'exact', head: true }).eq('generated_by', systemUserId)

  const needed = FOUNDER_CODE_COUNT - (existingCount ?? 0)
  if (needed > 0) {
    console.log(`[seed] generating ${needed} founder codes…`)
    const codesToInsert: { code: string; generated_by: string }[] = []
    const seen = new Set<string>()
    const { data: allCodes } = await supabase.from('invite_codes').select('code')
    for (const row of allCodes ?? []) seen.add(row.code)

    while (codesToInsert.length < needed) {
      const code = generateCode()
      if (!seen.has(code)) { seen.add(code); codesToInsert.push({ code, generated_by: systemUserId }) }
    }

    const { error: insertError } = await supabase.from('invite_codes').insert(codesToInsert)
    if (insertError) throw new Error(`Failed to insert founder codes: ${insertError.message}`)
    console.log(`[seed] inserted ${codesToInsert.length} codes`)
    codesToInsert.slice(0, 5).forEach((c) => console.log(`  ${c.code}`))
    if (codesToInsert.length > 5) console.log(`  … and ${codesToInsert.length - 5} more`)
  } else {
    console.log(`[seed] already have ${existingCount} founder codes — skipping`)
  }

  // ── 4. Founder fixtures: id-verified + verified_checker ───────────────────
  const fixtureIds: Record<string, string> = {}

  for (const fixture of FOUNDER_FIXTURES) {
    let userId: string | null = null
    const existing = existingUsers?.users?.find((u) => u.email === fixture.email)

    if (existing) {
      userId = existing.id
      console.log(`[seed] fixture exists: ${fixture.username}`)
    } else {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: fixture.email,
        password: crypto.randomUUID(),
        email_confirm: true,
      })
      if (error || !newUser.user) {
        console.warn(`[seed] could not create fixture ${fixture.username}: ${error?.message}`)
        continue
      }
      userId = newUser.user.id
      console.log(`[seed] created fixture: ${fixture.username}`)
    }

    fixtureIds[fixture.username] = userId

    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: userId,
      username: fixture.username,
      role: 'member',
      id_verification_status: 'verified',
      verified_checker: fixture.verified_checker,
      checker_category: fixture.checker_category ?? null,
      tier: fixture.verified_checker ? 'gold' : 'bronze',
    }, { onConflict: 'id' })

    if (upsertErr) {
      console.warn(`[seed] upsert profile ${fixture.username}: ${upsertErr.message}`)
    } else {
      console.log(`[seed] upserted profile ${fixture.username} (verified=${fixture.verified_checker ? 'checker' : 'member'})`)
    }
  }

  // ── 5. Demo LC thread on first active listing ──────────────────────────────
  const { data: activeListing } = await supabase
    .from('listings').select('id, title').eq('status', 'active')
    .order('created_at', { ascending: true }).limit(1).maybeSingle()

  if (!activeListing) {
    console.log('[seed] no active listings — skipping demo LC thread')
    return
  }

  console.log(`[seed] demo LC thread on: ${activeListing.title} (${activeListing.id})`)

  const { data: existingComments } = await supabase
    .from('comments').select('id').eq('listing_id', activeListing.id).eq('thread_type', 'lc').limit(1)

  if (existingComments && existingComments.length > 0) {
    console.log('[seed] demo LC thread exists — skipping')
    return
  }

  // Pinned verdict from formcheck
  const formcheckId = fixtureIds['formcheck']
  if (formcheckId) {
    const { data: verdict, error: vErr } = await supabase.from('comments').insert({
      listing_id: activeListing.id, author_id: formcheckId, thread_type: 'lc',
      body: 'hardware, stitching, and tag are consistent with authentic.',
      pinned: true, status: 'visible', redacted: false,
    }).select('id').single()

    if (vErr) console.warn(`[seed] pinned verdict error: ${vErr.message}`)
    else console.log(`[seed] inserted pinned verdict: ${verdict.id}`)
  }

  // Two LC comments from tabiwalker
  const tabiId = fixtureIds['tabiwalker']
  if (tabiId) {
    for (const body of [
      'seams and bar tacks match my 2004 run. zipper pull font is right.',
      'asked for a macro of the care tag — seller delivered, checks out.',
    ]) {
      const { error: lcErr } = await supabase.from('comments').insert({
        listing_id: activeListing.id, author_id: tabiId, thread_type: 'lc',
        body, pinned: false, status: 'visible', redacted: false,
      })
      if (lcErr) console.warn(`[seed] LC comment error: ${lcErr.message}`)
      else console.log(`[seed] inserted LC comment by tabiwalker`)
    }
  }

  console.log('[seed] done.')
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message)
  process.exit(1)
})
