/**
 * One-shot recs-engine catalog backfill.
 *
 * The listing-sync integration (lib/recs/sync.ts) only mirrors GO-FORWARD lifecycle
 * transitions (approve → created, sold, removed, restore). Listings that were already
 * `active` before the engine came online are therefore invisible to it. This script
 * replays every currently-active listing through the SAME `POST /v1/listings` webhook
 * (`created`), so the engine's catalog + vector index reflect the live catalog.
 *
 * Safe to re-run: `created`/`updated` are upserts on the engine side, so repeats just
 * refresh. Fail-soft per listing — one bad row never aborts the run. Read-only against
 * the platform DB (it only READS `listings`; all writes go to the engine).
 *
 * REQUIRES (same server-side env the integration uses; see .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   RECS_ENABLED=true, RECS_INGEST_URL, RECS_INGEST_HMAC_SECRET
 *
 * Usage:
 *   RECS_ENABLED=true pnpm tsx scripts/recs-backfill.ts --confirm
 *   ...  --dry-run        # map + count only, post nothing
 *   ...  --page-size=500  # DB page size (default 1000)
 */
import { createClient } from '@supabase/supabase-js'
import { postListingChange } from '../lib/recs/client'
import { toListingChange, type ListingRowForRecs } from '../lib/recs/listing-map'

// Mirrors RECS_COLUMNS in lib/recs/sync.ts — the subset the mapper needs.
const RECS_COLUMNS = 'id, brand, category, price_cents, size, condition_score, created_at, images'

function argFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}
function argValue(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  const n = hit ? Number(hit.split('=')[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

async function main(): Promise<void> {
  const dryRun = argFlag('dry-run')

  if (!argFlag('confirm') && !dryRun) {
    console.error('[recs-backfill] refusing to run without --confirm (or use --dry-run)')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[recs-backfill] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }
  // postListingChange no-ops (returns false) unless RECS_ENABLED=true AND the ingest
  // URL + HMAC secret are set. Guard here so a misconfigured run fails loud, not silent.
  if (!dryRun) {
    if (process.env.RECS_ENABLED !== 'true') {
      console.error('[recs-backfill] RECS_ENABLED must be "true" for a live backfill (posts would no-op)')
      process.exit(1)
    }
    if (!process.env.RECS_INGEST_URL || !process.env.RECS_INGEST_HMAC_SECRET) {
      console.error('[recs-backfill] RECS_INGEST_URL and RECS_INGEST_HMAC_SECRET are required for a live backfill')
      process.exit(1)
    }
  }

  const pageSize = argValue('page-size', 1000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient<any>(url, key, { auth: { persistSession: false } })

  let from = 0
  let scanned = 0
  let posted = 0
  let skippedNoPhotos = 0
  let failed = 0

  console.log(`[recs-backfill] starting${dryRun ? ' (DRY RUN)' : ''} — page size ${pageSize}`)

  for (;;) {
    const { data, error } = await supabase
      .from('listings')
      .select(RECS_COLUMNS)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[recs-backfill] DB read error:', error.message)
      process.exit(1)
    }
    const rows = (data ?? []) as unknown as ListingRowForRecs[]
    if (rows.length === 0) break

    for (const row of rows) {
      scanned++
      const change = toListingChange(row, 'created')
      if (!change) {
        skippedNoPhotos++
        continue
      }
      if (dryRun) {
        posted++
        continue
      }
      try {
        const ok = await postListingChange(change)
        if (ok) posted++
        else {
          failed++
          console.warn(`[recs-backfill] post failed (fail-soft) for listing ${row.id}`)
        }
      } catch (e) {
        failed++
        console.warn(`[recs-backfill] post threw for listing ${row.id}:`, e)
      }
    }

    console.log(`[recs-backfill] progress — scanned ${scanned}, posted ${posted}, skipped ${skippedNoPhotos}, failed ${failed}`)
    if (rows.length < pageSize) break
    from += pageSize
  }

  console.log(
    `[recs-backfill] done${dryRun ? ' (DRY RUN)' : ''} — scanned ${scanned}, ` +
    `posted ${posted}, skipped(no photos) ${skippedNoPhotos}, failed ${failed}`,
  )
  process.exit(failed > 0 ? 2 : 0)
}

main().catch((e) => {
  console.error('[recs-backfill] fatal:', e)
  process.exit(1)
})
