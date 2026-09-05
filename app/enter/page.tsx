import type { Metadata } from 'next'
import { SITE_TAGLINE } from '@/lib/seo'
import { AuthSplit } from '@/app/components/auth-frame'
import SignupForm from './signup-form'

/**
 * /enter — public signup (reference SignupPage, option 1A): hero + email/password
 * form. Open signup (G13): the username is derived from the email and the new
 * member lands straight in browse.
 */
export const metadata: Metadata = {
  title: 'Create account',
  description: SITE_TAGLINE,
  alternates: { canonical: '/enter' },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function EnterPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/browse'
  return (
    <AuthSplit>
      <SignupForm next={safeNext} />
    </AuthSplit>
  )
}
