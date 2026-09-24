/**
 * Catalog taxonomy — the vocabulary the browse rail, the listing wizard and the
 * listings API all validate against (ARCHIVE design review, option 16A).
 *
 * PURE: no I/O, importable from client and server. Values are stored exactly as
 * written here (department lowercase, category / subcategory / color as labels).
 */

export const DEPARTMENTS = ['menswear', 'womenswear', 'unisex'] as const
export type Department = (typeof DEPARTMENTS)[number]

/** Top-level categories with their subcategory trees (rail: "Tops +" expands). */
export const CATEGORY_TREE: ReadonlyArray<{ label: string; children: ReadonlyArray<string> }> = [
  { label: 'Outerwear',   children: ['Bombers', 'Coats', 'Denim', 'Leather', 'Parkas', 'Vests', 'Other outerwear'] },
  { label: 'Tops',        children: ['Short-sleeve tees', 'Button-up shirts', 'Long-sleeve tees', 'Sweaters & knitwear', 'Sweatshirts & hoodies', 'Polos', 'Tanks & sleeveless', 'Jerseys'] },
  { label: 'Bottoms',     children: ['Denim', 'Sweatpants & joggers', 'Casual pants', 'Shorts', 'Other bottoms'] },
  { label: 'Footwear',    children: ['Boots', 'Derbies', 'Loafers', 'Low-top sneakers', 'High-top sneakers', 'Sandals', 'Other footwear'] },
  { label: 'Accessories', children: ['Bags', 'Belts', 'Hats', 'Jewelry', 'Scarves', 'Wallets', 'Other accessories'] },
  { label: 'Tailoring',   children: ['Blazers', 'Suits', 'Trousers', 'Waistcoats'] },
  { label: 'Knitwear',    children: ['Cardigans', 'Crewnecks', 'Turtlenecks', 'Other knitwear'] },
  { label: 'Sportswear',  children: ['Track jackets', 'Track pants', 'Performance tees', 'Athletic shorts', 'Team jerseys', 'Other sportswear'] },
  { label: 'Other',       children: ['Swimwear', 'Loungewear', 'Underwear & socks', 'Costumes & uniforms', 'Miscellaneous'] },
]

export const CATEGORIES = CATEGORY_TREE.map((c) => c.label)

export function subcategoriesOf(category: string): ReadonlyArray<string> {
  return CATEGORY_TREE.find((c) => c.label === category)?.children ?? []
}

export function isValidSubcategory(category: string, subcategory: string): boolean {
  return subcategoriesOf(category).includes(subcategory)
}

// ── Rail selection (DEPARTMENT + CATEGORY are multi-select) ──────────────────
//
// URL contract: `dept` csv of departments, `cat` csv of WHOLE categories ("All tops"),
// `subcat` csv of subcategory picks keyed `Category:Subcategory` — a label can live under
// two categories (Denim: Outerwear + Bottoms), so picks are qualified. Bare labels in old
// links still resolve through the tree. A category with picks is narrowed to them, so it
// never also appears in `cat`.

export const SUBCAT_SEP = ':'

export function subcatKey(category: string, sub: string): string {
  return `${category}${SUBCAT_SEP}${sub}`
}

/** `Tops:Polos` → { category, sub }; null when the pair is not in the tree. */
export function parseSubcatKey(key: string): { category: string; sub: string } | null {
  const i = key.indexOf(SUBCAT_SEP)
  if (i <= 0) return null
  const category = key.slice(0, i).trim()
  const sub = key.slice(i + 1).trim()
  return isValidSubcategory(category, sub) ? { category, sub } : null
}

/** Every category whose tree carries this bare subcategory label. */
export function categoriesWithSubcategory(sub: string): string[] {
  return CATEGORY_TREE.filter((c) => c.children.includes(sub)).map((c) => c.label)
}

export interface CategorySelection {
  /** Whole categories ("All <cat>" rows), tree order. */
  cats: string[]
  /** Qualified subcategory picks (`Tops:Polos`), tree order. */
  picks: string[]
}

/**
 * Resolves the `cat` / `subcat` URL lists into whole categories + qualified picks.
 * Unknown values are dropped. A bare subcategory label resolves to the listed category
 * that has it, else to every category that has it. A category with picks is narrowed
 * to them and leaves the whole-category list.
 */
