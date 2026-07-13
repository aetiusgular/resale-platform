import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/enter')

  const { data } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .single()
  const profile = data as Pick<Tables<'profiles'>, 'username' | 'role'> | null

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          font: '600 16px var(--font-ui)',
          letterSpacing: '0.08em',
          color: 'var(--color-ink)',
        }}
      >
        ———
      </span>
      <p
        style={{
          marginTop: '24px',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: '24px',
          lineHeight: 1.35,
          color: 'var(--color-ink)',
        }}
      >
        The archive is coming.
      </p>
      <div
        style={{
          marginTop: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: 'var(--color-ink-soft)',
          textTransform: 'uppercase',
        }}
      >
        @{profile?.username ?? user.email} · M2 COMING SOON
      </div>

      <form action="/api/auth/logout" method="POST" style={{ marginTop: '40px' }}>
        <button
          type="submit"
          style={{
            height: '44px',
            padding: '0 24px',
            background: 'var(--color-bg)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-ink)',
            borderRadius: '2px',
            font: '500 13px var(--font-ui)',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
