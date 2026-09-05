/**
 * Listing photo slots: images[0..4] are the public photos (FRONT · BACK · TAG · DETAIL · FLAW);
 * images[5] is the POSSESSION proof and is never shown to other members. Every loader that emits a
 * listing's `images` to a viewer who is not the seller/admin passes them through here.
 */
export const PUBLIC_IMAGE_SLOTS = 5

export function publicImages(images: unknown): string[] {
  return (Array.isArray(images) ? (images as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0) : []).slice(0, PUBLIC_IMAGE_SLOTS)
}
