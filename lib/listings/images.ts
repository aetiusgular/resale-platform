/**
 * Listing photo slots: images[0..4] are the public photos (FRONT · BACK · TAG · DETAIL · FLAW);
 * images[5] is the POSSESSION proof and is never shown to other members. Every loader that emits a
 * listing's `images` to a viewer who is not the seller/admin passes them through here.
 */
export const PUBLIC_IMAGE_SLOTS = 5

/**
 * Slots are POSITIONAL and sparse: the sell form stores six entries with '' for an empty slot, and
 * only FRONT + POSSESSION are required. So the cut to slots 0–4 has to happen by index BEFORE the
 * empties are dropped — filtering first compacts the array and slides the possession proof
 * (index 5) into the public five whenever any of BACK / TAG / DETAIL / FLAW is empty.
 */
export function publicImages(images: unknown): string[] {
  if (!Array.isArray(images)) return []
  return (images as unknown[]).slice(0, PUBLIC_IMAGE_SLOTS).filter((u): u is string => typeof u === 'string' && u.length > 0)
}
