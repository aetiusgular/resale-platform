/**
 * /admin/metrics — Platform health dashboard
 * Admin-gated. Reads from DB views (admin_metrics_* created in migration 000012).
 * Uses service_role client for cross-RLS aggregates.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'

export const metadata = { title: 'Admin — Metrics' }
export const revalidate = 300 // refresh every 5 min in prod

export default async function AdminMetricsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const service = createServiceClientRaw()

  // ── Listing counts by status ─────────────────────────────────────────────
  const { data: listingStatusRows } = await service
    .from('listings')
    .select('status')

  const listingsByStatus: Record<string, number> = {}
  for (const row of listingStatusRows ?? []) {
    listingsByStatus[row.status] = (listingsByStatus[row.status] ?? 0) + 1
  }

  // ── GMV: sum of released orders ─────────────────────────────────────────
  const { data: gmvData } = await service
    .from('orders')
    .select('transfer_cents')
    .eq('state', 'released')

  const gmvCents = (gmvData ?? []).reduce((sum, o) => sum + (o.transfer_cents ?? 0), 0)

  // ── Orders by state ──────────────────────────────────────────────────────
  const { data: orderRows } = await service
    .from('orders')
    .select('state')

  const ordersByState: Record<string, number> = {}
  for (const row of orderRows ?? []) {
    ordersByState[row.state] = (ordersByState[row.state] ?? 0) + 1
  }

  const totalOrders = Object.values(ordersByState).reduce((a, b) => a + b, 0)
  const disputeOrders = (ordersByState['disputed'] ?? 0) + (ordersByState['dispute_resolved'] ?? 0)
  const disputeRate = totalOrders > 0 ? ((disputeOrders / totalOrders) * 100).toFixed(1) : '0.0'

  // ── Signups by day (last 14 days) ───────────────────────────────────────
  // eslint-disable-next-line react-hooks/purity -- server component: evaluated once per request, not a client render
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: signupRows } = await service
    .from('profiles')
    .select('created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })

  const signupsByDay: Record<string, number> = {}
  for (const row of signupRows ?? []) {
    const day = row.created_at.slice(0, 10)
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
  }
  const totalSignups = (signupRows ?? []).length

  return (
    <div style={{ fontFamily: 'var(--font-mono)', padding: '32px', maxWidth: '960px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '32px' }}>Platform Metrics</h1>

      {/* GMV */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Revenue
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
          <Stat label="GMV (released)" value={formatCents(gmvCents)} />
          <Stat label="Total orders" value={String(totalOrders)} />
          <Stat label="Dispute rate" value={`${disputeRate}%`} />
        </div>
      </section>

      {/* Listings */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Listings
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {(['active','pending_review','sold','removed','pending_escrow'] as const).map(s => (
            <Stat key={s} label={s} value={String(listingsByStatus[s] ?? 0)} />
          ))}
        </div>
      </section>

      {/* Orders */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Orders by state
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {Object.entries(ordersByState).map(([state, count]) => (
            <Stat key={state} label={state} value={String(count)} />
          ))}
        </div>
      </section>

      {/* Signups */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Signups (last 14 days)
        </h2>
        <p style={{ fontSize: '28px', marginBottom: '12px' }}>{totalSignups}</p>
        <table style={{ fontSize: '12px', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {Object.entries(signupsByDay).map(([day, count]) => (
              <tr key={day}>
                <td style={{ padding: '4px 8px 4px 0', color: '#666' }}>{day}</td>
                <td style={{ padding: '4px 8px' }}>{count}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ display: 'inline-block', height: '8px', background: '#1a1a1a', width: `${Math.min(count * 12, 200)}px` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e5e5e5', padding: '16px', borderRadius: '2px' }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}
