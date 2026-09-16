'use client'

/**
 * ShellSwitch — mounts the persistent site header from the root layout so it
 * survives client navigations (only the page below it re-renders / skeleton-loads).
 * Auth and onboarding routes draw their own frame (auth-frame.tsx), so they get
 * the bare children. The `header` slot is a server-rendered element passed down
 * from app/layout.tsx; it is created once per request and reused across routes.
 */
import { usePathname } from 'next/navigation'
import ProtoHeader from '@/app/styleguide/proto/proto-header'
import { isProtoPath } from '@/app/proto/viewer-fixture'

const BARE_PREFIXES = ['/enter', '/onboarding', '/reset-password', '/banned']

export default function ShellSwitch({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (bare) return <>{children}</>
  // The proto tour draws the signed-in chrome from fixtures (proto-header.tsx) so the
  // walkthrough shows a member's header and its links stay inside /styleguide/proto.
  // Display only — the real header, and every route gate, is untouched.
  return (
    <div className="app-shell">
      {isProtoPath(pathname) ? <ProtoHeader key="proto-header" /> : header}
      {children}
    </div>
  )
}
