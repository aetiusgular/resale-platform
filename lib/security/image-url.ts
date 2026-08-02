/**
 * Image-URL allowlist — PURE (no I/O, no sharp), so it is shared by the SSRF fetch guard
 * (lib/image-hash) AND the listing-create store guard, and is unit-testable in isolation.
 *
 * A listing image URL is trusted iff it is HTTPS and lives on the project's Supabase Storage
 * host. This blocks (a) SSRF against internal metadata/VPC hosts at hash time, and (b) storing
 * off-platform / attacker-controlled URLs that later render in <img src> on browse/detail.
 */

/** The configured Supabase host (images live under Storage on this host), or '' if unset. */
export function storageHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return ''
  }
}

/** True iff `url` is HTTPS and on `allowedHost`. Empty allowedHost ⇒ nothing is allowed. */
export function isAllowedImageUrl(url: string, allowedHost: string): boolean {
  if (!allowedHost) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return parsed.protocol === 'https:' && parsed.hostname === allowedHost
}

/**
 * True iff every non-empty URL passes the allowlist. Empty strings (unfilled photo slots) are
 * skipped. An empty list is vacuously true.
 */
export function allImageUrlsAllowed(urls: readonly string[], allowedHost: string): boolean {
  return urls.filter((u) => typeof u === 'string' && u.trim()).every((u) => isAllowedImageUrl(u, allowedHost))
}
