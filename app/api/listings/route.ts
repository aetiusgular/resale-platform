import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { lintListing } from '@/lib/antislop-lint'
import { ANTISLOP } from '@/lib/antislop-config'
import { hashAllSlots } from '@/lib/image-hash'
import { hammingDistance } from '@/lib/phash'

// Explicitly use Node.js runtime — sharp requires native bindings not on Edge
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    title,
    brand,
    category,
    size,
    description,
    condition_score,
    condition_notes,
    price_cents,
    images,
    possession_photo_url,
  } = body

  // ── Basic validation ───────────────────────────────────────────────────────
  if (
    typeof title !== 'string' || !title.trim() ||
    typeof brand !== 'string' || !brand.trim() ||
    typeof category !== 'string' || !category.trim() ||
    typeof size !== 'string' || !size.trim() ||
    typeof condition_score !== 'number' ||
    condition_score < 1 || condition_score > 10 ||
    typeof price_cents !== 'number' || price_cents <= 0 ||
    !Number.isInteger(price_cents) ||
    typeof possession_photo_url !== 'string' || !possession_photo_url.trim()
  ) {
    return NextResponse.json({ error: 'Invalid listing data' }, { status: 400 })
  }

  const titleClean = title.trim().toUpperCase()
  const descClean  = (description ?? '').trim()

  // ── Anti-slop: lint check ─────────────────────────────────────────────────
  const violations = lintListing(titleClean, descClean)
  const hardReject  = violations.find(v => v.severity === 'reject')
  if (hardReject) {
    return NextResponse.json({ error: hardReject.message }, { status: 400 })
  }

  // ── Velocity limit: new accounts capped at N listings/day ─────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', user.id)
    .single()

  if (!profile) {
    console.error('[api/listings] profile missing for authenticated user:', user.id)
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }

  const accountAgeDays =
    (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000

  if (accountAgeDays < ANTISLOP.VELOCITY_WINDOW_DAYS) {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .gte('created_at', todayStart.toISOString())

    if ((count ?? 0) >= ANTISLOP.VELOCITY_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `New accounts are limited to ${ANTISLOP.VELOCITY_DAILY_LIMIT} listings per day. Try again tomorrow.`,
        },
        { status: 429 },
      )
    }
  }

  // ── Perceptual hashing ────────────────────────────────────────────────────
  // Computed before insert so we can check possession dedup pre-insert.
  const imageArr: string[] = Array.isArray(images) ? images : []
  const slotHashes = await hashAllSlots(imageArr, possession_photo_url.trim())

  const service = await createServiceClient()

  // ── Possession-photo dedup: reject if exact match from a DIFFERENT seller ─
  const possessionHash = slotHashes['POSSESSION']
  if (possessionHash) {
    const { data: existingPoss } = await service
      .from('image_hashes')
      .select(`
        listing_id,
        listing:listing_id (seller_id, status)
      `)
      .eq('slot', 'POSSESSION')
      .eq('hash', possessionHash)
      .limit(10)

    const collision = (existingPoss ?? []).find((row) => {
      const l = (row.listing as unknown) as { seller_id: string; status: string } | null
      return (
        l &&
        l.seller_id !== user.id &&
        ['active', 'pending_review'].includes(l.status)
      )
    })

    if (collision) {
      return NextResponse.json(
        {
          error:
            'Your proof-of-possession photo matches one already on file from another seller. Please upload a new photo with your username and today\'s date.',
        },
        { status: 400 },
      )
    }
  }

  // ── Insert listing ────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      title:     titleClean,
      brand:     brand.trim().toUpperCase(),
      category:  category.trim(),
      size:      size.trim().toUpperCase(),
      description: descClean,
      condition_score,
      condition_notes: condition_notes ?? {},
      price_cents,
      images:    imageArr,
      possession_photo_url: possession_photo_url.trim(),
      status: 'pending_review',
    })
    .select('id, status')
    .single()

  if (error) {
    console.error('[api/listings] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const listingId = data.id

  // ── Store image hashes (service role — bypasses RLS) ──────────────────────
  const hashRows = Object.entries(slotHashes).map(([slot, hash]) => ({
    listing_id: listingId,
    slot,
    hash,
  }))
  if (hashRows.length > 0) {
    const { error: hashErr } = await service
      .from('image_hashes')
      .insert(hashRows)
    if (hashErr) {
      console.warn('[api/listings] image_hashes insert warning:', hashErr.message)
    }
  }

  // ── Near-duplicate detection (service role) ───────────────────────────────
  // Only run if we have hashes to compare.
  const warnings = violations.filter(v => v.severity === 'warn')
  if (Object.keys(slotHashes).length > 0) {
    // Get candidate listing IDs: other sellers' active/pending listings
    const { data: candidates } = await service
      .from('listings')
      .select('id')
      .in('status', ['active', 'pending_review'])
      .neq('seller_id', user.id)
      .neq('id', listingId)

    const candidateIds = (candidates ?? []).map((c: { id: string }) => c.id)

    if (candidateIds.length > 0) {
      // Safety valve: cap at 5000 rows. At >~833 active listings this scan
      // becomes incomplete — replace with a DB-side nearest-neighbour function
      // before beta (see TODO in antislop-config.ts).
      const { data: existingHashes } = await service
        .from('image_hashes')
        .select('listing_id, slot, hash')
        .in('listing_id', candidateIds)
        .limit(5000)

      // Group by listing_id, compute per-slot Hamming distances
      const byListing = new Map<
        string,
        { slot: string; distance: number }[]
      >()

      for (const row of existingHashes ?? []) {
        const r = row as { listing_id: string; slot: string; hash: string }
        const newHash = slotHashes[r.slot as keyof typeof slotHashes]
        if (!newHash) continue

        const dist = hammingDistance(newHash, r.hash)
        if (dist <= ANTISLOP.DUPLICATE_DISTANCE_THRESHOLD) {
          if (!byListing.has(r.listing_id)) byListing.set(r.listing_id, [])
          byListing.get(r.listing_id)!.push({ slot: r.slot, distance: dist })
        }
      }

      // Listings with >= MIN_SLOT_MATCHES close matches are duplicate suspects
      const duplicates: { listing_id: string; matches: { slot: string; distance: number }[] }[] = []
      for (const [lid, matches] of byListing) {
        if (matches.length >= ANTISLOP.DUPLICATE_MIN_SLOT_MATCHES) {
          duplicates.push({ listing_id: lid, matches })
        }
      }

      if (duplicates.length > 0) {
        const { error: flagErr } = await service
          .from('listing_flags')
          .insert({
            listing_id: listingId,
            type: 'duplicate',
            evidence: {
              matched_listing_ids: duplicates.map(d => d.listing_id),
              per_slot_distances: duplicates.flatMap(d =>
                d.matches.map(m => ({ listing_id: d.listing_id, slot: m.slot, distance: m.distance }))
              ),
            },
          })
        if (flagErr) {
          console.warn('[api/listings] duplicate flag insert warning:', flagErr.message)
        }
      }
    }
  }

  // ── Keyword-stuffing flags (from lint warnings) ───────────────────────────
  if (warnings.length > 0) {
    const { error: lintFlagErr } = await service
      .from('listing_flags')
      .insert({
        listing_id: listingId,
        type: 'keyword_stuffing',
        evidence: { violations: warnings.map(v => ({ code: v.code, message: v.message })) },
      })
    if (lintFlagErr) {
      console.warn('[api/listings] lint flag insert warning:', lintFlagErr.message)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
