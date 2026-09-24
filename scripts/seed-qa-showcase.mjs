/**
 * QA showcase seed — builds a complete, realistic interaction world around the test buyer
 * (TEST_BUYER_EMAIL, default e2e-buyer@test.local) on the HOSTED Supabase project so testers
 * can see every state the product has: listings with 3–7 photos (active / sold / draft / in
 * review / removed / boosted / price-dropped / international), chats with offers in every
 * state (open, countered, accepted, declined, expired, voided), orders in every state on both
 * sides (paid_held → seller_confirmed → shipped → delivered → released / disputed / refunded /
 * cancelled), saves + saved searches + follows, Legit Check threads, measurement requests,
 * reviews, notifications, and a seller-tier history that puts the test user in Tier 2 with an
 * expiring-volume warning.
 *
 * Photos are the AGMNT Store product shots listed in scripts/seed-qa-photos.json (owner's own
 * e-commerce photography), re-uploaded to the product-images bucket (CSP only allows Supabase
 * image hosts). Each listing gets ≥3 photos; where a product has only two shots, detail crops
 * are cut from them with sharp.
 *
 * DEV/STAGING ONLY — refuses to run with NODE_ENV=production (same guard as the other seeds).
 * Self-loads .env.local (no shell `source` needed). Run natively on the Mac (needs network):
 *
 *   node scripts/seed-qa-showcase.mjs               # wipe previous seed rows + seed everything
 *   node scripts/seed-qa-showcase.mjs --skip-images # same, reuse photos uploaded by a prior run
 *   node scripts/seed-qa-showcase.mjs --wipe        # remove everything this seed created
 *   node scripts/seed-qa-showcase.mjs --wipe --wipe-users   # …and delete the qa-* accounts
 *   node scripts/seed-qa-showcase.mjs --dry         # build the fixture set, print counts, no network
 *
 * Every row this script writes has a DETERMINISTIC id (uuid5-style hash of a fixture key), so
 * re-running is idempotent: the wipe step deletes exactly the rows a previous run created, then
 * everything is inserted fresh. The e2e-buyer account itself is never deleted and its password
 * is never touched (TEST_BUYER_PASSWORD in .env.local stays valid). The qa-* personas share ONE
 * password, kept in .env.qa.local (gitignored, generated on first run) and printed at the end.
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ─── args + env ───────────────────────────────────────────────────────────────
const ARGS = new Set(process.argv.slice(2))
const DRY = ARGS.has('--dry')
const WIPE_ONLY = ARGS.has('--wipe')
const WIPE_USERS = ARGS.has('--wipe-users')
const SKIP_IMAGES = ARGS.has('--skip-images')

function loadEnv(file) {
  if (!existsSync(file)) return false
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trimStart().startsWith('#')) continue
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
  return true
}
if (!DRY && !loadEnv('.env.local')) { console.error('Run from the repo root (no .env.local found).'); process.exit(1) }
loadEnv('.env.qa.local')

if (process.env.NODE_ENV === 'production') { console.error('Refusing to run against production (NODE_ENV=production).'); process.exit(1) }

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'e2e-buyer@test.local'
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'e2e-admin@test.local'
const SELLER_EMAIL = process.env.TEST_SELLER_EMAIL || null // owns the Stripe test Connect account
const BUCKET = 'product-images'
if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1) }

// ─── helpers ──────────────────────────────────────────────────────────────────
const NS = 'archive-qa-showcase-v1'
/** Deterministic uuid (v5-shaped) from a fixture key — the idempotency anchor for every row. */
function uid(key) {
  const h = createHash('sha1').update(`${NS}:${key}`).digest('hex')
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const NOW = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR
/** ISO timestamp `d` days (+ `h` hours) ago. */
const ago = (d, h = 0) => new Date(NOW - d * DAY - h * HOUR).toISOString()
/** ISO timestamp `d` days (+ `h` hours) from now. */
const ahead = (d, h = 0) => new Date(NOW + d * DAY + h * HOUR).toISOString()
const dollars = (c) => `$${(c / 100).toFixed(2)}`
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }

// Fee model (mirrors lib/fees.ts — kept in sync by hand; display-only seed data).
const FIXED_FEE_CENTS = 30
const STRIPE_PCT_BPS = 290
const SMALL_ORDER_THRESHOLD = 10_000
const SMALL_ORDER_CAP_BPS = 500
const feeAt = (cents, bps) => Math.round(cents * bps / 10000)
function orderAmounts({ item, feeMode, tierBps, shipping, labelMode }) {
  let sellerFee
  if (feeMode === 'welcome') sellerFee = Math.min(item, feeAt(item, STRIPE_PCT_BPS) + FIXED_FEE_CENTS)
  else {
    const eff = item < SMALL_ORDER_THRESHOLD ? Math.min(tierBps, SMALL_ORDER_CAP_BPS) : tierBps
    sellerFee = Math.min(item, feeAt(item, eff) + FIXED_FEE_CENTS)
  }
  const transfer = item - sellerFee + (labelMode === 'seller' ? shipping : 0)
  return {
    item_cents: item, buyer_fee_cents: 0, buyer_fee_bps: 0,
    seller_fee_cents: sellerFee, seller_fee_bps: feeMode === 'welcome' ? STRIPE_PCT_BPS : tierBps,
    shipping_cents: shipping, discount_cents: 0, total_cents: item + shipping, transfer_cents: transfer,
  }
}
// Category shipping floors + $2 margin (lib/shipping.ts) — what a US→US buyer pays.
const SHIP_FLOOR = { Tops: 700, Sportswear: 800, Bottoms: 900, Denim: 1000, Knitwear: 1100, Accessories: 1200, Tailoring: 1400, Outerwear: 1500, Footwear: 2000, Other: 2000 }
const domesticShipping = (category) => (SHIP_FLOOR[category] ?? 2000) + 200

// ─── cast ─────────────────────────────────────────────────────────────────────
// e2e = the tester's account (exists already). The qa-* personas are created on demand.
const PEOPLE = [
  { key: 'mara',   email: 'qa-mara@test.local',   username: 'mara_lindqvist', display: 'Mara Lindqvist', verified: true, payouts: true,  addr: { name: 'Mara Lindqvist', street1: '2210 Hyperion Ave', street2: 'Apt 4', city: 'Los Angeles', state: 'CA', zip: '90027', country: 'US' }, sizes: { 'womenswear:tops': ['S/4/40'], 'womenswear:outerwear': ['S/4/40'], 'womenswear:footwear': ['8'] } },
  { key: 'theo',   email: 'qa-theo@test.local',   username: 'theo_nakamura',  display: 'Theo Nakamura',  verified: true, payouts: true,  addr: { name: 'Theo Nakamura', street1: '188 Kent Ave', street2: null, city: 'Brooklyn', state: 'NY', zip: '11249', country: 'US' }, sizes: { 'menswear:tops': ['M'], 'menswear:bottoms': ['31', '32'], 'menswear:outerwear': ['M'], 'menswear:footwear': ['10'] } },
  { key: 'ines',   email: 'qa-ines@test.local',   username: 'ines_roca',      display: 'Inés Roca',      verified: true, payouts: false, addr: { name: 'Inés Roca', street1: '55 Mercer St', street2: 'Unit 1802', city: 'Toronto', state: 'ON', zip: 'M5V 3W2', country: 'CA' }, sizes: { 'womenswear:tops': ['XS/0-2/36-38'], 'womenswear:bottoms': ['26/2/38'] } },
  { key: 'kenji',  email: 'qa-kenji@test.local',  username: 'kenji_ito',      display: 'Kenji Ito',      verified: true, payouts: true,  addr: { name: 'Kenji Ito', street1: '4-21-3 Jingumae', street2: 'Shibuya-ku', city: 'Tokyo', state: 'Tokyo', zip: '150-0001', country: 'JP' }, sizes: { 'menswear:tops': ['S'], 'menswear:bottoms': ['30'], 'menswear:footwear': ['9'] } },
  { key: 'priya',  email: 'qa-priya@test.local',  username: 'priya_venkat',   display: 'Priya Venkat',   verified: true, payouts: true,  moderator: true, addr: { name: 'Priya Venkat', street1: '1450 N Damen Ave', street2: null, city: 'Chicago', state: 'IL', zip: '60622', country: 'US' }, sizes: { 'womenswear:tops': ['M/6-8/42-44'], 'womenswear:dresses': ['M/6-8/42-44'] } },
  { key: 'lowell', email: 'qa-lowell@test.local', username: 'lowell_grant',   display: 'Lowell Grant',   verified: true, payouts: true,  addr: { name: 'Lowell Grant', street1: '901 E 6th St', street2: null, city: 'Austin', state: 'TX', zip: '78702', country: 'US' }, sizes: { 'menswear:tops': ['L'], 'menswear:bottoms': ['33'], 'menswear:outerwear': ['L'], 'menswear:footwear': ['11'] } },
]
const E2E = {
  key: 'e2e', display: 'Tester', verified: true,
  addr: { name: 'QA Tester', street1: '1188 Bird Ave', street2: null, city: 'San Jose', state: 'CA', zip: '95125', country: 'US' },
  addr2: { name: 'QA Tester', street1: '2120 Shattuck Ave', street2: 'Suite 200', city: 'Berkeley', state: 'CA', zip: '94704', country: 'US' },
  sizes: { 'menswear:tops': ['M'], 'menswear:bottoms': ['31', '32'], 'menswear:outerwear': ['M', 'L'], 'menswear:footwear': ['9.5', '10'] },
}

// ─── photos ───────────────────────────────────────────────────────────────────
const PHOTOS = JSON.parse(readFileSync(new URL('./seed-qa-photos.json', import.meta.url), 'utf8'))
function sourcePhotos(handles) {
  const out = []
  for (const h of handles) {
    const p = PHOTOS[h]
    if (!p) throw new Error(`seed-qa-photos.json has no product "${h}"`)
    for (const u of p.images) if (!out.includes(u)) out.push(u)
  }
  return out
}

