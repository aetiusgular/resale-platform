// ─── Anti-slop configuration ─────────────────────────────────────────────────
// All threshold values live here. Import from this file — never hardcode.

export const ANTISLOP = {
  // Perceptual hash duplicate detection
  DUPLICATE_DISTANCE_THRESHOLD: 8,   // max Hamming distance to consider "same" image
  DUPLICATE_MIN_SLOT_MATCHES: 2,     // min matching slots to flag as duplicate suspect

  // Brand-stuffing thresholds
  BRAND_TITLE_MAX: 2,   // >2 distinct brands in title = keyword_stuffing warn
  BRAND_DESC_MAX: 4,    // >4 distinct brands in description = keyword_stuffing warn

  // Velocity limits for new accounts
  VELOCITY_WINDOW_DAYS: 30,   // accounts younger than this (days) are rate-limited
  VELOCITY_DAILY_LIMIT: 5,    // max listings per day for new accounts

  // ~40 luxury / streetwear brand names (uppercase; compared case-insensitively)
  BRANDS: [
    'GUCCI', 'PRADA', 'LOUIS VUITTON', 'CHANEL', 'DIOR', 'VERSACE',
    'BURBERRY', 'BALENCIAGA', 'OFF-WHITE', 'SUPREME', 'BAPE', 'STUSSY',
    'PALACE', 'KITH', 'FEAR OF GOD', 'ESSENTIALS', 'RICK OWENS',
    "ARC'TERYX", 'STONE ISLAND', 'CP COMPANY', 'MONCLER', 'CANADA GOOSE',
    'THE NORTH FACE', 'NIKE', 'ADIDAS', 'NEW BALANCE', 'ASICS',
    'BOTTEGA VENETA', 'CELINE', 'SAINT LAURENT', 'GIVENCHY', 'FENDI',
    'VALENTINO', 'LOEWE', 'JACQUEMUS', 'AMIRI', 'GALLERY DEPT',
    'CHROME HEARTS', 'RHUDE', 'PALM ANGELS', 'ACNE STUDIOS',
    'MAISON MARGIELA', 'VETEMENTS',
  ],

  // Blocked patterns — any match = hard reject at submit
  BLOCKED_PATTERNS: [
    /\bdm\s+me\b/i,
    /\bpaypal\s+f(&|and)\s*f\b/i,
    /\bpaypal\s+friends\s*(&|and)\s*family\b/i,
    /\btelegram\b/i,
    /\bwhatsapp\b/i,
    /\bvenmo\b/i,
    /\bcash\s*app\b/i,
    /\bwire\s+transfer\b/i,
    /t\.me\//i,
    /wa\.me\//i,
  ],
}

// TODO(B8/PA): Reverse-image stock-photo detection via external API.
// External reverse-image search (Google Vision API / TinEye) would be called
// during listing submission to reject stock photos without a real item photo.
// Not in scope for B3 — external APIs cost money; deferred to B8/PA.
// Stub: export async function detectStockPhoto(imageUrl: string): Promise<boolean>
