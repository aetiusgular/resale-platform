/**
 * Field cleaning shared by the draft and edit routes. Everything is optional
 * (drafts are partial); values are trimmed, cased and validated against the
 * taxonomy, and anything unknown is dropped. PURE.
 */
import { CATEGORIES, COLOR_LABELS, DEPARTMENTS, isValidSubcategory, normalizeMeasurements } from '@/lib/taxonomy'

export interface DraftFields {
  title?: string | null
  brand?: string | null
  category?: string | null
  department?: string
  subcategory?: string | null
  size?: string | null
  color?: string | null
  description?: string
  condition_score?: number | null
  condition_notes?: Record<string, unknown>
  price_cents?: number | null
  images?: string[]
  possession_photo_url?: string | null
  measurements?: Record<string, number>
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

export function cleanDraftFields(body: Record<string, unknown>): DraftFields {
  const out: DraftFields = {}
  const title = str(body.title, 120)
  if (title !== undefined) out.title = title || null
  const brand = str(body.brand, 80)
  if (brand !== undefined) out.brand = brand ? brand.toUpperCase() : null
  const category = str(body.category, 40)
  if (category !== undefined) out.category = category && CATEGORIES.includes(category) ? category : null
  const department = str(body.department, 20)
  if (department !== undefined && (DEPARTMENTS as readonly string[]).includes(department)) out.department = department
  const cat = out.category ?? (typeof body.current_category === 'string' ? body.current_category : null)
  const subcategory = str(body.subcategory, 60)
  if (subcategory !== undefined) out.subcategory = subcategory && cat && isValidSubcategory(cat, subcategory) ? subcategory : null
  const size = str(body.size, 30)
  if (size !== undefined) out.size = size ? size.toUpperCase() : null
  const color = str(body.color, 20)
  if (color !== undefined) out.color = color && COLOR_LABELS.includes(color) ? color : null
  const description = str(body.description, 1000)
  if (description !== undefined) out.description = description
  if (body.condition_score !== undefined) {
    const n = Number(body.condition_score)
    out.condition_score = Number.isInteger(n) && n >= 1 && n <= 10 ? n : null
  }
  if (body.condition_notes && typeof body.condition_notes === 'object') out.condition_notes = body.condition_notes as Record<string, unknown>
  if (body.price_cents !== undefined) {
    const n = Number(body.price_cents)
    out.price_cents = Number.isInteger(n) && n > 0 && n <= 100_000_000 ? n : null
  }
  if (Array.isArray(body.images)) out.images = body.images.filter((u): u is string => typeof u === 'string').slice(0, 6)
  const poss = str(body.possession_photo_url, 500)
  if (poss !== undefined) out.possession_photo_url = poss || null
  if (body.measurements !== undefined) out.measurements = normalizeMeasurements(body.measurements, cat)
  return out
}