// ─── listings ─────────────────────────────────────────────────────────────────
// key · seller · photo handles · target photo count · catalog fields · status · timing · extras.
// Prices are cents. `was` = earlier prices (oldest first) → price_history + PRICE DROP tag.
const LISTINGS = [
  // — the tester's ACTIVE listings —
  { key: 'paf-curved', seller: 'e2e', handles: ['reversible-curved-jacket'], n: 7, title: 'Post Archive Faction 5.0+ Reversible Curved Jacket', brand: 'POST ARCHIVE FACTION', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'S', color: 'Black', price: 34000, was: [42000, 38000], views: 212, created: 26, desc: 'PAF 5.0+ center reversible curved jacket, size S. Worn maybe five times, technical nylon is clean on both sides, zips glide. Fully reversible so you get the matte black shell and the panelled lining as a second look. Curved paneling, elastic lining. No flaws, no repairs, from a smoke-free home. Ships from San Jose within 2 business days.', meas: { 'PIT TO PIT': 21.5, LENGTH: 26, SHOULDER: 19, SLEEVE: 25 } },
  { key: 'kapital-trucker', seller: 'e2e', handles: ['kaptial-camo-smiley-trucker'], n: 4, title: 'Kapital Camo Smiley Trucker Jacket', brand: 'KAPITAL', category: 'Outerwear', subcategory: 'Denim', department: 'menswear', size: 'M', color: 'Multi', price: 30000, views: 96, created: 14, desc: 'Archive Kapital camo trucker with the smiley motif across the back. Classic type-3 cut, fits true to a medium. Light fading at the cuffs from wear, no holes or stains — see photos 3 and 4 for the back panel and the tag. Bought from AGMNT, selling because I went up a size.', meas: { 'PIT TO PIT': 22, LENGTH: 25, SHOULDER: 18.5, SLEEVE: 24.5 } },
  { key: 'ann-d-denim', seller: 'e2e', handles: ['ann-demeulemeester-patrick-denim-jacket'], n: 4, title: 'Ann Demeulemeester Patrick Denim Jacket', brand: 'ANN DEMEULEMEESTER', category: 'Outerwear', subcategory: 'Denim', department: 'menswear', size: '46', color: 'Black', price: 45000, views: 143, created: 9, boostDays: 5, desc: 'Ann D "Patrick" denim trucker with the signature ribbon ties at the back. Black denim, cotton lined, size 46 (fits a US S/M). Excellent condition — worn twice, no wear on the ribbons. One of the cleaner ones you will find, comes with the spare button.', meas: {} },
  { key: 'uc-pil-white', seller: 'e2e', handles: ['undercover-pil-button-up'], n: 4, title: 'Undercover Public Image Ltd. Button Up Shirt (White)', brand: 'UNDERCOVER', category: 'Tops', subcategory: 'Button-up shirts', department: 'menswear', size: '2', color: 'White', price: 13500, views: 88, created: 12, auth: 'authenticated', desc: 'Archive Undercover button-up with the PIL logo print, white. Japanese size 2 — fits a US S or a slim M. Print is crisp, no cracking; collar and cuffs clean. Legit-checked by the community, see the thread below. Tag photo included.', meas: { 'PIT TO PIT': 20, LENGTH: 28, SHOULDER: 17, SLEEVE: 24 } },
  { key: 'rick-geth', seller: 'e2e', handles: ['rick-owens-geth-pocket-sweater'], n: 4, title: 'Rick Owens Geth Pocket Sweater', brand: 'RICK OWENS', category: 'Knitwear', subcategory: 'Other knitwear', department: 'menswear', size: 'S', color: 'Black', price: 36000, views: 61, created: 5, auth: 'pending', desc: 'Rick Owens mainline Geth sweater with the drop pocket, black, size S. Oversized cut so it wears like an M. Knit is soft with no pilling, pocket seam intact. Bought secondhand a year ago, no receipt — happy to send more photos of the labels for anyone doing a legit check.', meas: { 'PIT TO PIT': 24, LENGTH: 27, SHOULDER: 23, SLEEVE: 26 } },
  { key: 'helmut-bomber', seller: 'e2e', handles: ['ss24-helmut-lang-seatbelt-bondage-bomber'], n: 4, title: 'Helmut Lang SS24 Seatbelt Bondage Bomber', brand: 'HELMUT LANG', category: 'Outerwear', subcategory: 'Bombers', department: 'menswear', size: 'XS', color: 'Black', price: 38000, views: 74, created: 7, intl: { canada: 2500, united_kingdom: 4200, europe: 4500, asia: 5500, australia_nz: 6500 }, desc: 'Helmut Lang SS24 bomber with the seatbelt bondage straps, black nylon, XS (oversized — fits S/M). Straps and buckles all present, zip clean, lining spotless. Ships worldwide — see the regions for rates.', meas: { 'PIT TO PIT': 23, LENGTH: 24, SHOULDER: 20, SLEEVE: 25 } },
  { key: 'xlim-jersey-grey', seller: 'e2e', handles: ['ep-8-01-jersey'], n: 3, title: 'XLIM EP.8 01 Technical Jersey (Grey)', brand: 'XLIM', category: 'Tops', subcategory: 'Jerseys', department: 'menswear', size: 'XS', color: 'Grey', price: 19500, was: [22000], views: 40, created: 11, desc: 'XLIM EP.8 stretch jersey in grey, asymmetric panels and the cut-out detail at the hem. Size XS, fits like a slim S. Worn twice. Two-way YKK zip with the XLIM slider, both slit pockets fine.', meas: { 'PIT TO PIT': 19, LENGTH: 25, SHOULDER: 16.5, SLEEVE: 25 } },
  { key: 'avavav-cap', seller: 'e2e', handles: ['filthy-rich-cap'], n: 3, title: 'AVAVAV Filthy Rich Cap', brand: 'AVAVAV', category: 'Accessories', subcategory: 'Hats', department: 'unisex', size: 'ONE SIZE', color: 'Black', price: 9500, views: 33, created: 3, desc: 'AVAVAV "Filthy Rich" embroidered cap, black, one size with the adjustable strap. Worn a couple of times, no sweat marks, embroidery perfect.', meas: {} },
  // — the tester's SOLD listings with an order in flight —
  { key: 'thesoloist-bomber', seller: 'e2e', handles: ['aw23-takahiromiyashita-thesoloist-bomber'], n: 4, title: 'TAKAHIROMIYASHITA TheSoloist AW23 Reversible Bomber', brand: 'TAKAHIROMIYASHITA THESOLOIST', category: 'Outerwear', subcategory: 'Bombers', department: 'menswear', size: '48', color: 'Black', price: 40000, views: 120, created: 12, status: 'sold', soldAt: 6, desc: 'TheSoloist AW23 cropped bomber, reversible with the button mechanism to tighten the fit. Size 48 (fits a cropped M). Both sides clean, padding even, no pulls in the nylon.', meas: { 'PIT TO PIT': 22, LENGTH: 22, SHOULDER: 19, SLEEVE: 25 } },
  { key: 'uc-evangelion', seller: 'e2e', handles: ['undercover-x-evangelion-crewneck'], n: 4, title: 'Undercover x Evangelion Shinji Crewneck', brand: 'UNDERCOVER', category: 'Tops', subcategory: 'Sweatshirts & hoodies', department: 'menswear', size: '2', color: 'White', price: 24000, views: 210, created: 10, status: 'sold', soldAt: 0.2, intl: { canada: 3000, united_kingdom: 4000, europe: 4000 }, desc: 'Undercover x Neon Genesis Evangelion crewneck with the Shinji Ikari graphic. Size 2, true to a medium. Print has no cracks, ribbing is tight, a tiny bit of wash-fade on the body which is how these come. Grail piece.', meas: { 'PIT TO PIT': 21, LENGTH: 26, SHOULDER: 19, SLEEVE: 24 } },
  { key: 'ysl-tee', seller: 'e2e', handles: ['saint-laurent-paris-t-shirt'], n: 4, title: 'Saint Laurent Paris Logo Tee (Vaccarello era)', brand: 'SAINT LAURENT', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'menswear', size: 'S', color: 'Black', price: 6500, views: 52, created: 9, status: 'sold', soldAt: 3, desc: 'Saint Laurent Paris logo tee from the Vaccarello era, black, size S. Soft cotton, logo intact, no pilling.', meas: { 'PIT TO PIT': 19, LENGTH: 27, SHOULDER: 17, SLEEVE: 8 } },
  { key: 'uc-pil-black', seller: 'e2e', handles: ['undercover-pil-button-up-1'], n: 4, title: 'Undercover Public Image Ltd. Button Up Shirt (Black)', brand: 'UNDERCOVER', category: 'Tops', subcategory: 'Button-up shirts', department: 'menswear', size: '2', color: 'Black', price: 12500, views: 47, created: 8, status: 'sold', soldAt: 2, desc: 'Same PIL button-up as the white one, in black. Size 2. Excellent condition, print sharp, all buttons original.', meas: { 'PIT TO PIT': 20, LENGTH: 28, SHOULDER: 17, SLEEVE: 24 } },
  { key: 'raf-kollaps', seller: 'e2e', handles: ['raf-simons-kollaps-redux-tee'], n: 3, title: 'Raf Simons Kollaps Redux Tee', brand: 'RAF SIMONS', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'menswear', size: 'S', color: 'White', price: 21000, views: 77, created: 15, status: 'sold', soldAt: 4, desc: 'Raf Simons Kollaps Redux tee, white, size S. Oversized. Graphic is clean front and back; light general wear, no stains.', meas: { 'PIT TO PIT': 22, LENGTH: 29, SHOULDER: 21, SLEEVE: 9 } },
  // — the tester's completed sales (tier history: 8 counted in the trailing year) —
  { key: 'paf-single-blazer', seller: 'e2e', handles: ['single-blazer-archive'], n: 3, title: 'Post Archive Faction Single Blazer (Archive)', brand: 'POST ARCHIVE FACTION', category: 'Tailoring', subcategory: 'Blazers', department: 'menswear', size: 'S', color: 'Black', price: 42000, views: 64, created: 30, status: 'sold', soldAt: 22, desc: 'PAF archive single-breasted blazer, black, size S. Tailored cut, fully lined. Worn for one event.', meas: {} },
  { key: 'bbs-boot-black', seller: 'e2e', handles: ['boot-2-gtx'], n: 3, title: '11 by Boris Bidjan Saberi x Salomon Boot 2 GTX (Black)', brand: '11 BY BORIS BIDJAN SABERI', category: 'Footwear', subcategory: 'Boots', department: 'menswear', size: '9.5', color: 'Black', price: 78000, views: 180, created: 50, status: 'sold', soldAt: 44, desc: '11 by BBS x Salomon Boot 2 GTX, black, US 9.5. Worn a handful of times, soles have plenty of life, Gore-Tex membrane intact. Box included.', meas: { INSOLE: 11, WIDTH: 4, HEEL: 1.5, SHAFT: 6 } },
  { key: 'xlim-05-black', seller: 'e2e', handles: ['ep-8-05-jacket'], n: 4, title: 'XLIM EP.8 05 Leather Collar Jacket (Black)', brand: 'XLIM', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'S', color: 'Black', price: 34000, views: 90, created: 84, status: 'sold', soldAt: 79, desc: 'XLIM EP.8 05 stone-washed jacket with the real leather collar and the intentional damage at the back. Size S.', meas: {} },
  { key: 'paf-shirring-pants', seller: 'e2e', handles: ['post-archive-faction-shirring-pants'], n: 3, title: 'Post Archive Faction Shirring Cargo Pants', brand: 'POST ARCHIVE FACTION', category: 'Bottoms', subcategory: 'Casual pants', department: 'menswear', size: 'M', color: 'Black', price: 26500, views: 70, created: 140, status: 'sold', soldAt: 134, desc: 'PAF shirring cargo pants, black, size M. Cinch detailing intact, lining clean.', meas: { WAIST: 16.5, INSEAM: 30, RISE: 12.5, 'LEG OPENING': 9 } },
  { key: 'avavav-hoodie', seller: 'e2e', handles: ['black-shoulderless-cutout-hoodie'], n: 3, title: 'AVAVAV Shoulderless Cut-Out Hoodie', brand: 'AVAVAV', category: 'Tops', subcategory: 'Sweatshirts & hoodies', department: 'womenswear', size: 'S', color: 'Black', price: 39500, views: 55, created: 206, status: 'sold', soldAt: 200, desc: 'AVAVAV raglan hoodie with the shrunken hood and shoulder cut-outs. Size S.', meas: {} },
  { key: 'notinlist-down', seller: 'e2e', handles: ['lv-0-down-jacket-y'], n: 3, title: 'Notinlist LV.0 Technical Down Jacket', brand: 'NOTINLIST', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'M', color: 'Black', price: 56000, views: 81, created: 360, status: 'sold', soldAt: 353, desc: 'Notinlist LV.0 down jacket with the magnetic snap wind flap and articulated sleeves. Size M.', meas: {} },
  { key: 'kozaburo-cap-multi', seller: 'e2e', handles: ['multi-stitch-prm-cap'], n: 3, title: 'Kozaburo Multi Stitch Remade Cap', brand: 'KOZABURO', category: 'Accessories', subcategory: 'Hats', department: 'unisex', size: 'ONE SIZE', color: 'Black', price: 24000, views: 38, created: 362, status: 'sold', soldAt: 356, desc: 'Kozaburo one-of-a-kind remade vintage cap with the multi-stitch panels. One size.', meas: {} },
  { key: 'sf1og-mohair-black', seller: 'e2e', handles: ['mohair-cardigan'], n: 3, title: 'SF1OG Black Mohair Cardigan', brand: 'SF1OG', category: 'Knitwear', subcategory: 'Cardigans', department: 'menswear', size: 'M', color: 'Black', price: 25000, views: 44, created: 405, status: 'sold', soldAt: 400, desc: 'SF1OG slim mohair-blend cardigan, asymmetric hem, thumb-hole cuffs. Size M.', meas: {} },
  { key: 'veerkracht-horsehair', seller: 'e2e', handles: ['veerkracht-horsehair-patchwork-jacket'], n: 3, title: 'Veerkracht Horsehair Patchwork Trucker', brand: 'VEERKRACHT', category: 'Outerwear', subcategory: 'Denim', department: 'menswear', size: 'L', color: 'Black', price: 19000, views: 36, created: 385, status: 'sold', soldAt: 380, intl: { canada: 2500, united_kingdom: 4000, europe: 4000 }, desc: 'Veerkracht trucker with the geometric horsehair patchwork at the cuffs and armpits. Size L.', meas: {} },
  // — the tester's drafts / in-review / removed —
  { key: 'draft-xlim-tee', seller: 'e2e', handles: ['ep-8-women-01-t-shirt'], n: 2, title: 'XLIM EP.8 Womens 01 Raw-Edge Tee', brand: 'XLIM', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'womenswear', size: 'S', color: 'Black', price: 4000, views: 0, created: 1, status: 'draft', desc: 'Slim raw-edge tee, worn once.', meas: {} },
  { key: 'draft-stair-shorts', seller: 'e2e', handles: [], n: 0, title: 'Veerkracht Stair Shorts', brand: null, category: null, subcategory: null, department: 'menswear', size: null, color: null, price: null, views: 0, created: 0.1, status: 'draft', desc: '', meas: {} },
  { key: 'chrome-cross-review', seller: 'e2e', handles: ['chrome-hearts-square-cross-tee'], n: 3, title: 'Chrome Hearts Square Cross Tee', brand: 'CHROME HEARTS', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'menswear', size: 'M', color: 'Black', price: 25000, views: 0, created: 0.5, status: 'pending_review', auth: 'pending', desc: 'Chrome Hearts square cross tee, black, size M. Bought at the Malibu store in 2023, bag and receipt available on request.', meas: {} },
  { key: 'removed-baby-tee', seller: 'e2e', handles: ['baby-how-to-pronounce-it-t-shirt'], n: 3, title: 'Aesynctx "How To Pronounce It?" Baby Tee', brand: 'AESYNCTX', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'womenswear', size: 'XS', color: 'White', price: 3800, views: 12, created: 20, status: 'removed', rejection: 'Listing removed: stock photos are not allowed. Re-list with your own photos of the item you have in hand.', desc: 'Aesynctx baby tee, white, XS.', meas: {} },
  // — Mara (LA seller the tester buys from) —
  { key: 'rick-puffer', seller: 'mara', handles: ['rick-owens-moncler-funnel-neck-puffer'], n: 4, title: 'Rick Owens x Moncler Funnel Neck Puffer', brand: 'RICK OWENS', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'M', color: 'Olive', price: 105000, was: [130000, 115000], dropAgo: 2, views: 402, created: 33, desc: 'Rick Owens x Moncler funnel neck down puffer, olive, size M. Worn one winter, down is lofty, no leaks, funnel zip works. Authentic, bought at Moncler Beverly Hills — I have the receipt. Price is firm-ish, open to reasonable offers.', meas: { 'PIT TO PIT': 25, LENGTH: 30, SHOULDER: 22, SLEEVE: 27 } },
  { key: 'dries-bomber', seller: 'mara', handles: ['dries-van-noten-back-zip-bomber'], n: 4, title: 'Dries Van Noten Back Zip Bomber', brand: 'DRIES VAN NOTEN', category: 'Outerwear', subcategory: 'Bombers', department: 'menswear', size: 'M', color: 'Brown', price: 60000, views: 150, created: 21, desc: 'Dries Van Noten bomber with the back zip, brown, size M. Runway piece. Clean inside and out, sleeve ribbing tight.', meas: { 'PIT TO PIT': 23, LENGTH: 25, SHOULDER: 20, SLEEVE: 26 } },
  { key: 'bbs-boot-grey', seller: 'mara', handles: ['boot-2-gtx-copy'], n: 3, title: '11 by Boris Bidjan Saberi x Salomon Boot 2 GTX (Object Dyed Grey)', brand: '11 BY BORIS BIDJAN SABERI', category: 'Footwear', subcategory: 'Boots', department: 'menswear', size: '9.5', color: 'Grey', price: 62000, views: 231, created: 18, desc: '11 by BBS x Salomon Boot 2 GTX from the AW23-24 collection, object-dyed grey. US 9.5. Tried on indoors only. Box and dust bag.', meas: { INSOLE: 11, WIDTH: 4, HEEL: 1.5, SHAFT: 6 } },
  { key: 'hysteric-tote', seller: 'mara', handles: ['hysteric-glamour-tote'], n: 3, title: 'Hysteric Glamour Graphic Tote', brand: 'HYSTERIC GLAMOUR', category: 'Accessories', subcategory: 'Bags', department: 'unisex', size: 'ONE SIZE', color: 'Multi', price: 6000, views: 88, created: 25, status: 'sold', soldAt: 2, desc: 'Archive Hysteric Glamour tote, fits a laptop. Graphic bright, straps solid.', meas: { LENGTH: 16, WIDTH: 5, HEIGHT: 15, STRAP: 22 } },
  { key: 'avavav-xray-shirt', seller: 'mara', handles: ['x-ray-printed-satin-button-up-shirt'], n: 4, title: 'AVAVAV X-Ray Printed Satin Shirt', brand: 'AVAVAV', category: 'Tops', subcategory: 'Button-up shirts', department: 'womenswear', size: 'S/4/40', color: 'White', price: 19000, views: 67, created: 6, desc: 'AVAVAV satin shirt with the x-ray graphic, ivory, size S. Mother of pearl buttons all present. Worn once for a shoot.', meas: { 'PIT TO PIT': 20, LENGTH: 27, SHOULDER: 17, SLEEVE: 24 } },
  { key: 'paf-shirring-bomber', seller: 'mara', handles: ['shirring-bomber'], n: 4, title: 'Post Archive Faction Shirring Bomber (Black)', brand: 'POST ARCHIVE FACTION', category: 'Outerwear', subcategory: 'Bombers', department: 'menswear', size: 'M', color: 'Black', price: 29000, views: 104, created: 4, desc: 'PAF MA-1 style shirring bomber in black cotton. Size M. Cinch details intact, no marks.', meas: { 'PIT TO PIT': 23, LENGTH: 25, SHOULDER: 20, SLEEVE: 26 } },
  { key: 'uc-patti', seller: 'mara', handles: ['undercover-patti-smith-t-shirt'], n: 3, title: 'Undercover Patti Smith V-Neck Tee', brand: 'UNDERCOVER', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'menswear', size: '2', color: 'Grey', price: 7000, views: 41, created: 12, status: 'sold', soldAt: 5, desc: 'Archive Undercover v-neck with the Patti Smith print. Size 2 (medium).', meas: {} },
  { key: 'uc-tee', seller: 'mara', handles: ['undercover-tee'], n: 3, title: 'Undercover Logo Tee', brand: 'UNDERCOVER', category: 'Tops', subcategory: 'Short-sleeve tees', department: 'menswear', size: 'L', color: 'Black', price: 6000, views: 30, created: 60, status: 'sold', soldAt: 40, desc: 'Undercover black logo tee, size L.', meas: {} },
  { key: 'paf-logo-hoodie', seller: 'mara', handles: ['logo-hoodie-archive'], n: 3, title: 'Post Archive Faction Logo Hoodie (Archive)', brand: 'POST ARCHIVE FACTION', category: 'Tops', subcategory: 'Sweatshirts & hoodies', department: 'menswear', size: 'M', color: 'Black', price: 18000, views: 58, created: 9, status: 'sold', soldAt: 2, desc: 'PAF archive logo hoodie, black, size M. Minimal branding, heavy cotton.', meas: { 'PIT TO PIT': 23, LENGTH: 27, SHOULDER: 21, SLEEVE: 25 } },
  // — Kenji (Tokyo seller; non-US origin lanes) —
  { key: 'kozaburo-trucker', seller: 'kenji', handles: ['kozaburo-honeycomb-sashiko-trucker-jacket'], n: 4, title: 'Kozaburo Honeycomb Sashiko Trucker Jacket', brand: 'KOZABURO', category: 'Outerwear', subcategory: 'Denim', department: 'menswear', size: '2', color: 'Black', price: 41000, views: 167, created: 16, shipsFrom: 'JP', intl: { north_america: 3500, united_kingdom: 4200, europe: 4200, asia: 1500, australia_nz: 4800, other: 6000 }, desc: 'Kozaburo honeycomb sashiko trucker, made in Japan, size 2. Artisan sashiko stitching all over, flared hem. Worn a few times, no fading yet. Ships from Tokyo with tracking.', meas: { 'PIT TO PIT': 21, LENGTH: 25, SHOULDER: 18, SLEEVE: 25 } },
  { key: 'kozaburo-wide-jean', seller: 'kenji', handles: ['kozaburo-wide-leg-jean'], n: 3, title: 'Kozaburo Sashiko Wide Leg Jean', brand: 'KOZABURO', category: 'Bottoms', subcategory: 'Denim', department: 'menswear', size: '1', color: 'Black', price: 36000, views: 93, created: 13, shipsFrom: 'JP', intl: { north_america: 3000, united_kingdom: 3800, europe: 3800, asia: 1200, australia_nz: 4500 }, desc: 'Kozaburo wide leg jean with belt-line pleats, honeycomb sashiko cotton. Size 1.', meas: { WAIST: 15.5, INSEAM: 31, RISE: 12.5, 'LEG OPENING': 11 } },
  { key: 'kozaburo-dexter-grey', seller: 'kenji', handles: ['kozaburo-dexter-pants'], n: 3, title: 'Kozaburo Dexter Flared Raw Denim (Grey)', brand: 'KOZABURO', category: 'Bottoms', subcategory: 'Denim', department: 'menswear', size: '1', color: 'Grey', price: 42000, views: 71, created: 8, shipsFrom: 'JP', intl: { north_america: 3000, united_kingdom: 3800, europe: 3800, asia: 1200 }, desc: 'Kozaburo Dexter pants, grey raw denim made in Japan, flared with the hem opening. Size 1.', meas: { WAIST: 15, INSEAM: 32, RISE: 12, 'LEG OPENING': 10.5 } },
  { key: 'kozaburo-monk', seller: 'kenji', handles: ['kozaburo-monk-jacket'], n: 3, title: 'Kozaburo Monk Jacket', brand: 'KOZABURO', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: '2', color: 'Black', price: 42000, views: 120, created: 40, status: 'sold', soldAt: 27, shipsFrom: 'JP', intl: { north_america: 3500, asia: 1500 }, desc: 'Kozaburo monk jacket with the frog button closure, sashiko cotton. Size 2.', meas: {} },
  { key: 'kozaburo-sashiko-dexter', seller: 'kenji', handles: ['kozaburo-sashiko-dexter-pants'], n: 3, title: 'Kozaburo Sashiko Dexter Pants', brand: 'KOZABURO', category: 'Bottoms', subcategory: 'Denim', department: 'menswear', size: '1', color: 'Black', price: 39000, views: 66, created: 20, status: 'sold', soldAt: 10, shipsFrom: 'JP', intl: { north_america: 3000, asia: 1200 }, desc: 'Kozaburo sashiko Dexter pants, black, size 1.', meas: {} },
  // — Priya (Chicago; moderator) —
  { key: 'sf1og-striped', seller: 'priya', handles: ['striped-mohair-cardigan'], n: 3, title: 'SF1OG Striped Mohair Cardigan', brand: 'SF1OG', category: 'Knitwear', subcategory: 'Cardigans', department: 'womenswear', size: 'M/6-8/42-44', color: 'Black', price: 22000, views: 59, created: 5, desc: 'SF1OG striped mohair cardigan, black and white, asymmetric hem, thumb-hole cuffs. Size M. Worn twice.', meas: { 'PIT TO PIT': 19, LENGTH: 24, SHOULDER: 16, SLEEVE: 26 } },
  { key: 'xlim-jersey-black', seller: 'priya', handles: ['ep-8-01-jersey-1'], n: 3, title: 'XLIM EP.8 01 Technical Jersey (Black)', brand: 'XLIM', category: 'Tops', subcategory: 'Jerseys', department: 'menswear', size: 'S', color: 'Black', price: 21000, views: 48, created: 2, desc: 'XLIM EP.8 01 jersey in black, size S. Asymmetric panels, cut-out at the hem, two-way zip.', meas: {} },
  { key: 'aenrmous-dress', seller: 'priya', handles: ['inlab-dress'], n: 3, title: 'Aenrmous Inlab Dress', brand: 'AENRMOUS', category: 'Other', subcategory: 'Miscellaneous', department: 'womenswear', size: 'S/4/40', color: 'White', price: 26000, views: 35, created: 1, desc: 'Aenrmous Inlab dress, ivory, size 1 (fits S). Worn once.', meas: {} },
  // — Theo (Brooklyn) —
  { key: 'xlim-05-brown', seller: 'theo', handles: ['ep-8-05-jacket-1'], n: 4, title: 'XLIM EP.8 05 Leather Collar Jacket (Brown)', brand: 'XLIM', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'XS', color: 'Brown', price: 31000, views: 133, created: 11, desc: 'XLIM EP.8 05 jacket in brown, stone-washed cotton with the real leather collar. XS but oversized, fits S. Damage detailing at the back is factory.', meas: { 'PIT TO PIT': 22, LENGTH: 26, SHOULDER: 19, SLEEVE: 25 } },
  { key: 'avavav-track', seller: 'theo', handles: ['smocked-track-pants'], n: 3, title: 'AVAVAV Smocked Track Pants', brand: 'AVAVAV', category: 'Sportswear', subcategory: 'Track pants', department: 'unisex', size: 'M', color: 'Grey', price: 17500, views: 42, created: 3, desc: 'AVAVAV smocked track pants, grey, size M. Elastic smocking all intact.', meas: { WAIST: 15, INSEAM: 30, RISE: 12, 'LEG OPENING': 8 } },
  { key: 'xlim-bag-ivory', seller: 'theo', handles: ['ep-8-01-bag'], n: 3, title: 'XLIM EP.8 01 Leather Tassel Bag (Ivory)', brand: 'XLIM', category: 'Accessories', subcategory: 'Bags', department: 'unisex', size: 'ONE SIZE', color: 'Cream', price: 24000, views: 61, created: 6, desc: 'XLIM EP.8 01 crossbody bag in ivory cow leather, tassel and silver hardware. Fits an iPad. Light patina on the base.', meas: { LENGTH: 12, WIDTH: 4, HEIGHT: 9, STRAP: 40 } },
  // — Lowell (Austin) —
  { key: 'veerkracht-biker-jacket', seller: 'lowell', handles: ['veerkracht-biker-jacket'], n: 3, title: 'Veerkracht Biker Jacket', brand: 'VEERKRACHT', category: 'Outerwear', subcategory: 'Other outerwear', department: 'menswear', size: 'L', color: 'Black', price: 17000, views: 39, created: 10, desc: 'Veerkracht biker jacket with the removable shoulder pads, size L. Worn a few times.', meas: {} },
  { key: 'veerkracht-biker-pants', seller: 'lowell', handles: ['veerkracht-biker-pants'], n: 3, title: 'Veerkracht Biker Denim', brand: 'VEERKRACHT', category: 'Bottoms', subcategory: 'Denim', department: 'menswear', size: '33', color: 'Black', price: 14000, views: 27, created: 10, desc: 'Veerkracht biker denim with the multi-texture panels, wide leg. Size L (33 waist).', meas: { WAIST: 16.5, INSEAM: 31, RISE: 13, 'LEG OPENING': 10 } },
  { key: 'aenrmous-overfur', seller: 'lowell', handles: ['overload-bag'], n: 3, title: 'Aenrmous Overfur Embroidered Bag', brand: 'AENRMOUS', category: 'Accessories', subcategory: 'Bags', department: 'unisex', size: 'ONE SIZE', color: 'Black', price: 21000, views: 22, created: 2, desc: 'Aenrmous AW25 Overfur bag with the embroidered centre panel. Fits a 16-inch laptop.', meas: { LENGTH: 17, WIDTH: 6, HEIGHT: 13, STRAP: 24 } },
]
const L = Object.fromEntries(LISTINGS.map((l) => [l.key, l]))
for (const l of LISTINGS) l.id = uid(`listing:${l.key}`)

