import { ANTISLOP } from './antislop-config'

export type LintSeverity = 'reject' | 'warn'

export interface LintViolation {
  severity: LintSeverity
  message: string
  /** Machine-readable code for flagging type in listing_flags */
  code: 'blocked_pattern' | 'brand_stuffing_title' | 'brand_stuffing_desc'
}

/**
 * Lint a listing's title and description.
 * Returns all violations found. Empty array = clean.
 *
 * - 'reject' violations must block submit (400 response with inline error).
 * - 'warn' violations allow submit but produce a listing_flag (type 'keyword_stuffing').
 */
export function lintListing(title: string, description: string): LintViolation[] {
  const violations: LintViolation[] = []
  const combined = `${title} ${description}`

  // ── Blocked patterns (hard reject) ────────────────────────────────────────
  for (const pattern of ANTISLOP.BLOCKED_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push({
        severity: 'reject',
        code: 'blocked_pattern',
        message: 'Listing contains prohibited contact info or off-platform payment method.',
      })
      break // one reject is sufficient
    }
  }

  // ── Brand stuffing in title (warn) ────────────────────────────────────────
  const titleUpper = title.toUpperCase()
  const titleBrands = ANTISLOP.BRANDS.filter(b => titleUpper.includes(b))
  if (titleBrands.length > ANTISLOP.BRAND_TITLE_MAX) {
    violations.push({
      severity: 'warn',
      code: 'brand_stuffing_title',
      message: `Title references ${titleBrands.length} brands (limit ${ANTISLOP.BRAND_TITLE_MAX}): ${titleBrands.join(', ')}.`,
    })
  }

  // ── Brand stuffing in description (warn) ──────────────────────────────────
  const descUpper = description.toUpperCase()
  const descBrands = ANTISLOP.BRANDS.filter(b => descUpper.includes(b))
  if (descBrands.length > ANTISLOP.BRAND_DESC_MAX) {
    violations.push({
      severity: 'warn',
      code: 'brand_stuffing_desc',
      message: `Description references ${descBrands.length} brands (limit ${ANTISLOP.BRAND_DESC_MAX}): ${descBrands.join(', ')}.`,
    })
  }

  return violations
}
