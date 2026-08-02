'use client'

/**
 * TierDashboard — settings "Buying & selling power" pane (business-model-v2 §1f).
 * Pure presentation: the server computes both SideDashboards (lib/tier-dashboard)
 * and passes them in. Shows the current effective rate, progress to the next tier
 * (volume AND order-count gates), and a 14-day expiring-volume warning. Rendered
 * only when TIER_DASHBOARD_ENABLED is on (parent decides).
 *
 * Type-only import of SideDashboard keeps the server tier module out of the client
 * bundle; formatCents comes from the pure fee module.
 */
import type { SideDashboard } from '@/lib/tier-dashboard'
import { formatCents } from '@/lib/fees'

const INK = 'var(--color-ink)'
const SOFT = 'var(--color-ink-soft)'
const LINE = 'var(--color-line)'

const pct = (bps: number) => (bps / 100).toFixed(1) + '%'
/** Deterministic (UTC, fixed locale) so SSR and hydration agree. */
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

type Copy = { title: string; feeLabel: string; activityNoun: string; countNoun: string }
const COPY: Record<'buyer' | 'seller', Copy> = {
  seller: { title: 'Selling power', feeLabel: 'seller fee', activityNoun: 'sales', countNoun: 'orders' },
  buyer: { title: 'Buying power', feeLabel: 'buyer fee', activityNoun: 'purchases', countNoun: 'purchases' },
}

export default function TierDashboard({ buyer, seller }: { buyer: SideDashboard; seller: SideDashboard }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: INK }}>Buying &amp; selling power</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: SOFT, lineHeight: 1.5, maxWidth: 520 }}>
        Your fee rate is set by your activity over the last 12 months — a lower rate needs both enough
        volume and enough completed orders. Reach a better rate and it&rsquo;s locked in for 30 days even if
        activity dips.
      </p>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SideCard data={seller} />
        <SideCard data={buyer} />
      </div>
    </div>
  )
}

function SideCard({ data }: { data: SideDashboard }) {
  const c = COPY[data.side]
  const atBest = data.next == null

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 2, padding: '18px 16px', maxWidth: 560 }}>
      {/* Header: title + current rate */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{
          font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: SOFT,
        }}>{c.title}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: INK, lineHeight: 1 }}>
            {pct(data.effectiveBps)}
          </span>
          <span style={{ fontSize: 12, color: SOFT }}>{c.feeLabel}</span>
        </span>
      </div>

      {/* Lock note */}
      {data.locked && data.lockedUntilMs != null && (
        <div style={{ marginTop: 8, fontSize: 12, color: SOFT }}>
          Locked at {pct(data.effectiveBps)} until {shortDate(data.lockedUntilMs)}
          {data.activityBps > data.effectiveBps && <> · your current activity rate is {pct(data.activityBps)}</>}
        </div>
      )}

      {/* Trailing stats */}
      <div style={{ marginTop: 12, fontSize: 13, color: INK }}>
        12-month {c.activityNoun}: <strong style={{ fontWeight: 600 }}>{formatCents(data.volumeCents)}</strong>
        {' '}across {data.orderCount} {data.orderCount === 1 ? c.countNoun.replace(/s$/, '') : c.countNoun}
      </div>

      {/* Progress to next tier */}
      {atBest ? (
        <div style={{ marginTop: 14, fontSize: 13, color: INK }}>
          You&rsquo;re at our best rate — {pct(data.current.bps)}. 🎉
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: INK, marginBottom: 10 }}>
            To reach <strong style={{ fontWeight: 600 }}>{pct(data.next!.bps)}</strong>:{' '}
            {gapPhrase(data, c)}
          </div>
          <ProgressBar label={`${c.activityNoun} volume`} value={data.volumeCents} target={data.next!.minVolumeCents} valueLabel={`${formatCents(data.volumeCents)} / ${formatCents(data.next!.minVolumeCents)}`} />
          <div style={{ height: 8 }} />
          <ProgressBar label={c.countNoun} value={data.orderCount} target={data.next!.minOrders} valueLabel={`${data.orderCount} / ${data.next!.minOrders}`} />
        </div>
      )}

      {/* Expiring-volume warning */}
      {data.willDropTier && (
        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 2,
          background: 'var(--color-warn-bg, #fdf6e3)', border: '1px solid var(--color-warn-line, #e8d9a8)',
          fontSize: 12, lineHeight: 1.5, color: 'var(--color-warn-ink, #6b5a1e)',
        }}>
          {formatCents(data.expiringVolumeCents)} in {c.activityNoun} and {data.expiringOrderCount}{' '}
          {data.expiringOrderCount === 1 ? c.countNoun.replace(/s$/, '') : c.countNoun} roll out of your
          12-month window in the next 14 days. Without new {c.activityNoun}, your rate would move to{' '}
          <strong style={{ fontWeight: 600 }}>{pct(data.projectedBps)}</strong>.
          {data.locked && data.lockedUntilMs != null && (
            <> Your locked {pct(data.effectiveBps)} holds until {shortDate(data.lockedUntilMs)}.</>
          )}
        </div>
      )}
    </div>
  )
}

/** "$X more in sales and N more orders" — only the gates not yet met. */
function gapPhrase(d: SideDashboard, c: Copy): string {
  const parts: string[] = []
  if (d.volumeToNextCents > 0) parts.push(`${formatCents(d.volumeToNextCents)} more in ${c.activityNoun}`)
  if (d.ordersToNext > 0) parts.push(`${d.ordersToNext} more ${d.ordersToNext === 1 ? c.countNoun.replace(/s$/, '') : c.countNoun}`)
  if (parts.length === 0) return 'maintain your current activity'
  return parts.join(' and ')
}

function ProgressBar({ label, value, target, valueLabel }: { label: string; value: number; target: number; valueLabel: string }) {
  const frac = target <= 0 ? 1 : Math.min(1, value / target)
  const met = value >= target
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: SOFT, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{valueLabel}</span>
      </div>
      <div style={{ height: 6, background: LINE, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${frac * 100}%`, height: '100%',
          background: met ? 'var(--color-accent)' : INK,
          transition: 'width 200ms linear',
        }} />
      </div>
    </div>
  )
}