// ─── conversations ────────────────────────────────────────────────────────────
// msgs: [from, text, daysAgo, hoursAgo]. offers: state machine rows. read: who has read up to when.
const CONVERSATIONS = [
  { key: 'c-paf-theo', listing: 'paf-curved', buyer: 'theo', created: [2, 4],
    msgs: [
      ['theo', 'Hey — is this the 5.0+ center version or the earlier drop? The panel lines look like the newer one.', 2, 4],
      ['e2e', 'It is the 5.0+ center one, tag photo is the 6th picture. Both sides are clean.', 2, 2],
      ['theo', 'Perfect. Would you take a bit less? Sending an offer.', 0, 3.1],
    ],
    offers: [{ key: 'o-paf-theo-1', from: 'theo', amount: 29000, state: 'open', at: [0, 3], expiresH: 24 }],
    read: { e2e: [2, 2], theo: [0, 3] } },
  { key: 'c-kapital-lowell', listing: 'kapital-trucker', buyer: 'lowell', created: [1, 6],
    msgs: [
      ['lowell', 'Any stretch on the price? Been hunting this smiley trucker for a while.', 1, 6],
      ['e2e', 'A little. What did you have in mind?', 1, 5],
      ['lowell', 'Sent you an offer.', 1, 4],
      ['e2e', 'That is too low for this one — countered.', 1, 3],
    ],
    offers: [
      { key: 'o-kapital-lowell-1', from: 'lowell', amount: 22000, state: 'countered', at: [1, 4], expiresH: 24 },
      { key: 'o-kapital-e2e-counter', from: 'e2e', amount: 27000, state: 'open', at: [1, 3], expiresH: 24 },
    ],
    read: { e2e: [1, 3], lowell: [1, 3.5] } },
  { key: 'c-helmut-ines', listing: 'helmut-bomber', buyer: 'ines', created: [1, 9],
    msgs: [
      ['ines', 'Hi! Would you ship to Toronto? I see Canada in the regions — is the $25 rate tracked?', 1, 9],
      ['e2e', 'Yes, tracked via UPS Standard, usually 5-7 days. Duties are on you though.', 1, 8],
      ['ines', 'Works for me. Offer coming.', 0, 7],
      ['e2e', 'Accepted — checkout link is on the offer card.', 0, 6],
    ],
    offers: [{ key: 'o-helmut-ines-1', from: 'ines', amount: 34000, state: 'accepted', at: [0, 7], expiresH: 24, acceptedAt: [0, 6] }],
    read: { e2e: [0, 6], ines: [0, 5] } },
  { key: 'c-soloist-lowell', listing: 'thesoloist-bomber', buyer: 'lowell', created: [6, 2],
    msgs: [
      ['lowell', 'Bought it. Can you ship by Friday?', 6, 1],
      ['e2e', 'Shipped this morning, tracking is on the order.', 5, 3],
      ['lowell', 'Got it today but the left cuff has a pull in the nylon that is not in the photos. Opening a dispute so we have a record.', 1, 4],
      ['e2e', 'That is not how it left here — I packed it in tissue. Let me look at your photos and we will sort it out.', 1, 2],
    ],
    offers: [],
    read: { e2e: [1, 2], lowell: [1, 2] } },
  { key: 'c-evangelion-ines', listing: 'uc-evangelion', buyer: 'ines', created: [0, 5],
    msgs: [
      ['ines', 'Paid! Please confirm when you can, and let me know the tracking number once it ships.', 0, 4.5],
    ],
    offers: [],
    read: { ines: [0, 4] } },
  { key: 'c-cap-lowell', listing: 'avavav-cap', buyer: 'lowell', created: [3, 3],
    msgs: [
      ['lowell', 'Would you do $80 on the cap?', 3, 3],
      ['e2e', 'Sure, accepted. Pay within 24h and I will ship same day.', 3, 2],
    ],
    offers: [{ key: 'o-cap-lowell-voided', from: 'lowell', amount: 8000, state: 'voided', at: [3, 3], expiresH: 24, acceptedAt: [3, 2] }],
    read: { e2e: [3, 2], lowell: [3, 2] } },
  { key: 'c-dries-mara', listing: 'dries-bomber', buyer: 'e2e', created: [4, 8],
    msgs: [
      ['e2e', 'Love this. Would you consider $480?', 4, 8],
      ['mara', 'Appreciate it but I cannot go below $560 on this one, the market is holding.', 4, 6],
      ['e2e', 'Understood, I will keep an eye on it.', 4, 5],
    ],
    offers: [{ key: 'o-dries-e2e-1', from: 'e2e', amount: 48000, state: 'declined', at: [4, 8], expiresH: 24 }],
    read: { e2e: [4, 5], mara: [4, 5] } },
  { key: 'c-boot-mara', listing: 'bbs-boot-grey', buyer: 'e2e', created: [0, 9],
    msgs: [
      ['e2e', 'Are these the object-dyed ones from the Salomon collab? And is the insole a true 11 inches?', 0, 9],
      ['mara', 'Yes, AW23-24 collab, and yes 11 in on the insole. Box is a little dented from storage.', 0, 8],
      ['e2e', 'Great — offer sent.', 0, 1],
    ],
    offers: [{ key: 'o-boot-e2e-1', from: 'e2e', amount: 58000, state: 'open', at: [0, 1], expiresH: 24 }],
    read: { e2e: [0, 1], mara: [0, 8] } },
  { key: 'c-patti-mara', listing: 'uc-patti', buyer: 'e2e', created: [5, 6],
    msgs: [
      ['e2e', 'Just bought the Patti Smith tee — thank you!', 5, 6],
      ['mara', 'Thanks! Shipping tomorrow with USPS Ground Advantage, will pop the tracking on the order.', 5, 4],
      ['mara', 'Delivered per USPS — let me know it arrived ok and mark it received when you can.', 1, 5],
    ],
    offers: [],
    read: { e2e: [1, 4], mara: [1, 5] } },
  { key: 'c-trucker-kenji', listing: 'kozaburo-trucker', buyer: 'e2e', created: [3, 10],
    msgs: [
      ['e2e', 'How does the size 2 fit compared to a US M? I am 5\'11", 165.', 3, 10],
      ['kenji', 'Size 2 is close to a US S/M — a little short in the body because of the flare. At your build a 2 works, a 3 if you want to layer.', 3, 7],
      ['e2e', 'Thanks, that helps. Saving it for now.', 3, 6],
    ],
    offers: [],
    read: { e2e: [3, 6], kenji: [3, 6] } },
  { key: 'c-cardigan-priya', listing: 'sf1og-striped', buyer: 'e2e', created: [1, 1],
    msgs: [
      ['e2e', 'Is the mohair shedding at all? Some of the SF1OG knits go fast.', 1, 1],
      ['priya', 'Barely — it is the merino blend so it holds up. I can send a close-up of the cuffs if you want.', 0, 5],
      ['priya', 'Also happy to do a bundle if you are looking at the jersey too.', 0, 2],
    ],
    offers: [],
    read: { priya: [0, 2] } },
  { key: 'c-xlim-theo', listing: 'xlim-05-brown', buyer: 'e2e', created: [0, 10],
    msgs: [
      ['e2e', 'Would you take $260 on the brown 05?', 0, 10],
      ['theo', 'Yeah that works, accepted. Checkout is yours for 24h.', 0, 6],
    ],
    offers: [{ key: 'o-xlim-e2e-1', from: 'e2e', amount: 26000, state: 'accepted', at: [0, 10], expiresH: 24, acceptedAt: [0, 6] }],
    read: { e2e: [0, 5], theo: [0, 6] } },
  { key: 'c-biker-lowell', listing: 'veerkracht-biker-jacket', buyer: 'e2e', created: [3, 12],
    msgs: [
      ['e2e', 'Offered $150, let me know.', 3, 12],
    ],
    offers: [{ key: 'o-biker-e2e-expired', from: 'e2e', amount: 15000, state: 'expired', at: [3, 12], expiresH: 24 }],
    read: { e2e: [3, 12], lowell: [2, 12] } },
  { key: 'c-uctee-mara', listing: 'uc-tee', buyer: 'e2e', created: [40, 5],
    msgs: [
      ['e2e', 'Received the Undercover tee, exactly as described. Left you a review.', 36, 5],
      ['mara', 'Thank you! Enjoy it.', 36, 3],
    ],
    offers: [],
    read: { e2e: [36, 3], mara: [36, 3] } },
  { key: 'c-monk-kenji', listing: 'kozaburo-monk', buyer: 'e2e', created: [27, 4],
    msgs: [
      ['e2e', 'The monk jacket arrived with a frog button missing — see the dispute photos. Can we sort a refund?', 22, 4],
      ['kenji', 'Sorry about that, it must have come loose in transit. Fine with the refund, I will accept whatever the team decides.', 22, 1],
      ['e2e', 'Refund came through, thanks for being easy about it.', 19, 6],
    ],
    offers: [],
    read: { e2e: [19, 6], kenji: [19, 6] } },
]
for (const c of CONVERSATIONS) {
  c.id = uid(`conv:${c.key}`)
  c.listingId = L[c.listing].id
  c.sellerKey = L[c.listing].seller
  for (const o of c.offers) o.id = uid(`offer:${o.key}`)
}
const OFFER = Object.fromEntries(CONVERSATIONS.flatMap((c) => c.offers.map((o) => [o.key, o])))

