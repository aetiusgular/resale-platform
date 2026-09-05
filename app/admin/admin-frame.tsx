/**
 * AdminFrame — shared chrome for the admin console (/admin/queue, /admin/moderation,
 * /admin/metrics): the normal AppShell header plus a ruled page head and a
 * section tab row. Server-safe (no client JS).
 */
import Link from 'next/link'
import AppShell from '@/app/components/app-shell'

export type AdminSection = 'queue' | 'moderation' | 'metrics'

const SECTIONS: Array<{ key: AdminSection; href: string; label: string }> = [
  { key: 'queue', href: '/admin/queue', label: 'REVIEW QUEUE' },
  { key: 'moderation', href: '/admin/moderation', label: 'MODERATION' },
  { key: 'metrics', href: '/admin/metrics', label: 'METRICS' },
]

interface Props {
  username: string
  section: AdminSection
  title: string
  note?: string
  children: React.ReactNode
}

export default function AdminFrame({ username, section, title, note, children }: Props) {
  return (
    <AppShell username={username} footer={false}>
      <main className="page-main page-main--wide">
        <div className="crumb">ADMIN / {SECTIONS.find((s) => s.key === section)?.label}</div>
        <div className="page-head page-head--ruled">
          <h1 className="page-title">{title}</h1>
          {note && <span className="page-note">{note}</span>}
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {SECTIONS.map((s) => (
            <Link key={s.key} href={s.href} className={s.key === section ? 'is-active' : undefined} aria-current={s.key === section ? 'page' : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </AppShell>
  )
}

/** Short mono date+time for audit rows and flags. */
export function stamp(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  )
}
