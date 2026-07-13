/**
 * Seed script: creates a system profile and generates 30 founder invite codes.
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

const SYSTEM_USER_EMAIL = 'system@resale-platform.internal'
const FOUNDER_CODE_COUNT = 30

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── 1. Find or create system auth user ────────────────────────────────────
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
    if (error || !newUser.user) {
      throw new Error(`Failed to create system user: ${error?.message}`)
    }
    systemUserId = newUser.user.id
    console.log(`[seed] created system user: ${systemUserId}`)
  }

  // ── 2. Find or create system profile ──────────────────────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', systemUserId)
    .single()

  if (!existingProfile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: systemUserId,
      username: 'system',
      role: 'admin',
    })
    if (profileError) {
      if (profileError.code === '23505') {
        console.log('[seed] system profile already exists (conflict on username)')
      } else {
        throw new Error(`Failed to create system profile: ${profileError.message}`)
      }
    } else {
      console.log('[seed] created system profile')
    }
  } else {
    console.log('[seed] system profile exists')
  }

  // ── 3. Count existing founder codes ───────────────────────────────────────
  const { count: existingCount } = await supabase
    .from('invite_codes')
    .select('code', { count: 'exact', head: true })
    .eq('generated_by', systemUserId)

  const needed = FOUNDER_CODE_COUNT - (existingCount ?? 0)
  if (needed <= 0) {
    console.log(`[seed] already have ${existingCount} founder codes — nothing to do`)
    return
  }

  console.log(`[seed] generating ${needed} founder codes…`)

  // ── 4. Generate codes (client-side, then batch insert) ────────────────────
  const codesToInsert: { code: string; generated_by: string }[] = []
  const seen = new Set<string>()

  // Fetch existing codes to avoid collisions
  const { data: allCodes } = await supabase.from('invite_codes').select('code')
  for (const row of allCodes ?? []) seen.add(row.code)

  while (codesToInsert.length < needed) {
    const code = generateCode()
    if (!seen.has(code)) {
      seen.add(code)
      codesToInsert.push({ code, generated_by: systemUserId })
    }
  }

  const { error: insertError } = await supabase.from('invite_codes').insert(codesToInsert)
  if (insertError) {
    throw new Error(`Failed to insert founder codes: ${insertError.message}`)
  }

  console.log(`[seed] inserted ${codesToInsert.length} founder codes`)
  console.log('[seed] sample codes:')
  codesToInsert.slice(0, 5).forEach((c) => console.log(`  ${c.code}`))
  if (codesToInsert.length > 5) {
    console.log(`  … and ${codesToInsert.length - 5} more`)
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message)
  process.exit(1)
})
