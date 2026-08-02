/**
 * Collusion / self-dealing detection — PURE. No DB, no I/O.
 *
 * Compares the two parties to a transaction (buyer vs seller) on identity + payment signals
 * that a genuine arm's-length trade would not share. Feeds a pre-payout hold that extends the
 * G6 moderation spine (a match → flag + hold the transfer for review, never auto-release).
 * Signals are gathered by the caller from Stripe (card `fingerprint` on payment methods,
 * bank `fingerprint` on external accounts, billing name/zip) and the order (ship-to address
 * vs the seller's origin). Keeping this pure means the same rule backs the payout gate, the
 * admin console, and tests, with no drift.
 */
export type PartySignals = {
  cardFingerprints?: string[]   // Stripe card fingerprints on the user's payment methods
  bankFingerprints?: string[]   // Stripe external-account (bank) fingerprints
  billingName?: string | null
  billingZip?: string | null
  addresses?: string[]          // normalized address strings (ship-to / origin)
}

export type CollusionReason = 'shared_bank' | 'shared_card' | 'shared_billing_identity' | 'ship_to_self'

export type CollusionResult = { flagged: boolean; reasons: CollusionReason[] }

const norm = (s?: string | null): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

function overlaps(a?: string[], b?: string[]): boolean {
  const setB = new Set((b ?? []).map((x) => x.trim()).filter(Boolean))
  return (a ?? []).some((x) => x.trim() !== '' && setB.has(x.trim()))
}

/**
 * Evaluate buyer vs seller for collusion signals. Fingerprints are exact-match (Stripe's
 * `fingerprint` is stable per instrument); billing identity requires BOTH name and zip to
 * match (either alone is too weak); ship-to-self matches a normalized address on both sides.
 */
export function evaluateCollusion(buyer: PartySignals, seller: PartySignals): CollusionResult {
  const reasons: CollusionReason[] = []

  if (overlaps(buyer.bankFingerprints, seller.bankFingerprints)) reasons.push('shared_bank')
  if (overlaps(buyer.cardFingerprints, seller.cardFingerprints)) reasons.push('shared_card')

  const bn = norm(buyer.billingName), sn = norm(seller.billingName)
  const bz = norm(buyer.billingZip), sz = norm(seller.billingZip)
  if (bn !== '' && bn === sn && bz !== '' && bz === sz) reasons.push('shared_billing_identity')

  const buyerAddrs = new Set((buyer.addresses ?? []).map(norm).filter((a) => a !== ''))
  if ((seller.addresses ?? []).map(norm).some((a) => a !== '' && buyerAddrs.has(a))) reasons.push('ship_to_self')

  return { flagged: reasons.length > 0, reasons }
}

export function collusionFlagged(buyer: PartySignals, seller: PartySignals): boolean {
  return evaluateCollusion(buyer, seller).flagged
}
