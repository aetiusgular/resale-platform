'use client'

/**
 * In-app notification bell (G2). Mounts in the header only when NOTIFICATIONS_ENABLED
 * (gated by the server SiteHeader). Fetches recent notifications + unread count, shows a
 * badge, and a dropdown list; clicking an item marks it read and follows its deep link.
 * setState happens inside async callbacks (not synchronously in the effect body), so it
 * does not trip react-hooks/set-state-in-effect.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; type: string; title: string; body: string; url: string | null; read_at: string | null; created_at: string }

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { items: [], unread: 0 }))
      .then((d) => { if (!cancelled) { setItems(d.items ?? []); setUnread(d.unread ?? 0) } })
      .catch(() => { /* fail-soft: no bell content */ })
    return () => { cancelled = true }
  }, [])

  const markAll = async () => {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
  }

  const openItem = async (n: Item) => {
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1))
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {})
    }
    setOpen(false)
    if (n.url) router.push(n.url)
  }

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        style={{ position: 'relative', width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-ink)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', background: 'var(--color-accent)', color: 'var(--color-bg)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden="true" />
          <div style={{ position: 'absolute', top: 48, right: 0, width: 340, maxHeight: 440, overflowY: 'auto', background: 'var(--color-bg)', border: '1px solid var(--color-line)', borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 41 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-line)' }}>
              <span style={{ font: '600 13px var(--font-ui)', color: 'var(--color-ink)' }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)', textDecoration: 'underline' }}>Mark all read</button>
              )}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: '24px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center' }}>No notifications yet</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--color-line)', background: n.read_at ? 'var(--color-bg)' : 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))', border: 'none', borderLeft: n.read_at ? '2px solid transparent' : '2px solid var(--color-accent)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ font: '600 13px var(--font-ui)', color: 'var(--color-ink)' }}>{n.title}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-ink-soft)' }}>{timeAgo(n.created_at)}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.4 }}>{n.body}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
