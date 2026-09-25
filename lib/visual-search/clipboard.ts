'use client'

/**
 * Read an image off the async clipboard (⌘K in the header, "Paste from clipboard" in the
 * mobile sheet). Browsers gate `navigator.clipboard.read()` behind a permission prompt on
 * first use (Chrome) or a one-time paste prompt (Safari / iOS); a refusal or an empty
 * clipboard resolves to null, never throws.
 */
import { isAcceptedImage } from './shared'

export async function readClipboardImage(): Promise<Blob | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((t) => isAcceptedImage(t))
      if (type) return await item.getType(type)
    }
  } catch {
    /* permission denied or nothing usable */
  }
  return null
}