export function resolveCategorySelection(cats: ReadonlyArray<string>, subcats: ReadonlyArray<string>): CategorySelection {
  const whole = new Set(cats.filter((c) => CATEGORIES.includes(c)))
  const picks = new Set<string>()
  for (const raw of subcats) {
    const qualified = parseSubcatKey(raw)
    if (qualified) { picks.add(subcatKey(qualified.category, qualified.sub)); continue }
    const owners = categoriesWithSubcategory(raw)
    const listed = owners.filter((c) => whole.has(c))
    for (const c of listed.length ? listed : owners) picks.add(subcatKey(c, raw))
  }
  // Every child of a category picked = the whole category (the rail shows "All <cat>" ticked
  // and it also keeps listings that carry no subcategory).
  for (const node of CATEGORY_TREE) {
    if (node.children.every((sub) => picks.has(subcatKey(node.label, sub)))) {
      for (const sub of node.children) picks.delete(subcatKey(node.label, sub))
      whole.add(node.label)
    }
  }
  const narrowed = new Set(Array.from(picks, (k) => k.slice(0, k.indexOf(SUBCAT_SEP))))
  const orderedPicks: string[] = []
  for (const node of CATEGORY_TREE) for (const sub of node.children) {
    const k = subcatKey(node.label, sub)
    if (picks.has(k)) orderedPicks.push(k)
  }
  return { cats: CATEGORIES.filter((c) => whole.has(c) && !narrowed.has(c)), picks: orderedPicks }
}

/** Picks grouped by category, tree order. */
export function picksByCategory(picks: ReadonlyArray<string>): Array<{ category: string; subs: string[] }> {
  const groups: Array<{ category: string; subs: string[] }> = []
  for (const node of CATEGORY_TREE) {
    const subs = node.children.filter((sub) => picks.includes(subcatKey(node.label, sub)))
    if (subs.length) groups.push({ category: node.label, subs })
  }
  return groups
}

/** Results header "results in <dept> / <cat>": 'All', one name, two names, or "n categories". */
export function categoryScopeLabel(sel: CategorySelection): string {
  const groups = picksByCategory(sel.picks)
  const labels = CATEGORIES.filter((c) => sel.cats.includes(c) || groups.some((g) => g.category === c)).map((c) => {
    const g = groups.find((x) => x.category === c)
    return g && g.subs.length === 1 && !sel.cats.includes(c) ? g.subs[0] : c
  })
  if (labels.length === 0) return 'All'
  if (labels.length <= 2) return labels.join(' + ')
  return `${labels.length} categories`
}

export function departmentScopeLabel(depts: ReadonlyArray<string>): string {
  const valid = DEPARTMENTS.filter((d) => depts.includes(d))
  if (valid.length === 0 || valid.length === DEPARTMENTS.length) return 'All'
  return valid.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ')
}

// ── Colours ──────────────────────────────────────────────────────────────────
//
// ONE list for the browse rail, the sell form and the listings API. Stored on
// listings.color as the label and matched exactly (`in('color', …)`), so a label
// is a data value: the eight original labels (Black, White, Grey, Cream, Navy,
// Brown, Olive, Multi) are kept verbatim and every row written so far still
// filters.
//
// The set comes from the filters of the platforms this catalogue competes with
// (Grailed 15 · Vinted 29 · SSENSE 14 · END. 15) and Google's 13 standard colour
// families, cut to what a second-hand clothing catalogue needs: the core every
// platform shares (black, white, grey, brown, blue, green, red, yellow, orange,
// pink, purple, multi), the neutrals menswear splits (cream, beige, tan,
// charcoal), the shades that decide a purchase (navy vs blue vs light blue,
// olive vs green, burgundy vs red, teal) and the two metals accessories need.
// Order is the rail order: neutrals dark → light, then blues, greens, warm,
// pink / purple, metals, multi.
//
// `aliases` are the words people type for a colour that isn't its label
// ("gray", "ivory", "off-white", "khaki", "oxblood"). They only drive the
// type-ahead (`searchColors`) and are never stored; an alias may sit on two
// colours when the word is ambiguous (khaki is tan in the US and green in the UK).

