import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * @live — RLS and RPC parity tests.
 * Require real Supabase credentials. Run locally only; CI skips @live.
 * Tagged: @live
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm playwright test auth-live.spec.ts --grep @live
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

async function createTestUser(email: string, password: string, username: string) {
  const service = serviceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  })
  if (error) throw error

  const userId = data.user.id
  await service.from('profiles').insert({ id: userId, username })
  return userId
}

async function cleanupUser(userId: string) {
  const service = serviceClient()
  await service.auth.admin.deleteUser(userId)
  // profile cascades due to ON DELETE CASCADE
}

async function createCode(generatedBy: string, code: string) {
  const service = serviceClient()
  await service.from('invite_codes').insert({ code, generated_by: generatedBy })
}

test.describe('@live RLS — invite codes isolation', () => {
  let userAId: string
  let userBId: string
  const userAEmail = `test-a-${Date.now()}@test.invalid`
  const userBEmail = `test-b-${Date.now()}@test.invalid`
  const password = 'TestPass123!'
  const testCode = `TEST-${Date.now().toString(36).slice(-4).toUpperCase()}`

  test.beforeAll(async () => {
    userAId = await createTestUser(userAEmail, password, `usera${Date.now()}`)
    userBId = await createTestUser(userBEmail, password, `userb${Date.now()}`)
    await createCode(userAId, testCode)
  })

  test.afterAll(async () => {
    await cleanupUser(userAId)
    await cleanupUser(userBId)
  })

  test('@live user B cannot read user A codes via direct query', async () => {
    const client = anonClient()
    await client.auth.signInWithPassword({ email: userBEmail, password })

    const { data, error } = await client
      .from('invite_codes')
      .select('code')
      .eq('generated_by', userAId)

    // RLS should return empty array (not error, just filtered)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  test('@live user A can read their own codes', async () => {
    const client = anonClient()
    await client.auth.signInWithPassword({ email: userAEmail, password })

    const { data, error } = await client
      .from('invite_codes')
      .select('code')
      .eq('generated_by', userAId)

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
    expect(data?.[0].code).toBe(testCode)
  })
})

test.describe('@live RPC — concurrent double-claim prevention', () => {
  let ownerUserId: string
  let claimerAId: string
  let claimerBId: string
  const ownerEmail = `owner-${Date.now()}@test.invalid`
  const claimerAEmail = `claimer-a-${Date.now()}@test.invalid`
  const claimerBEmail = `claimer-b-${Date.now()}@test.invalid`
  const password = 'TestPass123!'
  const raceCode = `RACE-${Date.now().toString(36).slice(-4).toUpperCase()}`

  test.beforeAll(async () => {
    ownerUserId = await createTestUser(ownerEmail, password, `owner${Date.now()}`)
    claimerAId = await createTestUser(claimerAEmail, password, `claimera${Date.now()}`)
    claimerBId = await createTestUser(claimerBEmail, password, `claimerb${Date.now()}`)
    await createCode(ownerUserId, raceCode)
  })

  test.afterAll(async () => {
    await cleanupUser(ownerUserId)
    await cleanupUser(claimerAId)
    await cleanupUser(claimerBId)
  })

  test('@live concurrent double-claim: exactly one winner', async () => {
    const clientA = anonClient()
    const clientB = anonClient()

    await Promise.all([
      clientA.auth.signInWithPassword({ email: claimerAEmail, password }),
      clientB.auth.signInWithPassword({ email: claimerBEmail, password }),
    ])

    // Fire both claims simultaneously
    const [resultA, resultB] = await Promise.all([
      clientA.rpc('claim_invite_code', { p_code: raceCode, p_user_id: claimerAId }),
      clientB.rpc('claim_invite_code', { p_code: raceCode, p_user_id: claimerBId }),
    ])

    const successA = (resultA.data as { success: boolean })?.success ?? false
    const successB = (resultB.data as { success: boolean })?.success ?? false

    // Exactly one must succeed
    const successes = [successA, successB].filter(Boolean)
    expect(successes).toHaveLength(1)

    // The other must fail with "code already used"
    const failures = [resultA, resultB].filter(
      (r) => !(r.data as { success: boolean })?.success,
    )
    expect(failures).toHaveLength(1)
    expect((failures[0].data as { error: string })?.error).toBe('code already used')

    // Verify DB state
    const service = serviceClient()
    const { data: code } = await service
      .from('invite_codes')
      .select('status, used_by')
      .eq('code', raceCode)
      .single()

    expect(code?.status).toBe('claimed')
    expect([claimerAId, claimerBId]).toContain(code?.used_by)
  })

  test('@live reused code rejected with correct message', async () => {
    // raceCode is already claimed from the previous test
    const client = anonClient()
    // Create a fresh user to attempt claim
    const freshEmail = `fresh-${Date.now()}@test.invalid`
    const freshId = await createTestUser(freshEmail, password, `fresh${Date.now()}`)

    try {
      await client.auth.signInWithPassword({ email: freshEmail, password })
      const { data } = await client.rpc('claim_invite_code', {
        p_code: raceCode,
        p_user_id: freshId,
      })
      expect((data as { success: boolean; error: string }).success).toBe(false)
      expect((data as { success: boolean; error: string }).error).toBe('code already used')
    } finally {
      await cleanupUser(freshId)
    }
  })
})
