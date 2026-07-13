import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import { PHOTO_SLOTS } from '@/lib/condition'
import AdminActions from './admin-actions'

export const metadata = { title: 'Admin — Review Queue' }

export default async function AdminQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Fetch pending_review listings with seller info
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id, title, brand, category, size, condition_score,
      price_cents, images, possession_photo_url, created_at,
      seller_id,
      profiles:seller_id (username)
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/queue] fetch error:', error)
  }

  const items = listings ?? []

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 40px' }}>
        <Link href="/" style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'none' }}>←</Link>
        <span style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)' }}>
          Review Queue — {items.length} pending
        </span>
      </header>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 40px 80px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink-soft)' }}>
            QUEUE EMPTY
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {items.map((listing) => {
              const seller = (listing.profiles as unknown) as { username: string } | null
              const images: string[] = Array.isArray(listing.images) ? listing.images : []
              const ago = new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

              return (
                <div key={listing.id} style={{ border: '1px solid var(--color-line)', borderRadius: '2px', overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>{listing.title}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>{listing.brand} · {listing.category} · {listing.size}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>CONDITION {listing.condition_score}/10</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>{formatCents(listing.price_cents)}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>@{seller?.username ?? '?'} · {ago}</span>
                  </div>

                  {/* Photos row */}
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                    {PHOTO_SLOTS.map((slot, idx) => {
                      const url = images[idx]
                      const isPossession = slot === 'POSSESSION'
                      return (
                        <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ position: 'relative', aspectRatio: '3/4', border: '1px solid var(--color-line)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-ink-soft)' }}>—</span>
                            )}
                            {isPossession && url && (
                              <span style={{ position: 'absolute', top: '4px', left: '4px', width: '16px', height: '16px', background: 'var(--color-accent)', borderRadius: '2px', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                            )}
                          </div>
                          <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textAlign: 'center' }}>
                            {slot.charAt(0) + slot.slice(1).toLowerCase()}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Actions */}
                  <AdminActions listingId={listing.id} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
