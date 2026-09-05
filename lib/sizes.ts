/**
 * Size scales + helpers shared by the browse rail, the MY SIZES modal (options
 * 11A / 11B), Settings → My sizes (2C) and the sizes API.
 *
 * Storage contract (profiles.sizes): { "<dept>:<section>": string[] } — e.g.
 * { "menswear:tops": ["M","L"], "menswear:footwear": ["9","9.5"] }. Legacy rows
 * written as { tops, bottoms, footwear } are read as menswear.
 *
 * PURE: importable from client and server.
 */
export type UserSizes = Record<string, string[]>
export type SizeDept = 'menswear' | 'womenswear'
export type SizeSectionId = 'tops' | 'bottoms' | 'outerwear' | 'footwear' | 'tailoring' | 'accessories' | 'dresses'

export const SIZE_DEPTS: SizeDept[] = ['menswear', 'womenswear']
export const SIZE_SECTION_IDS: SizeSectionId[] = ['tops', 'bottoms', 'outerwear', 'footwear', 'tailoring', 'accessories', 'dresses']

const ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'OS']
const WAIST = ['26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44']
const SHOE = ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '15']
const TAILOR = ['34S', '34R', '36S', '36R', '38S', '38R', '38L', '40S', '40R', '40L', '42S', '42R', '42L', '44S', '44R', '44L', '46S', '46R', '46L', '48S', '48R', '48L', '50S', '50R', '50L', '52S', '52R', '52L', '54R', '54L']
const W_COMBO = ['XXS/00/34', 'XS/0-2/36-38', 'S/4/40', 'M/6-8/42-44', 'L/10/46', 'XL/12-14/48-50', 'XXL/16-18/52-54', '3XL/20-22', '4XL/24-26', 'OS']
const W_BOTTOMS = ['22', '23', '24/00/34', '25/0/36', '26/2/38', '27/4/40', '28/6/42', '29', '30/8/44', '31', '32/10/46', '33', '34/12/48', '35', '36/14/50', '37', '38/16/52', '39', '40/18', '41', '42/20']
const ONE_SIZE = ['ONE SIZE']

export interface SizeSection {
  id: SizeSectionId
  label: string
  scale: string[]
  cols: 3 | 5
  defaultOpen?: boolean
}

/** MY SIZES modal sections — menswear = 11A (5-col), womenswear = 11B (3-col). */
export const SIZE_SECTIONS: Record<SizeDept, SizeSection[]> = {
  menswear: [
    { id: 'tops', label: 'Tops', scale: ALPHA, cols: 5, defaultOpen: true },
    { id: 'bottoms', label: 'Bottoms', scale: WAIST, cols: 5, defaultOpen: true },
    { id: 'outerwear', label: 'Outerwear', scale: ALPHA, cols: 5 },
    { id: 'footwear', label: 'Footwear', scale: SHOE, cols: 5, defaultOpen: true },
    { id: 'tailoring', label: 'Tailoring', scale: TAILOR, cols: 5, defaultOpen: true },
    { id: 'accessories', label: 'Accessories', scale: ONE_SIZE, cols: 5 },
  ],
  womenswear: [
    { id: 'tops', label: 'Tops', scale: W_COMBO, cols: 3, defaultOpen: true },
    { id: 'dresses', label: 'Dresses', scale: W_COMBO, cols: 3, defaultOpen: true },
    { id: 'bottoms', label: 'Bottoms', scale: W_BOTTOMS, cols: 3, defaultOpen: true },
    { id: 'outerwear', label: 'Outerwear', scale: W_COMBO, cols: 3 },
    { id: 'footwear', label: 'Footwear', scale: SHOE, cols: 3 },
    { id: 'accessories', label: 'Accessories', scale: ONE_SIZE, cols: 3 },
  ],
}

export interface SettingsSizeGroup {
  id: SizeSectionId
  label: string
  cols: number
  scale: string[]
}