// ─── orders ───────────────────────────────────────────────────────────────────
// Timestamps are days ago. `offer` = offer-based checkout (no domestic shipping line).
// fee: welcome = seller's first 10 sales (Stripe cost only), tier = 7.0% for the tester.
const ORDERS = [
  // tester as SELLER
  { key: 'ord-soloist', listing: 'thesoloist-bomber', buyer: 'lowell', state: 'disputed', fee: 'welcome', created: 6, confirm: 5.8, ship: 5.2, deliver: 2, dispute: 1.2, carrier: 'UPS', tracking: '1Z999AA10123456784' },
  { key: 'ord-evangelion', listing: 'uc-evangelion', buyer: 'ines', state: 'paid_held', fee: 'tier', created: 0.2, label: 'seller', region: 'canada' },
  { key: 'ord-ysl', listing: 'ysl-tee', buyer: 'theo', state: 'shipped', fee: 'tier', created: 3, confirm: 2.7, ship: 1.1, carrier: 'USPS', tracking: '9400111899223197428490' },
  { key: 'ord-pil-black', listing: 'uc-pil-black', buyer: 'priya', state: 'seller_confirmed', fee: 'tier', created: 2, confirm: 1.2 },
  { key: 'ord-raf', listing: 'raf-kollaps', buyer: 'mara', state: 'delivered', fee: 'tier', created: 4, confirm: 3.8, ship: 3.2, deliver: 1, carrier: 'USPS', tracking: '9400111899223197428512' },
  { key: 'ord-blazer', listing: 'paf-single-blazer', buyer: 'theo', state: 'released', fee: 'welcome', created: 22, confirm: 21.7, ship: 21, deliver: 18.5, release: 18, carrier: 'USPS', tracking: '9400111899223197400001' },
  { key: 'ord-boot-black', listing: 'bbs-boot-black', buyer: 'priya', state: 'released', fee: 'welcome', created: 44, confirm: 43.5, ship: 43, deliver: 40.4, release: 40, carrier: 'UPS', tracking: '1Z999AA10123400002' },
  { key: 'ord-xlim-black', listing: 'xlim-05-black', buyer: 'lowell', state: 'released', fee: 'welcome', created: 79, confirm: 78.6, ship: 78, deliver: 75.5, release: 75, carrier: 'USPS', tracking: '9400111899223197400003' },
  { key: 'ord-shirring-pants', listing: 'paf-shirring-pants', buyer: 'mara', state: 'released', fee: 'welcome', created: 134, confirm: 133.7, ship: 133, deliver: 130.5, release: 130, carrier: 'USPS', tracking: '9400111899223197400004' },
  { key: 'ord-avavav-hoodie', listing: 'avavav-hoodie', buyer: 'ines', state: 'released', fee: 'welcome', created: 200, confirm: 199.5, ship: 199, deliver: 194, release: 193, label: 'seller', region: 'canada', shipping: 2500, carrier: 'UPS', tracking: '1Z999AA10123400005' },
  { key: 'ord-notinlist', listing: 'notinlist-down', buyer: 'theo', state: 'released', fee: 'welcome', created: 353, confirm: 352.6, ship: 352, deliver: 349.5, release: 349, carrier: 'UPS', tracking: '1Z999AA10123400006' },
  { key: 'ord-kozaburo-cap', listing: 'kozaburo-cap-multi', buyer: 'priya', state: 'released', fee: 'welcome', created: 356, confirm: 355.7, ship: 355, deliver: 352.5, release: 352, carrier: 'USPS', tracking: '9400111899223197400007' },
  { key: 'ord-sf1og', listing: 'sf1og-mohair-black', buyer: 'lowell', state: 'released', fee: 'welcome', created: 400, confirm: 399.6, ship: 399, deliver: 396, release: 395.5, carrier: 'USPS', tracking: '9400111899223197400008' },
  { key: 'ord-horsehair', listing: 'veerkracht-horsehair', buyer: 'ines', state: 'released', fee: 'welcome', created: 380, confirm: 379.5, ship: 379, deliver: 373, release: 372.5, label: 'seller', region: 'canada', shipping: 2500, carrier: 'UPS', tracking: '1Z999AA10123400009' },
  // tester as BUYER
  { key: 'ord-patti', listing: 'uc-patti', buyer: 'e2e', state: 'delivered', fee: 'welcome', created: 5, confirm: 4.8, ship: 4.2, deliver: 1.2, carrier: 'USPS', tracking: '9400111899223197411001' },
  { key: 'ord-uctee', listing: 'uc-tee', buyer: 'e2e', state: 'released', fee: 'welcome', created: 40, confirm: 39.7, ship: 39, deliver: 36.5, release: 36, carrier: 'USPS', tracking: '9400111899223197411002' },
  { key: 'ord-logo-hoodie', listing: 'paf-logo-hoodie', buyer: 'e2e', state: 'seller_confirmed', fee: 'welcome', created: 2, confirm: 1.4 },
  { key: 'ord-monk', listing: 'kozaburo-monk', buyer: 'e2e', state: 'refunded', fee: 'welcome', created: 27, confirm: 26.7, ship: 26, deliver: 22.2, dispute: 22, refund: 19.5, label: 'seller', region: 'north_america', shipping: 3500, carrier: 'DHL', tracking: 'JD014600004512345678' },
  { key: 'ord-sashiko-dexter', listing: 'kozaburo-sashiko-dexter', buyer: 'e2e', state: 'cancelled', fee: 'welcome', created: 10, cancel: 9.6, label: 'seller', region: 'north_america', shipping: 3000 },
  // between personas (so the sold Hysteric tote on the tester's saved page reads SOLD)
  { key: 'ord-hysteric', listing: 'hysteric-tote', buyer: 'theo', state: 'seller_confirmed', fee: 'welcome', created: 2, confirm: 1.5 },
]
for (const o of ORDERS) {
  o.id = uid(`order:${o.key}`)
  const l = L[o.listing]
  o.listingId = l.id
  o.sellerKey = l.seller
  o.item = o.item ?? l.price
  o.label = o.label ?? 'platform'
  if (o.shipping === undefined) o.shipping = o.label === 'platform' ? (o.offer ? 0 : domesticShipping(l.category)) : (l.intl?.[o.region] ?? 3000)
  o.amounts = orderAmounts({ item: o.item, feeMode: o.fee, tierBps: 700, shipping: o.shipping, labelMode: o.label })
}
const ORD = Object.fromEntries(ORDERS.map((o) => [o.key, o]))

