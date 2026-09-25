/**
 * Query-image helpers. `sniffImageType` and `isBlockhashHex` are PURE; `blockhashFromBuffer`
 * needs sharp (Node runtime only) and is imported lazily so the pure helpers stay importable
 * anywhere (tests, edge-safe modules).
 *
 * The uploaded bytes are held in memory for one request: hashed here, forwarded to the
 * engine, then dropped. Nothing in this module writes to disk or storage.
 */
import type { AcceptedImageType } from './config'

/** Decompression-bomb guard for query uploads: far above any phone photo, far below sharp's default. */
const QUERY_MAX_PIXELS = 40_000_000

/** Sniff the container from magic bytes (the client's Content-Type is a hint, not a fact). */
export function sniffImageType(buf: Uint8Array): AcceptedImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) {
    return 'image/webp'
  }
  return null
}

/** True for the 64-lowercase-hex form `lib/phash.ts` produces (what the RPC accepts). */
export function isBlockhashHex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}

/**
 * 16x16 blockhash of an in-memory query image through the SAME pipeline that hashed the
 * listing photos at publish time (`lib/image-hash.ts`), so a re-uploaded listing photo lands
 * at distance ~0. Node runtime only (sharp is a native module). Null when the bytes do not
 * decode or declare more than QUERY_MAX_PIXELS.
 */
export async function blockhashFromBuffer(buf: Buffer): Promise<string | null> {
  const { blockhashFromBuffer: hash } = await import('@/lib/image-hash')
  return hash(buf, { limitInputPixels: QUERY_MAX_PIXELS })
}