/** Settings → My sizes chip groups (option 2C), per department tab. */
export const SETTINGS_SIZE_GROUPS: Record<SizeDept, SettingsSizeGroup[]> = {
  menswear: [
    { id: 'tops', label: 'TOPS', cols: 7, scale: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '48'] },
    { id: 'bottoms', label: 'BOTTOMS — WAIST', cols: 9, scale: ['28', '29', '30', '31', '32', '33', '34', '36', '38'] },
    { id: 'outerwear', label: 'OUTERWEAR', cols: 7, scale: ['XS', 'S', 'M', 'L', 'XL', '50', '52'] },
    { id: 'footwear', label: 'FOOTWEAR — US', cols: 9, scale: ['8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'] },
  ],
  womenswear: [
    { id: 'tops', label: 'TOPS', cols: 5, scale: W_COMBO },
    { id: 'dresses', label: 'DRESSES', cols: 5, scale: W_COMBO },
    { id: 'bottoms', label: 'BOTTOMS', cols: 7, scale: W_BOTTOMS },
    { id: 'footwear', label: 'FOOTWEAR — US', cols: 9, scale: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'] },
  ],
}

export const sizeKey = (dept: SizeDept, section: SizeSectionId | string) => `${dept}:${section}`

const KEY_RE = /^(menswear|womenswear):(tops|bottoms|outerwear|footwear|tailoring|accessories|dresses)$/

/**
 * Normalize any stored / submitted shape into the dept-scoped contract.
 * Legacy flat keys (tops/bottoms/footwear) are read as menswear. Unknown keys
 * and non-string values are dropped; each list is capped at 20 entries.
 */
export function normalizeSizes(raw: unknown): UserSizes {
  const out: UserSizes = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue
    const key = KEY_RE.test(k) ? k : SIZE_SECTION_IDS.includes(k as SizeSectionId) ? sizeKey('menswear', k) : null
    if (!key) continue
    const list = v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 20).slice(0, 20)
    out[key] = Array.from(new Set([...(out[key] ?? []), ...list]))
  }
  return out
}

/** Every distinct size token the user selected, in section order. */
export function flattenSizes(sizes: UserSizes, dept?: SizeDept): string[] {
  const out: string[] = []
  const depts: SizeDept[] = dept ? [dept] : SIZE_DEPTS
  for (const d of depts) {
    for (const section of SIZE_SECTIONS[d]) {
      const chosen = sizes[sizeKey(d, section.id)] ?? []
      for (const s of section.scale) if (chosen.includes(s) && !out.includes(s)) out.push(s)
      for (const s of chosen) if (!out.includes(s)) out.push(s)
    }
  }
  return out
}

/** Chip label derived from saved sizes, e.g. "M · L · 29 +5" (option 16A chip). */
export function sizesChipLabel(sizes: UserSizes, dept?: SizeDept): string {
  const tokens = flattenSizes(sizes, dept)
  if (tokens.length === 0) return 'NONE SET'
  const head = tokens.slice(0, 3).join(' · ')
  return tokens.length > 3 ? `${head} +${tokens.length - 3}` : head
}

export function countSizes(sizes: UserSizes): number {
  return Object.values(sizes).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0)
}

/** Wizard SIZE select: the scale that fits a department + category (falls back to alpha). */
export function sizeScaleFor(dept: string | null | undefined, category: string | null | undefined): string[] {
  const d: SizeDept = dept === 'womenswear' ? 'womenswear' : 'menswear'
  const section: SizeSectionId =
    category === 'Bottoms' ? 'bottoms'
      : category === 'Footwear' ? 'footwear'
        : category === 'Accessories' ? 'accessories'
          : category === 'Tailoring' ? (d === 'menswear' ? 'tailoring' : 'tops')
            : category === 'Outerwear' ? 'outerwear'
              : 'tops'
  const found = SIZE_SECTIONS[d].find((s) => s.id === section) ?? SIZE_SECTIONS[d][0]
  return [...found.scale]
}