// ─── reviews (released orders only) ─────────────────────────────────────────
const REVIEWS = [
  { order: 'ord-uctee', dir: 'buyer_to_seller', stars: 5, body: 'Exactly as described, shipped the next morning. Would buy from Mara again.', tags: ['AS DESCRIBED', 'FAST SHIPPING'], at: 36 },
  { order: 'ord-uctee', dir: 'seller_to_buyer', stars: 5, body: 'Paid instantly, easy to deal with.', tags: ['GOOD COMMS'], at: 35.5 },
  { order: 'ord-blazer', dir: 'buyer_to_seller', stars: 5, body: 'Blazer was immaculate and packed like it was going to a museum.', tags: ['AS DESCRIBED', 'GREAT PACKAGING'], at: 17.5 },
  { order: 'ord-boot-black', dir: 'buyer_to_seller', stars: 5, body: 'Boots came double boxed with the dust bag. Fast.', tags: ['FAST SHIPPING', 'GREAT PACKAGING'], at: 39.5 },
  { order: 'ord-xlim-black', dir: 'buyer_to_seller', stars: 4, body: 'Great jacket, took a couple of days longer to ship than expected but comms were good.', tags: ['AS DESCRIBED', 'GOOD COMMS'], at: 74.5 },
  { order: 'ord-shirring-pants', dir: 'buyer_to_seller', stars: 5, body: 'As pictured, thank you.', tags: ['AS DESCRIBED'], at: 129.5 },
  { order: 'ord-avavav-hoodie', dir: 'buyer_to_seller', stars: 5, body: 'Shipped to Toronto without drama, tracked the whole way.', tags: ['FAST SHIPPING', 'GOOD COMMS'], at: 192.5 },
  { order: 'ord-notinlist', dir: 'buyer_to_seller', stars: 5, body: 'Down jacket was in better shape than the photos.', tags: ['AS DESCRIBED'], at: 348.5 },
  { order: 'ord-kozaburo-cap', dir: 'buyer_to_seller', stars: 4, body: 'Cap is great. Packaging was just a poly mailer.', tags: ['AS DESCRIBED'], at: 351.5 },
  { order: 'ord-sf1og', dir: 'buyer_to_seller', stars: 5, body: 'Perfect.', tags: ['AS DESCRIBED', 'FAST SHIPPING'], at: 395 },
  { order: 'ord-blazer', dir: 'seller_to_buyer', stars: 5, body: 'Smooth transaction.', tags: ['GOOD COMMS'], at: 17.4 },
]

