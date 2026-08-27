/**
 * Site identity + URL helpers for SEO surfaces (metadata, JSON-LD, sitemap,
 * robots, manifest).
 *
 * SITE_NAME is the ONE swap point for the final platform name (TBD at alpha) —
 * layout titles, og:site_name, manifest, and schema.org all read from here.
 */

export const SITE_NAME = 'Resale Platform'

export const SITE_TAGLINE = 'Curated secondhand fashion marketplace'

/** Canonical origin. Same convention as lib/stripe.ts appBase(). */
export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

/** Absolute URL for a path ('/listings/x' → 'https://…/listings/x'). */
export function absUrl(path: string): string {
  return `${baseUrl()}${path}`
}
