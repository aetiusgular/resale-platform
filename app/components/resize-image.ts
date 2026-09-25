/**
 * Client-side image resize → JPEG blob (canvas). ONE helper for every upload: the sell form
 * (listing photos, ≤ 2000 px) and search by image (query photos, ≤ 768 px). Browsers decode
 * with EXIF orientation applied, so the output is upright and carries no EXIF; anything the
 * server hashes or embeds sees the pixels the user saw.
 */
export async function resizeToJpeg(file: Blob, maxPx = 2000, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(img.width  * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas blob failed'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}
