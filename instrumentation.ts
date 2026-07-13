/**
 * Next.js instrumentation file.
 * Initialises Sentry on server and edge runtimes.
 * No-ops when SENTRY_DSN is not set.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.user) {
          delete event.user.email
          delete event.user.username
          delete event.user.ip_address
        }
        if (event.extra) {
          delete event.extra.shippingAddress
          delete event.extra.email
        }
        return event
      },
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
    })
  }
}