export interface ColorOption {
  /** Stored value and display label. */
  label: string
  /** CSS background of the swatch dot — flat colours; Multi is the one gradient. */
  swatch: string
  /** Lower-case search terms that surface this colour besides its label. */
  aliases: ReadonlyArray<string>
}

export const COLORS: ReadonlyArray<ColorOption> = [
  { label: 'Black',      swatch: '#161616', aliases: ['jet black', 'faded black', 'washed black'] },
  { label: 'Charcoal',   swatch: '#3c3c3a', aliases: ['dark grey', 'dark gray', 'anthracite', 'graphite', 'gunmetal'] },
  { label: 'Grey',       swatch: '#8a8a86', aliases: ['gray', 'heather', 'heather grey', 'heather gray', 'slate', 'ash', 'light grey', 'light gray'] },
  { label: 'White',      swatch: '#fbfbf9', aliases: ['optic white', 'bright white', 'snow'] },
  { label: 'Cream',      swatch: '#efe7d3', aliases: ['ivory', 'off-white', 'off white', 'ecru', 'bone', 'eggshell', 'natural', 'milk', 'vanilla', 'oatmeal'] },
  { label: 'Beige',      swatch: '#d6c4a0', aliases: ['sand', 'stone', 'nude', 'putty', 'khaki', 'taupe', 'oatmeal', 'wheat', 'light brown'] },
  { label: 'Tan',        swatch: '#b98b5b', aliases: ['camel', 'caramel', 'khaki', 'saddle', 'toffee', 'cognac', 'light brown'] },
  { label: 'Brown',      swatch: '#6d4a2f', aliases: ['chocolate', 'coffee', 'espresso', 'chestnut', 'mocha', 'cognac', 'walnut', 'dark brown'] },
  { label: 'Navy',       swatch: '#2c3550', aliases: ['dark blue', 'midnight', 'marine', 'indigo'] },
  { label: 'Blue',       swatch: '#3b63a8', aliases: ['cobalt', 'royal blue', 'indigo', 'denim', 'electric blue', 'medium blue'] },
  { label: 'Light blue', swatch: '#9ebbd8', aliases: ['sky blue', 'baby blue', 'powder blue', 'pale blue', 'ice blue', 'light wash'] },
  { label: 'Teal',       swatch: '#2f7f82', aliases: ['turquoise', 'aqua', 'cyan', 'sea green', 'petrol', 'dark teal'] },
  { label: 'Green',      swatch: '#3f6f46', aliases: ['forest', 'forest green', 'hunter green', 'emerald', 'kelly green', 'bottle green', 'dark green', 'mint', 'lime', 'sage'] },
  { label: 'Olive',      swatch: '#62653c', aliases: ['army green', 'military green', 'khaki', 'moss', 'sage', 'fatigue', 'olive drab'] },
  { label: 'Yellow',     swatch: '#e0c34a', aliases: ['mustard', 'lemon', 'canary', 'butter', 'pale yellow'] },
  { label: 'Orange',     swatch: '#df772f', aliases: ['rust', 'burnt orange', 'apricot', 'peach', 'tangerine', 'coral', 'terracotta'] },
  { label: 'Red',        swatch: '#b3382f', aliases: ['crimson', 'scarlet', 'cherry', 'brick', 'bright red'] },
  { label: 'Burgundy',   swatch: '#6e2231', aliases: ['maroon', 'wine', 'oxblood', 'bordeaux', 'dark red', 'merlot', 'claret'] },
  { label: 'Pink',       swatch: '#e2a3b5', aliases: ['rose', 'blush', 'salmon', 'coral', 'hot pink', 'fuchsia', 'magenta', 'dusty pink'] },
  { label: 'Purple',     swatch: '#6e4b8e', aliases: ['lilac', 'lavender', 'violet', 'plum', 'mauve', 'aubergine', 'eggplant'] },
  { label: 'Silver',     swatch: '#c3c3c0', aliases: ['metallic', 'metal', 'chrome', 'steel', 'platinum'] },
  { label: 'Gold',       swatch: '#c9a54a', aliases: ['metallic', 'metal', 'brass', 'bronze', 'copper', 'champagne'] },
  { label: 'Multi',      swatch: 'linear-gradient(135deg,#b3382f 0 25%,#2c62b8 0 50%,#d9a52a 0 75%,#3c7a3f 0)', aliases: ['multicolor', 'multicolour', 'multi-color', 'multi-colour', 'mixed', 'print', 'printed', 'pattern', 'patterned', 'camo', 'camouflage', 'plaid', 'check', 'striped', 'stripes', 'tie dye', 'tie-dye', 'colorful', 'colourful', 'rainbow'] },
]
export const COLOR_LABELS = COLORS.map((c) => c.label)

