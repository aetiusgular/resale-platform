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

// Near-duplicate detection runs on the DB-side Hamming index (`similar_image_hashes`,
// migration 0053) since visual search P1; the old JS scan + its 5,000-row cap are gone.
// Stock-photo detection against the open web stays out of scope (no external reverse-image
// API in the listing path: cost, and photos would leave the platform). In-catalogue reuse of
// another seller's photos is what the hash index catches.
