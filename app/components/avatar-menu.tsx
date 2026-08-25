'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

interface Props {
  username: string
  initials: string
}

export default function AvatarMenu({ username, initials }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    router.push('/enter')
    router.refresh()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="avatar-btn"
        style={{
          width: '44px', height: '44px', borderRadius: '0',
          border: 'none',
          background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
        aria-label="Account menu"
      >
        <span style={{
          width: '32px', height: '32px', borderRadius: '50%',
          border: '1px solid var(--color-line)', background: 'var(--color-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)',
        }}>
          {initials}
        </span>
      </button>

      {open && (
        <div
          data-testid="avatar-menu"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: '180px', background: 'var(--color-bg)',
            border: '1px solid var(--color-ink)', borderRadius: '2px',
            zIndex: 50,
          }}
        >
          {[
            { label: 'PROFILE', href: `/sellers/${username}` },
            { label: 'ORDERS', href: '/orders' },
            { label: 'SETTINGS', href: '/settings' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block', padding: '12px 16px',
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.08em', color: 'var(--color-ink)',
                textDecoration: 'none', borderBottom: '1px solid var(--color-line)',
              }}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            style={{
              display: 'block', width: '100%', padding: '12px 16px',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              letterSpacing: '0.08em', color: 'var(--color-ink)',
              textAlign: 'left', background: 'none', border: 'none',
              cursor: 'pointer',
            }}
          >
            LOG OUT
          </button>
        </div>
      )}
    </div>
  )
}
