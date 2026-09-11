'use client'

/**
 * ShellSwitch — mounts the persistent site header from the root layout so it
 * survives client navigations (only the page below it re-renders / skeleton-loads).
 * Auth and onboarding routes draw their own frame (auth-frame.tsx), so they get
 * the bare children. The `header` slot is a server-rendered element passed down
 * from app/layout.tsx; it is created once per request and reused across routes.
 */
import { usePathname } from 'next/navigation'

const BARE_PREFIXES = ['/enter', '/onboarding', '/reset-password', '/banned']

export default function ShellSwitch({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (bare) return <>{children}</>
  return (
    <div className="app-shell">
      {header}
      {children}
    </div>
  )
}
