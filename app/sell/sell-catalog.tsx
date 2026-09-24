'use client'

/**
 * Seller catalog (reference CatalogView): ACTIVE / DRAFTS / SOLD tabs, cards
 * with views · saves · offers meta, EDIT · BUMP ↑ (+ OFFER $x or BUMPED 2D AGO),
 * drafts CONTINUE → / SAVED TUE, sold RELIST / VIEW ORDER. Listings in review
 * sit in ACTIVE with an IN REVIEW flag until a moderator approves them.
 */
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatTimeAgo } from '@/app/components/listing-card'

export type { SellerListing } from '@/lib/loaders/sell'
import type { SellerListing } from '@/lib/loaders/sell'

type Tab = 'active' | 'draft' | 'sold'

function bucket(status: string): Tab | null {
  if (status === 'active' || status === 'pending_escrow' || status === 'pending_review' || status === 'removed') return 'active'
  if (status === 'draft') return 'draft'
  if (status === 'sold') return 'sold'
  return null
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}
const short = (iso: string) => formatTimeAgo(iso).replace(' AGO', '')
const monthDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase()
const weekday = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()

export default function SellCatalog({
  listings, feeLine, bumpEnabled, boostEnabled, newListing,
}: {
  listings: SellerListing[]
  feeLine: string
  bumpEnabled: boolean
  boostEnabled: boolean
  newListing: ReactNode
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')
  const [bumping, setBumping] = useState<string | null>(null)
  const [bumpMsg, setBumpMsg] = useState<Record<string, string>>({})
  const [relisting, setRelisting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const count = (t: Tab) => listings.filter((l) => bucket(l.status) === t).length
  const list = listings.filter((l) => bucket(l.status) === tab)
  const tabs: [Tab, string][] = [
    ['active', `ACTIVE (${count('active')})`],
    ['draft', `DRAFTS (${count('draft')})`],
    ['sold', `SOLD (${count('sold')})`],
  ]

  async function bump(id: string) {
    setBumping(id)
    const res = await fetch(`/api/listings/${id}/bump`, { method: 'POST' })
    setBumping(null)
    if (res.ok) { setBumpMsg((m) => ({ ...m, [id]: 'BUMPED JUST NOW' })); router.refresh(); return }
    const data = await res.json().catch(() => ({}))
    if (res.status === 409 && typeof data.nextEligibleAtMs === 'number') {
      setBumpMsg((m) => ({ ...m, [id]: `NEXT FREE BUMP ${monthDay(new Date(data.nextEligibleAtMs).toISOString())}` }))
    } else {
      setBumpMsg((m) => ({ ...m, [id]: (data.error ?? 'COULD NOT BUMP').toUpperCase() }))
    }
  }

  async function relist(id: string) {
    setRelisting(id)
    const res = await fetch(`/api/listings/${id}/relist`, { method: 'POST' })
    setRelisting(null)
    if (res.ok) {
      const d = await res.json().catch(() => ({}))
      router.push(d.id ? `/sell/new?draft=${d.id}` : '/sell/new')
    }
  }

  async function deleteDraft(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) router.refresh()
  }

  return (
    <main className="saved-main">
      <div className="sell-head">
        <div>
          <h1 className="page-title">Sell</h1>
          <div className="sell-head__stats">{count('active')} ACTIVE · {count('draft')} DRAFTS · {count('sold')} SOLD · {feeLine}</div>
        </div>
        {newListing}
      </div>
      <div className="tabs-line" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab-mono${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)} data-testid={`sell-tab-${id}`}>{label}</button>
        ))}
        <span className="spacer" />
        <span className="link-underline tabs-line__sort" style={{ textDecoration: 'none' }}>SORT: NEWEST</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty__title">
            {tab === 'active' ? 'No active listings.' : tab === 'draft' ? 'No drafts.' : 'No sales yet.'}
          </div>
          <div className="empty__sub">
            {tab === 'active' ? 'PHOTOS, DETAILS AND A PRICE — LIVE AFTER A QUICK REVIEW' : tab === 'draft' ? 'THE WIZARD AUTO-SAVES — UNFINISHED LISTINGS WAIT HERE' : 'SOLD ITEMS AND THEIR PAYOUTS LAND HERE'}
          </div>
          {tab !== 'sold' && <div className="empty__cta">{newListing}</div>}
        </div>
      ) : (
        <div className="grid" data-testid="seller-catalog-grid">
          {list.map((l, i) => {
            const sold = l.status === 'sold'
            const draft = l.status === 'draft'
            const pendingEscrow = l.status === 'pending_escrow'
            const inReview = l.status === 'pending_review'
            const removed = l.status === 'removed'
            const meta = sold
              ? `SOLD ${monthDay(l.sold_at)}${l.payout_display ? ` · PAID OUT ${l.payout_display}` : ''}`
              : draft
                ? `${l.photo_count} OF 5 PHOTOS · ${l.price_cents ? `PRICE ${l.price_display}` : 'NO PRICE SET'}`
                : removed
                  ? (l.rejection_reason ? `REJECTED — ${l.rejection_reason.toUpperCase()}` : 'REJECTED')
                  : `${l.view_count} VIEWS · ${l.saves_count} SAVES${l.open_offers > 0 ? ` · ${l.open_offers} ${l.open_offers === 1 ? 'OFFER' : 'OFFERS'}` : ''} · LISTED ${short(l.created_at)}`
            return (
              <article key={l.id} className="card" style={{ cursor: 'default' }} data-testid="sell-card">
                <PrefetchLink href={draft ? `/sell/new?draft=${l.id}` : `/listings/${l.id}`}>
                  <div className="card__media" style={{ background: `var(--tone-${(i % 8) + 1})` }}>
                    {l.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt={l.title} loading={i < 8 ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {l.boosted && l.boosted_until && <span className="flag flag--boost">BOOSTED · {daysLeft(l.boosted_until)}D LEFT</span>}
                    {draft && <span className="flag flag--tag">DRAFT</span>}
                    {!l.boosted && inReview && <span className="flag flag--tag">IN REVIEW</span>}
                    {!l.boosted && removed && <span className="flag flag--tag" style={{ color: 'var(--alert)', borderColor: 'var(--alert)' }}>REJECTED</span>}
                    {!l.boosted && pendingEscrow && <span className="flag flag--tag">PAYMENT PENDING</span>}
                    {sold && <span className="card__sold"><span>SOLD</span></span>}
                  </div>
                </PrefetchLink>
                <div className="card__row1">
                  <span className="card__brand">{l.brand.toUpperCase() || 'UNTITLED'}</span>
                  <span className="card__price">{l.price_display}</span>
                </div>
                <div className="card__title">{l.title || 'Untitled draft'}</div>
                <div className="sell-meta">{meta}</div>
                <div className="sell-actions">
                  {tab === 'active' && !pendingEscrow && !removed && (
                    <>
                      <PrefetchLink className="link-underline link-underline--ink" href={`/sell/new?edit=${l.id}`}>EDIT</PrefetchLink>
                      {bumpEnabled && !inReview && (
                        <button type="button" className="link-underline link-underline--ink" onClick={() => bump(l.id)} disabled={bumping === l.id}>
                          {bumping === l.id ? 'BUMPING…' : 'BUMP ↑'}
                        </button>
                      )}
                      {boostEnabled && !l.boosted && !inReview && (
                        <PrefetchLink className="link-underline" href={`/boost/${l.id}`}>BOOST</PrefetchLink>
                      )}
                      {l.open_offers > 0 && l.top_offer_display ? (
                        <PrefetchLink href="/messages" className="sell-actions__offer">OFFER {l.top_offer_display}</PrefetchLink>
                      ) : (
                        <span className="sell-actions__meta">
                          {inReview ? 'IN REVIEW · USUALLY UNDER 24H' : bumpMsg[l.id] ?? (l.bumped_at ? `BUMPED ${formatTimeAgo(l.bumped_at)}` : '')}
                        </span>
                      )}
                    </>
                  )}
                  {tab === 'active' && pendingEscrow && (
                    <>
                      <PrefetchLink className="link-underline link-underline--ink" href={`/listings/${l.id}`}>VIEW</PrefetchLink>
                      <span className="sell-actions__meta">A BUYER IS CHECKING OUT</span>
                    </>
                  )}
                  {tab === 'active' && removed && (
                    <>
                      <button type="button" className="link-underline link-underline--ink" onClick={() => relist(l.id)} disabled={relisting === l.id}>{relisting === l.id ? 'RELISTING…' : 'RELIST →'}</button>
                      <PrefetchLink className="link-underline" href={`/listings/${l.id}`}>VIEW</PrefetchLink>
                    </>
                  )}
                  {tab === 'draft' && (
                    <>
                      <PrefetchLink className="link-underline link-underline--ink" href={`/sell/new?draft=${l.id}`}>CONTINUE →</PrefetchLink>
                      <button type="button" className="link-underline" onClick={() => deleteDraft(l.id)} disabled={deleting === l.id}>{deleting === l.id ? 'DELETING…' : 'DELETE'}</button>
                      <span className="sell-actions__meta">SAVED {weekday(l.updated_at)}</span>
                    </>
                  )}
                  {tab === 'sold' && (
                    <>
                      <button type="button" className="link-underline link-underline--ink" onClick={() => relist(l.id)} disabled={relisting === l.id}>{relisting === l.id ? 'RELISTING…' : 'RELIST'}</button>
                      <PrefetchLink className="link-underline" href={l.order_id ? `/orders/${l.order_id}` : '/settings/orders'}>VIEW ORDER</PrefetchLink>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {/* Mobile web (14): the + NEW LISTING bar sits in the flow after the grid, the footer below it. */}
      <div className="sell-newbar">
        <PrefetchLink href="/sell/new" className="btn-primary" data-testid="sell-new-m">+ NEW LISTING</PrefetchLink>
      </div>
    </main>
  )
}
