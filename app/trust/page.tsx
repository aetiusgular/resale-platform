import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import { getViewerUsername } from '@/app/components/viewer'

export const metadata: Metadata = { title: 'Trust', alternates: { canonical: '/trust' } }

/** /trust — how legit check, moderation and the badges work (design "Footer pages" board). */
export default async function TrustPage() {
  const username = await getViewerUsername()
  return (
    <AppShell username={username} footerActive="/trust">
      <main className="info-main info-main--wide">
        <div className="info-kicker">TRUST</div>
        <h1 className="info-title">Every listing checked in the open.</h1>
        <p className="info-p">Authentication on ARCHIVE isn&rsquo;t a black box. Tag macros are mandatory, the community votes in public, and a moderator signs the verdict. Here&rsquo;s the whole system.</p>

        <div className="trust-rule trust-rule--first"><span className="trust-rule__l">01 — LEGIT CHECK</span><span className="trust-rule__r">RUNS ON EVERY LISTING BEFORE IT GOES LIVE</span></div>
        <div className="trust-steps">
          <div>
            <div className="img-slot" style={{ background: 'var(--tone-2)' }}><span>IMG — TAG MACRO</span></div>
            <div className="trust-step__t">STEP 01 — TAG MACROS REQUIRED</div>
            <div className="trust-step__p">Sellers upload close-ups of the care label, brand tag and hardware, plus a handwritten possession tag in frame with the item. Listings without them don&rsquo;t publish.</div>
          </div>
          <div>
            <div className="img-slot" style={{ background: 'var(--tone-3)' }}><span>IMG — LC THREAD</span></div>
            <div className="trust-step__t">STEP 02 — COMMUNITY VOTES</div>
            <div className="trust-step__p">Collectors who own the piece weigh in on a public thread — agree, flag, or add reference photos. One vote per member per listing.</div>
          </div>
          <div>
            <div className="img-slot" style={{ background: 'var(--tone-4)' }}><span>IMG — VERDICT CARD</span></div>
            <div className="trust-step__t">STEP 03 — MOD VERDICT</div>
            <div className="trust-step__p">An LC moderator weighs the thread and the auto-auth signals, then signs a verdict that stays on the listing.</div>
          </div>
        </div>

        <div className="trust-rule"><span className="trust-rule__l">02 — MODERATION</span><span className="trust-rule__r">FLAG → REVIEW → ACTION, WITHIN 24H</span></div>
        <div className="trust-split">
          <div className="trust-split__text">
            <div className="sec-text">Anything flagged — a listing, a comment, a message — lands in a moderator queue and is reviewed within 24 hours. Contact details and payment links are stripped from messages automatically; repeat offenders are banned, permanently.</div>
            <div className="mt-16">
              <div className="mini-row"><span className="mini-row__k">FLAG</span><span className="mini-row__v">Any member can flag, one tap, no forms</span></div>
              <div className="mini-row"><span className="mini-row__k">REVIEW</span><span className="mini-row__v">Human moderator, full context, both sides</span></div>
              <div className="mini-row"><span className="mini-row__k">ACTION</span><span className="mini-row__v">Remove, refund, or ban — logged on the record</span></div>
            </div>
          </div>
          <div className="img-slot trust-split__img" style={{ background: 'var(--tone-1)' }}><span>IMG — MOD QUEUE</span></div>
        </div>

        <div className="trust-rule"><span className="trust-rule__l">03 — THE MARKS</span><span className="trust-rule__r">WHAT THE BADGES MEAN</span></div>
        <div className="badge-legend">
          <div className="badge-card"><span className="tag">VERIFIED</span><p>Seller passed government-ID verification via Stripe Identity.</p></div>
          <div className="badge-card"><span className="tag tag--ink">AUTHENTICATED</span><p>Tag pass + community legit votes + signed moderator verdict.</p></div>
          <div className="badge-card"><span className="tag" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>LC MOD</span><p>Marks moderator replies inside legit-check threads.</p></div>
        </div>

        <div className="trust-rule"><span className="trust-rule__l">04 — ESCROW</span><span className="trust-rule__r">MONEY MOVES ONLY WHEN THE ITEM DOES</span></div>
        <div className="mt-8">
          <div className="mini-row"><span className="mini-row__k">PAID</span><span className="mini-row__v">Funds are held; the seller ships on a prepaid, tracked label</span></div>
          <div className="mini-row"><span className="mini-row__k">DELIVERED</span><span className="mini-row__v">Buyer confirms, or 72 hours to open a dispute</span></div>
          <div className="mini-row"><span className="mini-row__k">RELEASED</span><span className="mini-row__v">Payout lands in the seller&rsquo;s Stripe balance</span></div>
        </div>
      </main>
    </AppShell>
  )
}
