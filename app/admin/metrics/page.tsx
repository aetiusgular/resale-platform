/**
 * /admin/metrics — Platform health dashboard
 * Admin-gated. Reads from DB views (admin_metrics_* created in migration 000012).
 * Uses service_role client for cross-RLS aggregates.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import AdminFrame from '../admin-frame'

export const metadata = { title: 'Admin — Metrics', robots: { index: false, follow: false } }
export const revalidate = 300 // refresh every 5 min in prod

export default async function AdminMetricsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')
  const username = (profile?.username as string) ?? ''

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

  const maxSignups = Math.max(1, ...Object.values(signupsByDay))

  return (
    <AdminFrame username={username} section="metrics" title="Platform metrics." note="REFRESHES EVERY 5 MIN">
      <section>
        <div className="sec-head"><span className="sec-head__label">REVENUE</span><span className="page-note">RELEASED ORDERS ONLY</span></div>
        <div className="stat-grid">
          <Stat label="GMV (released)" value={formatCents(gmvCents)} />
          <Stat label="Total orders" value={String(totalOrders)} />
          <Stat label="Dispute rate" value={`${disputeRate}%`} />
        </div>
      </section>

      <section>
        <div className="sec-head"><span className="sec-head__label">LISTINGS</span><span className="page-note">BY STATUS</span></div>
        <div className="stat-grid">
          {(['active','pending_review','sold','removed','pending_escrow'] as const).map(s => (
            <Stat key={s} label={s.replace('_', ' ')} value={String(listingsByStatus[s] ?? 0)} />
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head"><span className="sec-head__label">ORDERS</span><span className="page-note">BY STATE</span></div>
        {Object.keys(ordersByState).length === 0 ? (
          <div className="admin-empty">NO ORDERS YET</div>
        ) : (
          <div className="stat-grid">
            {Object.entries(ordersByState).map(([state, count]) => (
              <Stat key={state} label={state.replace(/_/g, ' ')} value={String(count)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="sec-head"><span className="sec-head__label">SIGNUPS</span><span className="page-note">LAST 14 DAYS · {totalSignups} TOTAL</span></div>
        {Object.keys(signupsByDay).length === 0 ? (
          <div className="admin-empty">NO SIGNUPS IN THE LAST 14 DAYS</div>
        ) : (
          <div style={{ overflowX: 'auto', paddingTop: 8 }}>
            <table className="admin-table">
              <thead>
                <tr><th style={{ width: 120 }}>DAY</th><th style={{ width: 60 }}>COUNT</th><th>&nbsp;</th></tr>
              </thead>
              <tbody>
                {Object.entries(signupsByDay).map(([day, count]) => (
                  <tr key={day}>
                    <td>{day}</td>
                    <td style={{ color: 'var(--ink)', fontWeight: 400 }}>{count}</td>
                    <td><span className="bar" style={{ width: `${Math.max(4, Math.round((count / maxSignups) * 240))}px` }} aria-hidden="true" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminFrame>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat__k">{label}</div>
      <div className="stat__v">{value}</div>
    </div>
  )
}
