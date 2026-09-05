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

/** Colour filter (rail: swatch + label). Stored on listings.color as the label. */
export const COLORS: ReadonlyArray<{ label: string; swatch: string }> = [
  { label: 'Black', swatch: '#161616' },
  { label: 'White', swatch: '#fbfbf9' },
  { label: 'Grey',  swatch: '#8a8a86' },
  { label: 'Cream', swatch: '#e6dcc3' },
  { label: 'Navy',  swatch: '#2c3550' },
  { label: 'Brown', swatch: '#6d4a2f' },
  { label: 'Olive', swatch: '#62653c' },
  { label: 'Multi', swatch: 'linear-gradient(135deg,#b3382f 0 25%,#2c62b8 0 50%,#d9a52a 0 75%,#3c7a3f 0)' },
]
export const COLOR_LABELS = COLORS.map((c) => c.label)

/**
 * Flat measurements (inches) the wizard asks for and the listing page shows,
 * by category. Stored on listings.measurements as { LABEL: inches }.
 */
const TOP_MEAS    = ['PIT TO PIT', 'LENGTH', 'SHOULDER', 'SLEEVE'] as const
const BOTTOM_MEAS = ['WAIST', 'INSEAM', 'RISE', 'LEG OPENING'] as const
const SHOE_MEAS   = ['INSOLE', 'WIDTH', 'HEEL', 'SHAFT'] as const
const ACC_MEAS    = ['LENGTH', 'WIDTH', 'HEIGHT', 'STRAP'] as const

export function measurementLabelsFor(category: string | null | undefined): ReadonlyArray<string> {
  switch (category) {
    case 'Bottoms': return BOTTOM_MEAS
    case 'Footwear': return SHOE_MEAS
    case 'Accessories': return ACC_MEAS
    default: return TOP_MEAS // tops, outerwear, knitwear, tailoring, sportswear, other
  }
}

export const MEASUREMENT_MAX_INCHES = 200

/**
 * Validate a client-supplied measurements object: known labels for the category,
 * finite positive inches (≤ 200), at most 8 entries. Returns the cleaned map.
 */
export function normalizeMeasurements(raw: unknown, category: string | null | undefined): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const allowed = new Set(measurementLabelsFor(category))
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const label = String(k).trim().toUpperCase()
    if (!allowed.has(label)) continue
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
