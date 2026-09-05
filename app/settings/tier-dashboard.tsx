'use client'

/**
 * TierDashboard — "03 — SELLER TIER" (design 2A) + the Fees & tiers section.
 * Pure presentation: the server computes both SideDashboards (lib/tier-dashboard)
 * and passes them in. Shows the current effective rate, progress to the next tier
 * (volume AND order-count gates), and a 14-day expiring-volume warning. Rendered
 * only when TIER_DASHBOARD_ENABLED is on (parent decides).
 */
import type { SideDashboard } from '@/lib/tier-dashboard'
import { formatCents } from '@/lib/fees'

const pct = (bps: number) => (bps / 100).toFixed(1) + '%'
/** Deterministic (UTC, fixed locale) so SSR and hydration agree. */
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'UTC' })

type Copy = { title: string; feeLabel: string; activityNoun: string; countNoun: string }
const COPY: Record<'buyer' | 'seller', Copy> = {
  seller: { title: 'Seller tier', feeLabel: 'SELLER FEE', activityNoun: 'sales', countNoun: 'orders' },
  buyer: { title: 'Buyer tier', feeLabel: 'BUYER FEE', activityNoun: 'purchases', countNoun: 'purchases' },
}

export default function TierDashboard({ buyer, seller, compact = false }: { buyer: SideDashboard | null; seller: SideDashboard; compact?: boolean }) {
  if (compact) return <SideBlock data={seller} />
  return (
    <>
      <p className="settings-note" style={{ paddingTop: 14 }}>
        Your fee rate is set by your activity over the last 12 months — a lower rate needs both enough
        volume and enough completed orders. Reach a better rate and it&rsquo;s locked in for 30 days even if
        activity dips.
      </p>
      <div className="sec-head"><span className="sec-head__label">SELLING</span></div>
      <SideBlock data={seller} />
      {buyer && (
        <>
          <div className="sec-head"><span className="sec-head__label">BUYING</span></div>
          <SideBlock data={buyer} />
        </>
      )}
    </>
  )
}

function SideBlock({ data }: { data: SideDashboard }) {
  const c = COPY[data.side]
  const atBest = data.next == null
  const volFrac = atBest ? 1 : Math.min(1, data.volumeCents / Math.max(1, data.next!.minVolumeCents))
  const ordFrac = atBest ? 1 : Math.min(1, data.orderCount / Math.max(1, data.next!.minOrders))

  return (
    <>
      <div className="tier-row">
        <div>
          <div className="tier-name">{c.title}</div>
          <div className="tier-sub">
            {formatCents(data.volumeCents)} IN {c.activityNoun.toUpperCase()} · {data.orderCount} {c.countNoun.toUpperCase()} · 12 MONTHS
          </div>
        </div>
        <div className="tier-stats">
          <div><div className="field-label">CURRENT FEE</div><div className="tier-stat">{pct(data.effectiveBps)}</div></div>
          {!atBest && <div><div className="field-label">NEXT TIER</div><div className="tier-stat">{pct(data.next!.bps)}</div></div>}
          {data.locked && data.lockedUntilMs != null && (
            <div><div className="field-label">LOCKED UNTIL</div><div className="tier-stat">{shortDate(data.lockedUntilMs)}</div></div>
          )}
        </div>
      </div>
      {atBest ? (
        <>
          <div className="tier-bar"><div className="tier-bar__fill" style={{ width: '100%' }} /></div>
          <div className="tier-bar__legend">
            <span>BEST RATE — {pct(data.current.bps)}</span>
            <span className="page-note">MAINTAIN YOUR ACTIVITY TO KEEP IT</span>
          </div>
        </>
      ) : (
        <>
          <div className="tier-bar"><div className="tier-bar__fill" style={{ width: `${volFrac * 100}%` }} /></div>
          <div className="tier-bar__legend">
            <span>{formatCents(data.volumeCents)} / {formatCents(data.next!.minVolumeCents)} {c.activityNoun.toUpperCase()}</span>
            <span className="page-note">{data.volumeToNextCents > 0 ? `${formatCents(data.volumeToNextCents)} MORE TO ${pct(data.next!.bps)}` : 'VOLUME GATE MET'}</span>
          </div>
          <div className="tier-bar" style={{ marginTop: 10 }}><div className="tier-bar__fill" style={{ width: `${ordFrac * 100}%` }} /></div>
          <div className="tier-bar__legend">
            <span>{data.orderCount} / {data.next!.minOrders} {c.countNoun.toUpperCase()}</span>
            <span className="page-note">{data.ordersToNext > 0 ? `${data.ordersToNext} MORE ${data.ordersToNext === 1 ? c.countNoun.replace(/s$/, '').toUpperCase() : c.countNoun.toUpperCase()}` : 'ORDER GATE MET'}</span>
          </div>
        </>
      )}
      {data.locked && data.lockedUntilMs != null && data.activityBps > data.effectiveBps && (
        <div className="mono-note" style={{ paddingTop: 10 }}>LOCKED AT {pct(data.effectiveBps)} UNTIL {shortDate(data.lockedUntilMs)} · CURRENT ACTIVITY RATE {pct(data.activityBps)}</div>
      )}
      {data.willDropTier && (
        <div className="push-banner" style={{ borderColor: 'var(--alert)' }}>
          <span>
            {formatCents(data.expiringVolumeCents)} in {c.activityNoun} and {data.expiringOrderCount} {data.expiringOrderCount === 1 ? c.countNoun.replace(/s$/, '') : c.countNoun} roll out of your 12-month window in the next 14 days. Without new {c.activityNoun}, your rate would move to {pct(data.projectedBps)}.
            {data.locked && data.lockedUntilMs != null && <> Your locked {pct(data.effectiveBps)} holds until {shortDate(data.lockedUntilMs)}.</>}
          </span>
        </div>
      )}
    </>
  )
}