const normColor = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const colorWords = (s: string) => s.split(/[\s-]+/)

export function colorByLabel(label: string | null | undefined): ColorOption | undefined {
  if (typeof label !== 'string') return undefined
  const q = normColor(label)
  return COLORS.find((c) => c.label.toLowerCase() === q)
}

/**
 * The stored label for a client-supplied colour, matched case-insensitively on the
 * label only ('navy' → 'Navy'); null when it is not a listed colour. Aliases are
 * deliberately NOT accepted here: "khaki" is two colours, and a seller picks from
 * the list in every client, so the API never has to guess.
 */
export function canonicalColor(raw: unknown): string | null {
  return typeof raw === 'string' ? colorByLabel(raw)?.label ?? null : null
}

/**
 * Type-ahead over the colour set. '' → every colour in rail order. Otherwise four
 * tiers, each in rail order: labels that start with the text ("gre" → Grey, Green);
 * an alias that starts with it, or a later word of the label ("gray" → Grey, "blue" →
 * Light blue); a later word of an alias ("blue" → Navy via "dark blue", "green" →
 * Olive via "army green"); anything that merely contains it.
 */
export function searchColors(query: string): ColorOption[] {
  const q = normColor(query)
  if (!q) return [...COLORS]
  const tier = (c: ColorOption): number => {
    const label = c.label.toLowerCase()
    if (label.startsWith(q)) return 0
    if (colorWords(label).slice(1).some((w) => w.startsWith(q)) || c.aliases.some((a) => a.startsWith(q))) return 1
    if (c.aliases.some((a) => colorWords(a).slice(1).some((w) => w.startsWith(q)))) return 2
    if (label.includes(q) || c.aliases.some((a) => a.includes(q))) return 3
    return 4
  }
  return COLORS.map((c, i) => ({ c, i, t: tier(c) }))
    .filter((x) => x.t < 4)
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.c)
}

/**
 * Why a colour matched a query when its label doesn't start with it: the alias that
 * did ("ivory" for Cream, "oxblood" for Burgundy), so the type-ahead can print it
 * beside the label. Null when the label itself is the match or nothing was typed.
 */
export function colorMatchHint(c: ColorOption, query: string): string | null {
  const q = normColor(query)
  if (!q || c.label.toLowerCase().startsWith(q)) return null
  return c.aliases.find((a) => a.startsWith(q))
    ?? c.aliases.find((a) => colorWords(a).some((w) => w.startsWith(q)))
    ?? c.aliases.find((a) => a.includes(q))
    ?? null
}

/**
 * Flat measurements (inches) the listing form asks for and the listing page shows.
 * Stored on listings.measurements as { KEY: inches }; the keys below are the storage keys
 * (existing rows use them), `measurementDisplayLabel` is what the UI prints.
 *
 * Garments (everything but footwear and accessories) come in two kinds, TOPS and BOTTOMS,
 * and the seller picks the kind on the form: a "Sportswear" or "Other" listing can be
 * either. The category only sets the default; the stored keys say which kind a listing has.
 */
const TOP_MEAS    = ['PIT TO PIT', 'LENGTH', 'SHOULDER', 'SLEEVE'] as const
const BOTTOM_MEAS = ['WAIST', 'INSEAM', 'RISE', 'LEG OPENING'] as const
const SHOE_MEAS   = ['INSOLE', 'WIDTH', 'HEEL', 'SHAFT'] as const
const ACC_MEAS    = ['LENGTH', 'WIDTH', 'HEIGHT', 'STRAP'] as const

export type MeasurementKind = 'tops' | 'bottoms' | 'footwear' | 'accessories'