// ─── everything else ──────────────────────────────────────────────────────────
const SAVES = [
  ['e2e', 'rick-puffer', 20], ['e2e', 'bbs-boot-grey', 9], ['e2e', 'hysteric-tote', 12], ['e2e', 'avavav-xray-shirt', 5], ['e2e', 'kozaburo-trucker', 3],
  ['e2e', 'aenrmous-dress', 0.5], ['e2e', 'avavav-track', 2], ['e2e', 'xlim-jersey-black', 1],
  ['mara', 'paf-curved', 20], ['theo', 'paf-curved', 5], ['priya', 'paf-curved', 8], ['lowell', 'paf-curved', 3],
  ['theo', 'ann-d-denim', 6], ['kenji', 'ann-d-denim', 2],
  ['mara', 'uc-pil-white', 10], ['theo', 'uc-pil-white', 9], ['kenji', 'uc-pil-white', 4],
  ['mara', 'xlim-jersey-grey', 7], ['priya', 'xlim-jersey-grey', 3],
  ['lowell', 'helmut-bomber', 4], ['ines', 'helmut-bomber', 1],
]
const FOLLOWS = [['e2e', 'mara', 30], ['e2e', 'kenji', 4], ['e2e', 'priya', 15], ['theo', 'e2e', 20], ['priya', 'e2e', 40], ['lowell', 'e2e', 6], ['mara', 'e2e', 35], ['ines', 'e2e', 190]]
const SAVED_SEARCHES = [
  { key: 'ss-kozaburo', user: 'e2e', query: { q: 'kozaburo' }, alerts: true, lastSeen: 10, created: 40 },
  { key: 'ss-outerwear', user: 'e2e', query: { dept: 'menswear', cat: 'Outerwear', color: 'Black' }, alerts: true, lastSeen: 7, created: 25 },
  { key: 'ss-rick', user: 'e2e', query: { brand: 'RICK OWENS', size: 'M' }, alerts: false, lastSeen: 1, created: 12 },
]
const MEASUREMENT_REQUESTS = [
  { key: 'mr-annd-theo', listing: 'ann-d-denim', requester: 'theo', at: 1.5 },
  { key: 'mr-trucker-e2e', listing: 'kozaburo-trucker', requester: 'e2e', at: 3 },
  { key: 'mr-shirt-e2e', listing: 'avavav-xray-shirt', requester: 'e2e', at: 5, fulfilled: 4 },
]
const COMMENTS = [
  { key: 'lc-pil-verdict', listing: 'uc-pil-white', author: 'priya', body: 'Verdict: authentic. Print registration, the care label font and the side-seam stitching all match the 2004 production run. Tag photo checks out.', vote: 'legit', pinned: true, at: 9 },
  { key: 'lc-pil-auto', listing: 'uc-pil-white', author: null, body: 'Tag scan passed: label typography and wash-tag layout consistent with Undercover production references.', source: 'auto', verdict: 'authentic', at: 11 },
  { key: 'lc-pil-mara', listing: 'uc-pil-white', author: 'mara', body: 'Have the black one from the same season, stitching pattern is identical. Legit.', vote: 'legit', at: 10 },
  { key: 'lc-pil-theo', listing: 'uc-pil-white', author: 'theo', body: 'Print looks right, cracking pattern matches the age.', vote: 'legit', at: 9.5 },
  { key: 'lc-pil-kenji', listing: 'uc-pil-white', author: 'kenji', body: 'Bought mine in Harajuku in 2005, this is the real print.', vote: 'legit', at: 9.2 },
  { key: 'lc-geth-mara', listing: 'rick-geth', author: 'mara', body: 'Knit density and the drop pocket seam look right for the Geth. Would like to see the neck label though.', vote: 'legit', at: 4 },
  { key: 'lc-geth-lowell', listing: 'rick-geth', author: 'lowell', body: 'The pocket stitching looks off to me — the mainline ones I have seen use a tighter chain stitch. Flagging until we see labels.', vote: 'flag', at: 3.5 },
  { key: 'lc-geth-e2e', listing: 'rick-geth', author: 'e2e', body: 'Fair — added the neck label and the wash tag as photos 3 and 4.', parent: 'lc-geth-lowell', at: 3 },
  { key: 'lc-geth-priya', listing: 'rick-geth', author: 'priya', body: 'Looking at this one tonight, will post a verdict.', at: 2 },
]
const DISPUTES = [
  { key: 'd-soloist', order: 'ord-soloist', buyer: 'lowell', description: 'Left cuff has a 1cm pull in the nylon that is not visible in any listing photo. Item was described as having no pulls. Requesting a partial refund or return.', photosFrom: 'thesoloist-bomber', at: 1.2 },
  { key: 'd-monk', order: 'ord-monk', buyer: 'e2e', description: 'One of the frog buttons is missing on arrival (second from the top). Photos attached. Seller agrees it was likely lost in transit.', photosFrom: 'kozaburo-monk', at: 22, resolution: 'refund', resolvedAt: 19.5 },
]
const BOOSTS = [{ key: 'b-annd', listing: 'ann-d-denim', package: 'feature_7', days: 7, amount: 1200, startedAgo: 2 }]
const STRIKES = [{ key: 'strike-lowell-cap', user: 'lowell', offer: 'o-cap-lowell-voided', reason: 'accepted_offer_unpaid', at: 2 }]
const REPORTS = [{ key: 'rep-cap-conv', reporter: 'e2e', targetType: 'conversation', target: 'c-cap-lowell', reason: 'Buyer accepted the offer, never paid, then went quiet.', at: 1.9 }]

// Notifications (title/body/url mirror lib/notify/templates.ts).
const NOTIFICATIONS = [
  { key: 'n-offer-theo', user: 'e2e', type: 'offer_received', title: 'New offer', body: '@theo_nakamura offered $290.00 on Post Archive Faction 5.0+ Reversible Curved Jacket.', url: () => `/messages/${uid('conv:c-paf-theo')}`, at: [0, 3], read: false },
  { key: 'n-paid-ines', user: 'e2e', type: 'sale', title: 'Your item sold', body: 'Undercover x Evangelion Shinji Crewneck sold for $240.00. Confirm and ship to get paid.', url: () => `/orders/${uid('order:ord-evangelion')}`, at: [0, 4.8], read: false },
  { key: 'n-msg-priya', user: 'e2e', type: 'message', title: 'New message from @priya_venkat', body: 'Also happy to do a bundle if you are looking at the jersey too.', url: () => `/messages/${uid('conv:c-cardigan-priya')}`, at: [0, 2], read: false },
  { key: 'n-accepted-theo', user: 'e2e', type: 'offer_accepted', title: 'Offer accepted', body: '@theo_nakamura accepted your $260.00 offer on XLIM EP.8 05 Leather Collar Jacket (Brown). Complete checkout to secure it.', url: () => `/checkout/${uid('listing:xlim-05-brown')}`, at: [0, 6], read: false },
  { key: 'n-delivered-patti', user: 'e2e', type: 'delivered', title: 'Delivered', body: 'Undercover Patti Smith V-Neck Tee was delivered — the payout is on the way.', url: () => `/orders/${uid('order:ord-patti')}`, at: [1, 2], read: true },
  { key: 'n-dispute-soloist', user: 'e2e', type: 'dispute', title: 'Order disputed', body: 'A dispute was opened on TAKAHIROMIYASHITA TheSoloist AW23 Reversible Bomber. We will review it shortly.', url: () => `/orders/${uid('order:ord-soloist')}`, at: [1, 4], read: true },
  { key: 'n-declined-mara', user: 'e2e', type: 'offer_declined', title: 'Offer declined', body: '@mara_lindqvist declined your $480.00 offer on Dries Van Noten Back Zip Bomber.', url: () => `/messages/${uid('conv:c-dries-mara')}`, at: [4, 6], read: true },
  { key: 'n-price-drop-puffer', user: 'e2e', type: 'price_drop', title: 'Saved item now $1050.00', body: 'Rick Owens x Moncler Funnel Neck Puffer — was $1150.00.', url: () => `/listings/${uid('listing:rick-puffer')}`, at: [2, 0], read: false },
  { key: 'n-meas-theo', user: 'e2e', type: 'measurement_request', title: 'Measurements requested', body: '@theo_nakamura asked for measurements on Ann Demeulemeester Patrick Denim Jacket. Add them from the listing to notify everyone who asked.', url: () => `/sell?edit=${uid('listing:ann-d-denim')}`, at: [1, 12], read: false },
  { key: 'n-meas-added', user: 'e2e', type: 'measurements_added', title: 'Measurements added', body: 'The seller added measurements to AVAVAV X-Ray Printed Satin Shirt — the item you asked about.', url: () => `/listings/${uid('listing:avavav-xray-shirt')}`, at: [4, 0], read: true },
  { key: 'n-tier-expiry', user: 'e2e', type: 'tier_expiry', title: 'Your fee rate may rise soon', body: 'Some of your sales are about to roll out of your 12-month window. Without new sales, your seller fee could move from 7.0% to 8.0%.', url: () => '/settings?section=power', at: [0, 20], read: false },
  { key: 'n-shipped-ysl', user: 'theo', type: 'shipped', title: 'On the way', body: 'Saint Laurent Paris Logo Tee (Vaccarello era) has shipped.', url: () => `/orders/${uid('order:ord-ysl')}`, at: [1, 1], read: false },
  { key: 'n-saved-search', user: 'e2e', type: 'saved_search', title: 'New match for your saved search', body: 'Kozaburo Dexter Flared Raw Denim (Grey) just listed for $420.00.', url: () => `/listings/${uid('listing:kozaburo-dexter-grey')}`, at: [8, 0], read: true },
  { key: 'n-approved-annd', user: 'e2e', type: 'listing_approved', title: 'Listing approved — now live', body: 'Ann Demeulemeester Patrick Denim Jacket passed review and is live on the archive.', url: () => `/listings/${uid('listing:ann-d-denim')}`, at: [9, 0], read: true },
  { key: 'n-offer-mara', user: 'mara', type: 'offer_received', title: 'New offer', body: '@e2e_buyer offered $580.00 on 11 by Boris Bidjan Saberi x Salomon Boot 2 GTX (Object Dyed Grey).', url: () => `/messages/${uid('conv:c-boot-mara')}`, at: [0, 1], read: false },
  { key: 'n-counter-lowell', user: 'lowell', type: 'offer_countered', title: 'Counter received — $270.00', body: '@e2e_buyer countered on Kapital Camo Smiley Trucker Jacket. Accept, counter or decline from the thread.', url: () => `/messages/${uid('conv:c-kapital-lowell')}`, at: [1, 3], read: false },
  { key: 'n-sale-kenji-cancel', user: 'kenji', type: 'sale', title: 'Your item sold', body: 'Kozaburo Sashiko Dexter Pants sold for $390.00. Confirm and ship to get paid.', url: () => `/orders/${uid('order:ord-sashiko-dexter')}`, at: [10, 0], read: true },
]

// ─── dry run: just report the fixture set ────────────────────────────────────
if (DRY) {
  const dup = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i)
  const dups = dup(LISTINGS.map((l) => l.key)).concat(dup(CONVERSATIONS.map((c) => c.key)), dup(ORDERS.map((o) => o.key)))
  if (dups.length) throw new Error(`duplicate fixture keys: ${dups.join(', ')}`)
  const handleUse = {}
  for (const l of LISTINGS) for (const h of l.handles) handleUse[h] = (handleUse[h] ?? 0) + 1
  const counted = ORDERS.filter((o) => o.sellerKey === 'e2e' && ['delivered', 'released'].includes(o.state) && o.created < 365)
  console.log(`listings ${LISTINGS.length} · conversations ${CONVERSATIONS.length} · messages ${CONVERSATIONS.reduce((s, c) => s + c.msgs.length, 0)} · offers ${Object.keys(OFFER).length} · orders ${ORDERS.length} · reviews ${REVIEWS.length} · notifications ${NOTIFICATIONS.length}`)
  console.log(`tester trailing counted sales: ${counted.length} orders, ${dollars(counted.reduce((s, o) => s + Math.min(o.item, 200000), 0))} volume (tier 2 needs $3,000 & 3)`)
  console.log(`tester lifetime non-cancelled sales: ${ORDERS.filter((o) => o.sellerKey === 'e2e' && o.state !== 'cancelled').length}`)
  console.log('photo handles used twice:', Object.entries(handleUse).filter(([, n]) => n > 1).map(([h]) => h).join(', ') || 'none')
  for (const o of ORDERS) console.log(`  ${o.key.padEnd(22)} ${o.state.padEnd(16)} item ${dollars(o.item).padStart(9)} ship ${dollars(o.shipping).padStart(7)} fee ${dollars(o.amounts.seller_fee_cents).padStart(7)} → transfer ${dollars(o.amounts.transfer_cents)}`)
  process.exit(0)
}

// ─── live run ─────────────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function must(promise, what) {
  const { data, error } = await promise
  if (error) throw new Error(`${what}: ${error.message} (${error.code ?? ''}) ${error.details ?? ''} ${error.hint ?? ''}`)
  return data
}
async function insertChunked(table, rows, size = 200) {
  for (const part of chunk(rows, size)) await must(db.from(table).insert(part), `insert ${table}`)
  return rows.length
}
async function deleteIds(table, ids, column = 'id') {
  let n = 0
  for (const part of chunk(ids, 200)) {
    const data = await must(db.from(table).delete().in(column, part).select(column), `delete ${table}`)
    n += data?.length ?? 0
  }
  return n
}

