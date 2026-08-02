import { describe, it, expect } from 'vitest'
import { sellerMustVerify } from '../../lib/idv/risk-resolver'

/**
 * Resolver-assembly test for the seller ID-verification gate (bucket-1 item 4).
 * Mocks the service-client DB reads so we exercise the OR-assembly:
 *   risk (bad ratings OR >=2 upheld complaints)  OR  >=$5k trailing sales.
 * The pure halves are covered by reviews.test.ts / verification-policy.test.ts;
 * this proves the resolver wires the three DB reads into the right decision.
 */
type Opts = { reviews?: number[]; upheldComplaints?: number; orderItemCents?: number[] }

function makeService(opts: Opts) {
  const reviewsRows = (opts.reviews ?? []).map((stars) => ({ stars }))
  const ordersRows = (opts.orderItemCents ?? []).map((item_cents) => ({ item_cents }))
  const profileSingle = { data: { upheld_complaints: opts.upheldComplaints ?? 0 } }

  function builder(table: string) {
    const listResult =
      table === 'reviews' ? { data: reviewsRows }
      : table === 'orders' ? { data: ordersRows, error: null }
      : { data: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      in: () => b,
      single: () => Promise.resolve(profileSingle),
      then: (resolve: (v: unknown) => void) => resolve(listResult),
    }
    return b
  }
  return { from: (table: string) => builder(table) } as unknown as Parameters<typeof sellerMustVerify>[0]
}

describe('sellerMustVerify — resolver assembly (risk OR $5k volume)', () => {
  it('clean seller (good ratings, no complaints, low volume) => false', async () => {
    const svc = makeService({ reviews: [5, 5, 5], upheldComplaints: 0, orderItemCents: [10_000, 20_000] })
    expect(await sellerMustVerify(svc, 'seller-clean')).toBe(false)
  })

  it('>=2 upheld complaints => true (complaints risk path)', async () => {
    const svc = makeService({ reviews: [5, 5], upheldComplaints: 2, orderItemCents: [] })
    expect(await sellerMustVerify(svc, 'seller-complaints')).toBe(true)
  })

  it('repeated bad ratings (low-star share) => true (ratings risk path)', async () => {
    const svc = makeService({ reviews: [1, 1, 1, 5, 5], upheldComplaints: 0, orderItemCents: [] })
    expect(await sellerMustVerify(svc, 'seller-badratings')).toBe(true)
  })

  it('>=$5k trailing sales, otherwise clean => true (INFORM-Act volume path)', async () => {
    const svc = makeService({ reviews: [5, 5], upheldComplaints: 0, orderItemCents: [500_000] })
    expect(await sellerMustVerify(svc, 'seller-highvolume')).toBe(true)
  })

  it('a malicious buyer\'s un-upheld disputes (0 upheld) never trip it', async () => {
    const svc = makeService({ reviews: [5, 5, 5, 5, 5], upheldComplaints: 0, orderItemCents: [10_000] })
    expect(await sellerMustVerify(svc, 'seller-disputed')).toBe(false)
  })
})