const KIND_LABELS: Record<MeasurementKind, ReadonlyArray<string>> = {
  tops: TOP_MEAS, bottoms: BOTTOM_MEAS, footwear: SHOE_MEAS, accessories: ACC_MEAS,
}

/** Storage key → what the form and the listing page print. */
const DISPLAY_LABELS: Record<string, string> = { 'PIT TO PIT': 'CHEST', SHOULDER: 'SHOULDERS' }

export function measurementDisplayLabel(key: string): string {
  return DISPLAY_LABELS[key] ?? key
}

/** The kind a category defaults to. */
export function measurementKindFor(category: string | null | undefined): MeasurementKind {
  switch (category) {
    case 'Bottoms': return 'bottoms'
    case 'Footwear': return 'footwear'
    case 'Accessories': return 'accessories'
    default: return 'tops' // tops, outerwear, knitwear, tailoring, sportswear, other
  }
}

/** True when the seller chooses TOPS / BOTTOMS for this category (garments). */
export function measurementKindIsChoice(category: string | null | undefined): boolean {
  const k = measurementKindFor(category)
  return k === 'tops' || k === 'bottoms'
}

/** The kind a stored measurements object was taken as, from its keys; null when empty/unknown. */
export function measurementKindOf(measurements: Record<string, unknown> | null | undefined): 'tops' | 'bottoms' | null {
  const keys = Object.keys(measurements ?? {}).map((k) => k.trim().toUpperCase())
  if (keys.some((k) => (BOTTOM_MEAS as ReadonlyArray<string>).includes(k))) return 'bottoms'
  if (keys.some((k) => (TOP_MEAS as ReadonlyArray<string>).includes(k))) return 'tops'
  return null
}

export function measurementLabelsForKind(kind: MeasurementKind): ReadonlyArray<string> {
  return KIND_LABELS[kind]
}

/**
 * Labels for a category. With `measurements`, a garment listing's stored keys decide
 * TOPS vs BOTTOMS (the seller's choice); otherwise the category default.
 */
export function measurementLabelsFor(category: string | null | undefined, measurements?: Record<string, unknown> | null): ReadonlyArray<string> {
  const kind = measurementKindFor(category)
  if (measurements && (kind === 'tops' || kind === 'bottoms')) {
    const stored = measurementKindOf(measurements)
    if (stored) return KIND_LABELS[stored]
  }
  return KIND_LABELS[kind]
}

export const MEASUREMENT_MAX_INCHES = 200

/**
 * Validate a client-supplied measurements object: finite positive inches (≤ 200), at most
 * 8 entries, known keys only. For garments the keys may be the TOPS set or the BOTTOMS set,
 * never both: a payload that mixes them keeps the category's default kind. Returns the
 * cleaned map.
 */
export function normalizeMeasurements(raw: unknown, category: string | null | undefined): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const entries = Object.entries(raw as Record<string, unknown>).map(([k, v]) => [String(k).trim().toUpperCase(), v] as const)
  const kind = measurementKindFor(category)
  let allowed: ReadonlyArray<string> = KIND_LABELS[kind]
  if (kind === 'tops' || kind === 'bottoms') {
    const hasTop = entries.some(([k]) => (TOP_MEAS as ReadonlyArray<string>).includes(k))
    const hasBottom = entries.some(([k]) => (BOTTOM_MEAS as ReadonlyArray<string>).includes(k))
    if (hasTop !== hasBottom) allowed = hasBottom ? BOTTOM_MEAS : TOP_MEAS
  }
  const allowedSet = new Set(allowed)
  const out: Record<string, number> = {}
  for (const [label, v] of entries) {
    if (!allowedSet.has(label)) continue
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : NaN
    if (!Number.isFinite(n) || n <= 0 || n > MEASUREMENT_MAX_INCHES) continue
    out[label] = Math.round(n * 10) / 10
    if (Object.keys(out).length >= 8) break
  }
  return out
}

/** Inches → display string for the IN / CM toggle. */
export function formatMeasurement(inches: number, unit: 'in' | 'cm'): string {
  return unit === 'in' ? `${inches}"` : `${(inches * 2.54).toFixed(1)} CM`
}
