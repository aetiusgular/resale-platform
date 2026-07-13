import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * @live B2 listing flow — requires real Supabase credentials.
 * Run with: RUN_LIVE_TESTS=1 pnpm verify:ui
 *
 * Tests:
 * 1. Seller creates listing → status pending_review
 * 2. Pending listing NOT publicly visible
 * 3. Admin approves → status active → visible on /listings/[id]
 * 4. Reject path shows reason to seller
 *
 * RLS specs:
 * - Non-owner cannot read pending/draft listings
 * - Non-admin cannot update status to active
 * - Storage write outside own folder rejected
 */

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper: create a test user via service client
async function createTestUser(email: string, password: string, role = 'member') {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const userId = data.user!.id

  // Create profile
  await admin.from('profiles').insert({
    id: userId,
    username: email.split('@')[0] + '_' + Date.now(),
    role,
    id_verified: false,
    invited_by: userId, // self-invite for test
  })

  return { userId, email, password }
}

async function deleteTestUser(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  await admin.auth.admin.deleteUser(userId)
}

// signIn helper is unused in these direct API / DB tests, but kept for future flow tests
async function signIn(_page: Page, _email: string, _password: string): Promise<void> {
  // Placeholder: @live flow tests sign in via createClient directly, not page.evaluate
}

test.describe('@live Listings flow', () => {
  test.skip(!process.env.RUN_LIVE_TESTS, 'Set RUN_LIVE_TESTS=1 to run @live tests')

  let sellerUser:  { userId: string; email: string; password: string }
  let adminUser:   { userId: string; email: string; password: string }
  let otherUser:   { userId: string; email: string; password: string }
  let listingId:   string

  test.beforeAll(async () => {
    const ts = Date.now()
    sellerUser = await createTestUser(`seller-${ts}@test.com`, 'TestPass123!')
    adminUser  = await createTestUser(`admin-${ts}@test.com`,  'TestPass123!', 'admin')
    otherUser  = await createTestUser(`other-${ts}@test.com`,  'TestPass123!')
  })

  test.afterAll(async () => {
    await deleteTestUser(sellerUser.userId)
    await deleteTestUser(adminUser.userId)
    await deleteTestUser(otherUser.userId)
  })

  test('seller creates listing → status pending_review', async ({ request }) => {
    // Create listing directly via API with seller credentials
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: sellerUser.email, password: sellerUser.password })

    const { data: { session } } = await sb.auth.getSession()
    const token = session!.access_token

    const res = await request.post('/api/listings', {
      headers: { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` },
      data: {
        title: 'TEST LISTING',
        brand: 'TEST BRAND',
        category: 'Outerwear',
        size: 'M',
        description: 'test listing for e2e',
        condition_score: 8,
        condition_notes: { damage: [], notes: {} },
        price_cents: 10000,
        images: ['https://example.com/f.jpg', '', '', '', '', 'https://example.com/p.jpg'],
        possession_photo_url: 'https://example.com/p.jpg',
      },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    listingId = body.id
    expect(body.status).toBe('pending_review')
  })

  test('pending listing NOT visible to anon (RLS)', async () => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    const { data } = await sb.from('listings').select('id').eq('id', listingId).single()
    expect(data).toBeNull()
  })

  test('pending listing NOT visible to non-owner (RLS)', async () => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: otherUser.email, password: otherUser.password })
    const { data } = await sb.from('listings').select('id').eq('id', listingId).single()
    expect(data).toBeNull()
  })

  test('seller can see their own pending listing (RLS)', async () => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: sellerUser.email, password: sellerUser.password })
    const { data } = await sb.from('listings').select('id, status').eq('id', listingId).single()
    expect(data?.status).toBe('pending_review')
  })

  test('non-admin cannot update status to active (RLS)', async () => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: sellerUser.email, password: sellerUser.password })
    const { error } = await sb
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId)
    // RLS WITH CHECK blocks status='active' for seller
    expect(error).not.toBeNull()
  })

  test('admin approves listing → status active', async ({ request }) => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: adminUser.email, password: adminUser.password })
    const { data: { session } } = await sb.auth.getSession()
    const token = session!.access_token

    const res = await request.post(`/api/admin/listings/${listingId}/approve`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Verify status
    const { data } = await sb.from('listings').select('status').eq('id', listingId).single()
    expect(data?.status).toBe('active')
  })

  test('active listing visible on /listings/[id]', async ({ page }) => {
    await page.goto(`/listings/${listingId}`)
    // Title must be in server HTML (SSR/SEO check)
    const title = await page.locator('h1').first().textContent()
    expect(title).toBeTruthy()
    expect(title?.includes('TEST LISTING') || title?.includes('TEST')).toBe(true)
  })

  test('reject path: admin rejects listing, reason shown to seller', async ({ request }) => {
    // Create another listing for rejection test
    const sbSeller = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sbSeller.auth.signInWithPassword({ email: sellerUser.email, password: sellerUser.password })
    const { data: { session: sellerSession } } = await sbSeller.auth.getSession()

    const createRes = await request.post('/api/listings', {
      headers: { Authorization: `Bearer ${sellerSession!.access_token}` },
      data: {
        title: 'REJECT TEST',
        brand: 'TEST',
        category: 'Tops',
        size: 'S',
        description: '',
        condition_score: 5,
        condition_notes: {},
        price_cents: 5000,
        images: ['https://example.com/f.jpg', '', '', '', '', 'https://example.com/p.jpg'],
        possession_photo_url: 'https://example.com/p.jpg',
      },
    })
    const { id: rejectId } = await createRes.json()

    // Admin rejects
    const sbAdmin = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sbAdmin.auth.signInWithPassword({ email: adminUser.email, password: adminUser.password })
    const { data: { session: adminSession } } = await sbAdmin.auth.getSession()

    const rejectRes = await request.post(`/api/admin/listings/${rejectId}/reject`, {
      headers: { Authorization: `Bearer ${adminSession!.access_token}` },
      data: { reason: 'Stock photo detected — upload your own photos.' },
    })
    expect(rejectRes.status()).toBe(200)

    // Verify seller can see rejection reason
    const { data } = await sbSeller
      .from('listings')
      .select('status, rejection_reason')
      .eq('id', rejectId)
      .single()
    expect(data?.status).toBe('removed')
    expect(data?.rejection_reason).toBe('Stock photo detected — upload your own photos.')
  })

  test('@live storage: write outside own folder rejected', async () => {
    const sb = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await sb.auth.signInWithPassword({ email: otherUser.email, password: otherUser.password })

    // Try to write to seller's folder — should be rejected
    const blob = new Blob(['fake'], { type: 'image/jpeg' })
    const { error } = await sb.storage
      .from('product-images')
      .upload(`listings/${sellerUser.userId}/evil.jpg`, blob, { upsert: true })

    expect(error).not.toBeNull()
  })
})