// 1. users -----------------------------------------------------------------
async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const data = await must(db.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers')
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}
const e2eUser = await findUserByEmail(BUYER_EMAIL)
if (!e2eUser) { console.error(`No auth user for ${BUYER_EMAIL} — run scripts/seed-e2e-fixtures.mjs first.`); process.exit(1) }
const adminUser = await findUserByEmail(ADMIN_EMAIL)
const stripeSeller = SELLER_EMAIL ? await findUserByEmail(SELLER_EMAIL) : null
let connectAccountId = null
if (stripeSeller) {
  const p = await must(db.from('profiles').select('stripe_connect_account_id, payouts_enabled').eq('id', stripeSeller.id).maybeSingle(), 'seller profile')
  if (p?.payouts_enabled && p?.stripe_connect_account_id) connectAccountId = p.stripe_connect_account_id
}

let qaPassword = process.env.QA_PASSWORD
if (!qaPassword) {
  qaPassword = `archive-qa-${randomBytes(4).toString('hex')}`
  writeFileSync('.env.qa.local', `# shared password for the qa-*@test.local personas (scripts/seed-qa-showcase.mjs)\nQA_PASSWORD=${qaPassword}\n`)
}

const USER_ID = { e2e: e2eUser.id }
if (WIPE_USERS && WIPE_ONLY) {
  // resolved below after the data wipe
}
for (const p of PEOPLE) {
  let u = await findUserByEmail(p.email)
  if (WIPE_ONLY && !u) continue
  if (!u) {
    const data = await must(db.auth.admin.createUser({ email: p.email, password: qaPassword, email_confirm: true }), `createUser ${p.email}`)
    u = data.user
  } else if (!WIPE_ONLY) {
    await must(db.auth.admin.updateUserById(u.id, { password: qaPassword }), `password ${p.email}`)
  }
  USER_ID[p.key] = u.id
}
const personaIds = PEOPLE.map((p) => USER_ID[p.key]).filter(Boolean)
const idOf = (key) => { const id = USER_ID[key]; if (!id) throw new Error(`no user for "${key}"`); return id }

