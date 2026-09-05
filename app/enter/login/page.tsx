import type { Metadata } from 'next'
import { AuthPage } from '@/app/components/auth-frame'
import LoginForm from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

/**
 * /enter/login — full-page sign in (design 1E). The auth modal is the primary path.
 * `?error=oauth&reason=` (set by the OAuth callback) is read here on the server
 * and handed to the form as its initial error, so no effect has to parse the URL.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const { error, reason } = await searchParams
  const oauthError =
    error === 'oauth'
      ? (typeof reason === 'string' && reason ? `Google sign-in failed: ${reason}` : 'Google sign-in failed — please try again.')
      : null
  return (
    <AuthPage cta={{ href: '/enter', label: 'NEW HERE? CREATE ACCOUNT →' }}>
      <LoginForm initialError={oauthError} />
    </AuthPage>
  )
}
