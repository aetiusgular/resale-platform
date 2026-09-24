/**
 * Listing photos. `listings.images` is the seller's ordered list of PUBLIC photos: up to
 * MAX_PHOTOS, the first one is the cover, MIN_PHOTOS needed to publish. A possession proof,
 * when a listing has one, lives only in `possession_photo_url` and is shown to the seller
 * and admins, never to other members.
 *
 * Before the sell page redesign the array had six fixed slots (FRONT · BACK · TAG · DETAIL ·
 * FLAW · POSSESSION) with '' for an empty slot and the proof at index 5. Migration 000052
 * rewrote those rows into the list shape; `publicImages` still guards against that layout
 * (a '' entry marks it) and against a proof URL it is told about, so nothing leaks while a
 * row is in flight. Every loader that emits `images` to a viewer passes them through here.
 */
export const MAX_PHOTOS = 15
export const MIN_PHOTOS = 3

/** @deprecated The old fixed layout's public slot count; kept for the legacy guard below. */
export const PUBLIC_IMAGE_SLOTS = 5

export function publicImages(images: unknown, possessionUrl?: string | null): string[] {
  if (!Array.isArray(images)) return []
  let list = images as unknown[]
  // Old six-slot layout: '' marks an empty slot, the proof sits at index 5.
  if (list.length === 6 && list.some((u) => u === '')) list = list.slice(0, PUBLIC_IMAGE_SLOTS)
  const out: string[] = []
  for (const u of list) {
    if (typeof u !== 'string' || !u) continue
    if (possessionUrl && u === possessionUrl) continue
    if (out.includes(u)) continue
    out.push(u)
    if (out.length >= MAX_PHOTOS) break
  }
  return out
}

/** image_hashes.slot for the photo at `index` of listings.images: PHOTO_1 … PHOTO_15. */
export const photoSlotName = (index: number) => `PHOTO_${index + 1}`

/** The possession proof's image_hashes.slot (the cross-seller dedup key). */
export const POSSESSION_SLOT = 'POSSESSION'

/** Slot names the old six-slot form wrote, in listings.images order. */
const LEGACY_SLOTS: readonly string[] = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW']

/**
 * The listings.images index an image_hashes.slot refers to — PHOTO_n → n - 1, the legacy
 * FRONT … FLAW → 0 … 4 — or null for the possession slot and unknown names.
 */
export function photoIndexForSlot(slot: string): number | null {
  const m = /^PHOTO_(\d+)$/.exec(slot)
  if (m) {
    const i = Number(m[1]) - 1
    return i >= 0 && i < MAX_PHOTOS ? i : null
  }
  const legacy = LEGACY_SLOTS.indexOf(slot)
  return legacy >= 0 ? legacy : null
}

/** What a photo is called in alt text and admin labels: "cover", then "photo 2" …; "possession". */
export function photoLabel(index: number): string {
  return index === 0 ? 'cover' : `photo ${index + 1}`
}