// 2. wipe ------------------------------------------------------------------
const listingIds = LISTINGS.map((l) => l.id)
const convIds = CONVERSATIONS.map((c) => c.id)
const orderIds = ORDERS.map((o) => o.id)
console.log('— wiping rows from previous seed runs')
{
  // Also catch anything owned by the personas that a fixture rename may have orphaned.
  const extraListingIds = personaIds.length
    ? ((await must(db.from('listings').select('id').in('seller_id', personaIds), 'persona listings')) ?? []).map((r) => r.id)
    : []
  const allListingIds = Array.from(new Set([...listingIds, ...extraListingIds]))
  const orderRows = personaIds.length
    ? (await must(db.from('orders').select('id').or(`buyer_id.in.(${personaIds.join(',')}),seller_id.in.(${personaIds.join(',')})`), 'persona orders')) ?? []
    : []
  const allOrderIds = Array.from(new Set([...orderIds, ...orderRows.map((r) => r.id)]))
  const convRows = personaIds.length
    ? (await must(db.from('conversations').select('id').or(`buyer_id.in.(${personaIds.join(',')}),seller_id.in.(${personaIds.join(',')})`), 'persona convs')) ?? []
    : []
  const allConvIds = Array.from(new Set([...convIds, ...convRows.map((r) => r.id)]))

  const counts = {}
  counts.reviews = await deleteIds('reviews', allOrderIds, 'order_id')
  counts.disputes = await deleteIds('disputes', allOrderIds, 'order_id')
  counts.order_events = await deleteIds('order_events', allOrderIds, 'order_id')
  counts.buyer_strikes = await deleteIds('buyer_strikes', STRIKES.map((s) => uid(`strike:${s.key}`)))
  if (personaIds.length) counts.buyer_strikes += await deleteIds('buyer_strikes', personaIds, 'user_id')
  counts.orders = await deleteIds('orders', allOrderIds)
  counts.offers = await deleteIds('offers', allConvIds, 'conversation_id')
  counts.messages = await deleteIds('messages', allConvIds, 'conversation_id')
  counts.conversation_reads = await deleteIds('conversation_reads', allConvIds, 'conversation_id')
  counts.reports = await deleteIds('reports', REPORTS.map((r) => uid(`report:${r.key}`)))
  counts.conversations = await deleteIds('conversations', allConvIds)
  counts.comments = await deleteIds('comments', allListingIds, 'listing_id')
  counts.saves = await deleteIds('saves', allListingIds, 'listing_id')
  counts.saves += await deleteIds('saves', SAVES.map(([u, l]) => uid(`save:${u}:${l}`)))
  counts.follows = await deleteIds('follows', FOLLOWS.map(([a, b]) => uid(`follow:${a}:${b}`)))
  if (personaIds.length) counts.follows += await deleteIds('follows', personaIds, 'follower_id') + await deleteIds('follows', personaIds, 'following_id')
  counts.measurement_requests = await deleteIds('measurement_requests', allListingIds, 'listing_id')
  counts.boosts = await deleteIds('boosts', allListingIds, 'listing_id')
  counts.price_history = await deleteIds('price_history', allListingIds, 'listing_id')
  counts.notifications = await deleteIds('notifications', NOTIFICATIONS.map((n) => uid(`notif:${n.key}`)))
  if (personaIds.length) counts.notifications += await deleteIds('notifications', personaIds, 'user_id')
  counts.saved_searches = await deleteIds('saved_searches', SAVED_SEARCHES.map((s) => uid(`ss:${s.key}`)))
  counts.addresses = await deleteIds('addresses', [uid('addr:e2e:1'), uid('addr:e2e:2'), ...PEOPLE.map((p) => uid(`addr:${p.key}:1`))])
  counts.image_hashes = await deleteIds('image_hashes', allListingIds, 'listing_id')
  counts.listing_flags = await deleteIds('listing_flags', allListingIds, 'listing_id')
  counts.listings = await deleteIds('listings', allListingIds)
  // One-time cleanup: the tester's empty untitled drafts left behind by sell-form testing.
  const blankDrafts = (await must(db.from('listings').select('id, title, images').eq('seller_id', e2eUser.id).eq('status', 'draft'), 'blank drafts')) ?? []
  const blankIds = blankDrafts.filter((d) => !d.title && (!d.images || d.images.length === 0)).map((d) => d.id)
  if (blankIds.length) counts.blank_drafts = await deleteIds('listings', blankIds)
  console.log('  removed:', Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing')
}

async function recomputeSalesCounts(sellerIds) {
  for (const id of sellerIds) {
    const rows = (await must(db.from('orders').select('id').eq('seller_id', id).neq('state', 'cancelled'), 'count sales')) ?? []
    await must(db.from('profiles').update({ lifetime_sales_count: rows.length }).eq('id', id), 'lifetime_sales_count')
  }
}

if (WIPE_ONLY) {
  await recomputeSalesCounts([e2eUser.id, ...personaIds])
  if (personaIds.length) {
    await must(db.from('profiles').update({ current_seller_tier_bps: null, seller_tier_locked_until: null }).in('id', personaIds), 'reset persona tiers')
  }
  await must(db.from('profiles').update({ current_seller_tier_bps: null, seller_tier_locked_until: null, saved_visited_at: null }).eq('id', e2eUser.id), 'reset e2e tier')
  if (WIPE_USERS) {
    for (const p of PEOPLE) if (USER_ID[p.key]) {
      await must(db.from('profiles').delete().eq('id', USER_ID[p.key]), `delete profile ${p.username}`)
      await must(db.auth.admin.deleteUser(USER_ID[p.key]), `delete user ${p.email}`)
    }
    console.log(`  deleted ${personaIds.length} qa-* accounts`)
  }
  console.log('Wipe complete.')
  process.exit(0)
}

// 3. profiles + addresses ---------------------------------------------------
console.log('— profiles')
for (const p of PEOPLE) {
  const row = {
    id: USER_ID[p.key], username: p.username, display_name: p.display, role: 'member', sizes: p.sizes,
    id_verified: p.verified, id_verification_status: p.verified ? 'verified' : 'unverified',
    id_verified_at: p.verified ? ago(90) : null,
    is_moderator: !!p.moderator, moderator_since: p.moderator ? ago(120) : null,
    payouts_enabled: !!(p.payouts && connectAccountId), stripe_connect_account_id: p.payouts && connectAccountId ? connectAccountId : null,
  }
  await must(db.from('profiles').upsert(row, { onConflict: 'id' }), `profile ${p.username}`)
}
await must(db.from('profiles').update({
  display_name: E2E.display, sizes: E2E.sizes, id_verified: true, id_verification_status: 'verified', id_verified_at: ago(200),
  saved_visited_at: ago(7), hide_not_my_size: false,
}).eq('id', e2eUser.id), 'e2e profile')

const addressRows = [
  { id: uid('addr:e2e:2'), user_id: e2eUser.id, ...E2E.addr2, is_default: false, created_at: ago(120) },
  { id: uid('addr:e2e:1'), user_id: e2eUser.id, ...E2E.addr, is_default: true, created_at: ago(300) },
  ...PEOPLE.map((p) => ({ id: uid(`addr:${p.key}:1`), user_id: USER_ID[p.key], ...p.addr, is_default: true, created_at: ago(60) })),
]
for (const a of addressRows) await must(db.from('addresses').insert(a), `address ${a.name}`) // one at a time: the default trigger mirrors into profiles
const ADDR = { e2e: E2E.addr, ...Object.fromEntries(PEOPLE.map((p) => [p.key, p.addr])) }

// 4. photos -----------------------------------------------------------------
let sharp = null
try { sharp = (await import('sharp')).default } catch { console.warn('  sharp unavailable — uploading originals only (no detail crops)') }
const CACHE = join(tmpdir(), 'qa-seed-photos')
mkdirSync(CACHE, { recursive: true })
async function download(url) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.jpg')
  if (existsSync(file)) return readFileSync(file)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(file, buf)
  return buf
}
const CROPS = ['upper', 'lower', 'center']
async function renderPhotos(sources, n) {
  // Originals first (resized), then detail crops until we reach n.
  const out = []
  for (const url of sources.slice(0, n)) {
    const buf = await download(url)
    out.push(sharp ? await sharp(buf).rotate().resize({ height: 1600, withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer() : buf)
  }
  let i = 0
  while (out.length < n && sharp && sources.length) {
    const src = await download(sources[i % sources.length])
    const region = CROPS[Math.floor(i / sources.length) % CROPS.length]
    const meta = await sharp(src).metadata()
    const w = meta.width, h = meta.height
    const ch = Math.round(h * 0.55)
    const cw = Math.min(w, Math.round(ch * 0.75))
    const top = region === 'upper' ? Math.round(h * 0.1) : region === 'lower' ? Math.round(h * 0.42) : Math.round(h * 0.25)
    const left = Math.round((w - cw) / 2)
    out.push(await sharp(src).extract({ left, top, width: cw, height: Math.min(ch, h - top) }).resize({ height: 1400 }).jpeg({ quality: 84 }).toBuffer())
    i++
    if (i > n * 3) break
  }
  return out
}
const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
async function uploadPhotos(listing) {
  const sellerId = idOf(listing.seller)
  const n = listing.n
  const paths = Array.from({ length: n }, (_, i) => `listings/${sellerId}/${listing.id}/p-${i + 1}.jpg`)
  if (SKIP_IMAGES || n === 0) return paths.map(publicUrl)
  const bufs = await renderPhotos(sourcePhotos(listing.handles), n)
  const urls = []
  for (let i = 0; i < bufs.length; i++) {
    const { error } = await db.storage.from(BUCKET).upload(paths[i], bufs[i], { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
    if (error) throw new Error(`upload ${paths[i]}: ${error.message}`)
    urls.push(publicUrl(paths[i]))
  }
  return urls
}

// 5. listings ---------------------------------------------------------------
console.log(`— listings (${LISTINGS.length})${SKIP_IMAGES ? ' — reusing photos from a previous run' : ' — downloading + uploading photos'}`)
const listingRows = []
const priceHistoryRows = []
let photoCount = 0
for (const l of LISTINGS) {
  const images = await uploadPhotos(l)
  photoCount += images.length
  l.images = images
  const status = l.status ?? 'active'
  const created = ago(l.created)
  const updated = l.soldAt !== undefined ? ago(l.soldAt) : created
  listingRows.push({
    id: l.id, seller_id: idOf(l.seller), title: l.title, brand: l.brand, category: l.category, subcategory: l.subcategory,
    department: l.department, size: l.size, color: l.color, description: l.desc ?? '', price_cents: l.price,
    images, possession_photo_url: null, measurements: l.meas ?? {}, status,
    is_price_dropped: !!(l.was && l.was.length), view_count: l.views ?? 0,
    shipping_cents: l.category ? domesticShipping(l.category) : null, shipping_source: 'preset',
    ships_from: l.shipsFrom ?? 'US', intl_shipping: l.intl ?? {},
    authentication_status: l.auth ?? 'none', rejection_reason: l.rejection ?? null,
    boosted_until: l.boostDays ? ahead(l.boostDays) : null,
    bumped_at: created, bumped_price_cents: l.price, created_at: created, updated_at: updated,
  })
  if (l.was && l.was.length) {
    // Drops spread evenly over the listing's life; `dropAgo` pins the LAST drop (e.g. 2 days
    // ago) so the saved page's "since last visit" count and a price_drop notification line up.
    const steps = [...l.was, l.price]
    for (let i = 1; i < steps.length; i++) {
      const last = i === steps.length - 1
      const at = last && l.dropAgo !== undefined ? ago(l.dropAgo) : ago(l.created * (1 - i / steps.length))
      priceHistoryRows.push({ id: uid(`ph:${l.key}:${i}`), listing_id: l.id, old_price_cents: steps[i - 1], new_price_cents: steps[i], changed_at: at })
    }
  }
  process.stdout.write(`  ${l.key} (${images.length} photos)\n`)
}
await insertChunked('listings', listingRows)
await insertChunked('price_history', priceHistoryRows)
await insertChunked('boosts', BOOSTS.map((b) => ({ id: uid(`boost:${b.key}`), listing_id: L[b.listing].id, seller_id: idOf(L[b.listing].seller), package: b.package, duration_days: b.days, amount_cents: b.amount, status: 'active', stripe_payment_intent_id: `pi_qa_${b.key}`, starts_at: ago(b.startedAgo), ends_at: ahead(b.days - b.startedAgo), created_at: ago(b.startedAgo) })))
// saves_count is trigger-maintained on saves insert (below).

// 6. conversations / messages / offers ------------------------------------------
console.log(`— conversations (${CONVERSATIONS.length})`)
const convRows = [], msgRows = [], offerRows = [], readRows = []
for (const c of CONVERSATIONS) {
  const buyerId = idOf(c.buyer), sellerId = idOf(c.sellerKey)
  const lastAt = c.msgs.reduce((m, [, , d, h]) => Math.max(m, NOW - d * DAY - h * HOUR), 0)
  convRows.push({ id: c.id, listing_id: c.listingId, buyer_id: buyerId, seller_id: sellerId, created_at: ago(c.created[0], c.created[1]), updated_at: new Date(lastAt).toISOString(), comments_consent_buyer: c.key === 'c-soloist-lowell', comments_consent_seller: c.key === 'c-soloist-lowell' })
  c.msgs.forEach(([from, body, d, h], i) => msgRows.push({ id: uid(`msg:${c.key}:${i}`), conversation_id: c.id, sender_id: idOf(from), body, created_at: ago(d, h) }))
  for (const o of c.offers) {
    const at = ago(o.at[0], o.at[1])
    offerRows.push({ id: o.id, conversation_id: c.id, listing_id: c.listingId, from_user: idOf(o.from), amount_cents: o.amount, state: o.state, expires_at: new Date(Date.parse(at) + o.expiresH * HOUR).toISOString(), accepted_at: o.acceptedAt ? ago(o.acceptedAt[0], o.acceptedAt[1]) : null, created_at: at })
  }
  for (const [who, [d, h]] of Object.entries(c.read)) readRows.push({ conversation_id: c.id, user_id: idOf(who), last_read_at: ago(d, h) })
}
await insertChunked('conversations', convRows)
await insertChunked('messages', msgRows)
await insertChunked('offers', offerRows)
await insertChunked('conversation_reads', readRows)

// 7. orders / events / disputes / strikes / reviews ---------------------------------
console.log(`— orders (${ORDERS.length})`)
const orderRows = [], eventRows = []
for (const o of ORDERS) {
  const buyerId = idOf(o.buyer), sellerId = idOf(o.sellerKey)
  const ship = ADDR[o.buyer]
  const snapshot = { name: ship.name, street1: ship.street1, street2: ship.street2, city: ship.city, state: ship.state, zip: ship.zip, country: ship.country }
  const t = (d) => (d === undefined ? null : ago(d))
  orderRows.push({
    id: o.id, listing_id: o.listingId, buyer_id: buyerId, seller_id: sellerId, ...o.amounts,
    stripe_payment_intent_id: `pi_qa_${o.key}`, stripe_transfer_id: o.state === 'released' ? `tr_qa_${o.key}` : null,
    carrier: o.carrier ?? null, tracking_number: o.tracking ?? null,
    shipping_address: snapshot, ship_to_address: snapshot, label_mode: o.label, shipping_region: o.label === 'seller' ? o.region : 'domestic',
    fee_mode: o.fee, state: o.state,
    paid_at: ago(o.created), seller_confirmed_at: t(o.confirm), shipped_at: t(o.ship), delivered_at: t(o.deliver), released_at: t(o.release),
    disputed_at: t(o.dispute), refunded_at: t(o.refund), cancelled_at: t(o.cancel), created_at: ago(o.created), updated_at: ago(Math.min(...[o.created, o.confirm, o.ship, o.deliver, o.release, o.dispute, o.refund, o.cancel].filter((x) => x !== undefined))),
  })
  const chain = [[null, 'paid_held', 'webhook', o.created]]
  if (o.confirm !== undefined) chain.push(['paid_held', 'seller_confirmed', 'user', o.confirm])
  if (o.ship !== undefined) chain.push(['seller_confirmed', 'shipped', 'user', o.ship])
  if (o.deliver !== undefined) chain.push(['shipped', 'delivered', o.key === 'ord-raf' ? 'user' : 'cron', o.deliver])
  if (o.dispute !== undefined) chain.push(['delivered', 'disputed', 'user', o.dispute])
  if (o.release !== undefined) chain.push(['delivered', 'released', 'cron', o.release])
  if (o.refund !== undefined) chain.push(['disputed', 'refunded', 'admin', o.refund])
  if (o.cancel !== undefined) chain.push(['paid_held', 'cancelled', 'admin', o.cancel])
  chain.forEach(([from, to, source, d], i) => eventRows.push({ id: uid(`evt:${o.key}:${i}`), order_id: o.id, from_state: from, to_state: to, source, stripe_event_id: i === 0 ? `evt_qa_${o.key}` : null, payload: i === 0 ? { payment_intent_id: `pi_qa_${o.key}` } : null, created_at: ago(d) }))
}
await insertChunked('orders', orderRows)
await insertChunked('order_events', eventRows)
await insertChunked('disputes', DISPUTES.map((d) => ({ id: uid(`dispute:${d.key}`), order_id: ORD[d.order].id, buyer_id: idOf(d.buyer), description: d.description, photos: L[d.photosFrom].images.slice(0, 2), resolution: d.resolution ?? null, resolved_by: d.resolution ? (adminUser?.id ?? null) : null, resolved_at: d.resolvedAt ? ago(d.resolvedAt) : null, created_at: ago(d.at) })))
await insertChunked('buyer_strikes', STRIKES.map((s) => ({ id: uid(`strike:${s.key}`), user_id: idOf(s.user), offer_id: OFFER[s.offer].id, order_id: null, reason: s.reason, created_at: ago(s.at) })))
await insertChunked('reviews', REVIEWS.map((r) => { const o = ORD[r.order]; const b2s = r.dir === 'buyer_to_seller'; return { id: uid(`review:${r.order}:${r.dir}`), order_id: o.id, reviewer_id: idOf(b2s ? o.buyer : o.sellerKey), subject_id: idOf(b2s ? o.sellerKey : o.buyer), direction: r.dir, stars: r.stars, body: r.body, tags: r.tags, photos: [], created_at: ago(r.at), updated_at: ago(r.at) } }))

// 8. saves / follows / searches / measurements / comments / reports / notifications ----
console.log('— saves, follows, saved searches, legit-check threads, notifications')
await insertChunked('saves', SAVES.map(([u, l, d]) => ({ id: uid(`save:${u}:${l}`), user_id: idOf(u), listing_id: L[l].id, created_at: ago(d) })))
await insertChunked('follows', FOLLOWS.map(([a, b, d]) => ({ id: uid(`follow:${a}:${b}`), follower_id: idOf(a), following_id: idOf(b), created_at: ago(d) })))
await insertChunked('saved_searches', SAVED_SEARCHES.map((s) => ({ id: uid(`ss:${s.key}`), user_id: idOf(s.user), query: s.query, alerts_enabled: s.alerts, last_seen_at: ago(s.lastSeen), created_at: ago(s.created) })))
await insertChunked('measurement_requests', MEASUREMENT_REQUESTS.map((m) => ({ id: uid(`mr:${m.key}`), listing_id: L[m.listing].id, requester_id: idOf(m.requester), fulfilled_at: m.fulfilled ? ago(m.fulfilled) : null, created_at: ago(m.at) })))
await insertChunked('comments', COMMENTS.map((c) => ({ id: uid(`comment:${c.key}`), listing_id: L[c.listing].id, author_id: c.author ? idOf(c.author) : null, parent_id: c.parent ? uid(`comment:${c.parent}`) : null, thread_type: 'lc', body: c.body, status: 'visible', redacted: false, pinned: !!c.pinned, source: c.source ?? 'human', verdict: c.verdict ?? null, vote: c.vote ?? null, created_at: ago(c.at) })))
await insertChunked('reports', REPORTS.map((r) => ({ id: uid(`report:${r.key}`), reporter_id: idOf(r.reporter), target_type: r.targetType, target_id: uid(`conv:${r.target}`), reason: r.reason, created_at: ago(r.at) })))
await insertChunked('notifications', NOTIFICATIONS.map((n) => ({ id: uid(`notif:${n.key}`), user_id: idOf(n.user), type: n.type, title: n.title, body: n.body, url: n.url(), data: {}, read_at: n.read ? ago(n.at[0], n.at[1] - 0.5) : null, created_at: ago(n.at[0], n.at[1]) })))

// 9. tier state + sales counts ------------------------------------------------
await recomputeSalesCounts([e2eUser.id, ...personaIds])
await must(db.from('profiles').update({ current_seller_tier_bps: 700, seller_tier_locked_until: ahead(30), current_buyer_tier_bps: null, buyer_tier_locked_until: null }).eq('id', e2eUser.id), 'e2e tier')

// 10. summary -----------------------------------------------------------------
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const e2eProfile = await must(db.from('profiles').select('username, lifetime_sales_count').eq('id', e2eUser.id).single(), 'e2e summary')
console.log(`
Seed complete.
  listings ${listingRows.length} (${photoCount} photos) · conversations ${convRows.length} · messages ${msgRows.length} · offers ${offerRows.length}
  orders ${orderRows.length} · events ${eventRows.length} · reviews ${REVIEWS.length} · comments ${COMMENTS.length} · notifications ${NOTIFICATIONS.length}
  tester @${e2eProfile.username}: lifetime sales ${e2eProfile.lifetime_sales_count}, seller tier 2 (7.0%), lock until ${ahead(30).slice(0, 10)}

Accounts (all qa-* personas share one password, saved in .env.qa.local):
  ${BUYER_EMAIL.padEnd(26)} password: TEST_BUYER_PASSWORD from .env.local   (the tester)
${PEOPLE.map((p) => `  ${p.email.padEnd(26)} @${p.username.padEnd(16)} ${p.display}${p.moderator ? ' (moderator)' : ''}${p.key === 'kenji' ? ' (ships from Tokyo)' : ''}${p.key === 'ines' ? ' (Toronto buyer)' : ''}`).join('\n')}
  password: ${qaPassword}

Start here: ${appUrl}/browse · ${appUrl}/messages · ${appUrl}/settings/orders · ${appUrl}/saved · ${appUrl}/sell
`)
