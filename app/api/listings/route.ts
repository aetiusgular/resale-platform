import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { lintListing } from '@/lib/antislop-lint'
import { ANTISLOP } from '@/lib/antislop-config'
import { hashAllSlots, POSSESSION_SLOT } from '@/lib/image-hash'
import { MAX_PHOTOS, MIN_PHOTOS } from '@/lib/listings/images'
import { hammingDistance } from '@/lib/phash'
import { checkRateLimit } from '@/lib/rate-limit'
import { VERIFICATION_ENABLED, AUTH_BADGE_ENABLED } from '@/lib/flags'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'
import { scanListing } from '@/lib/trust/prohibited-items'
import { needsAuthenticationReview } from '@/lib/authbadge/screen'
import { allImageUrlsAllowed, storageHost } from '@/lib/security/image-url'
import { isBanned } from '@/lib/auth/ban'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { quoteShippingCents } from '@/lib/shipping'
import { makeEasypostRater } from '@/lib/shipping-easypost'
import { CATEGORIES, COLOR_LABELS, DEPARTMENTS, isValidSubcategory, normalizeMeasurements } from '@/lib/taxonomy'
import { sellerShipFrom } from '@/lib/listings/origin'
import { cleanIntlShipping, needsIntlRegion } from '@/lib/shipping-regions'
import { countryName, isRestrictedCountry, normalizeCountry } from '@/lib/countries'

// Explicitly use Node.js runtime — sharp requires native bindings not on Edge
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Ban guard (G6): suspended accounts cannot create listings ────────────
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  // ── Rate limit: 30 listing uploads per user per hour ─────────────────────
  const rl = await checkRateLimit(`listing_upload:${user.id}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many listing uploads. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // ── Seller ID-verification gate (G4/G6 item 4) ────────────────────────
  // Behind VERIFICATION_ENABLED. Holds listing creation when the seller is risk-
  // flagged (bad ratings / upheld complaints) OR crosses the $5k trailing-sales
  // INFORM-Act threshold, unless already verified. Fail-OPEN on a transient read
  // error (matches the resolver's philosophy); the payout path is the harder stop.
  if (VERIFICATION_ENABLED) {
    try {
      const svc = createServiceClientRaw()
      const { data: vprofile } = await svc
        .from('profiles')
        .select('id_verification_status')
        .eq('id', user.id)
        .single()
      const alreadyVerified =
        (vprofile as { id_verification_status?: string } | null)?.id_verification_status === 'verified'
      if (!alreadyVerified && (await sellerMustVerify(svc, user.id))) {
        return NextResponse.json(
          { error: 'ID verification is required before you can list. Please complete verification.', code: 'verification_required' },
          { status: 403 },
        )
      }
    } catch (e) {
      console.warn('[api/listings] verification gate check failed (fail-open):', e)
    }
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
    // ARCHIVE design review additions (all optional except department's default)
    department,
    subcategory,
    color,
    measurements,
    intl_shipping,
    draft_id,
  } = body

  // ── Basic validation ───────────────────────────────────────────────────────
  // Photos: up to MAX_PHOTOS in the seller's order (the first is the cover), at least
  // MIN_PHOTOS. Condition grade and the possession photo are optional (the listing form no
  // longer asks for them); when a possession photo is sent it is still deduped across sellers.
  const possessionClean: string | null = typeof possession_photo_url === 'string' && possession_photo_url.trim() ? possession_photo_url.trim() : null
  // The proof is never a public photo, even when an old client repeats it inside `images`.
  const imageArr: string[] = Array.isArray(images)
    ? Array.from(new Set(
        images
          .filter((u): u is string => typeof u === 'string' && !!u.trim())
          .map((u) => u.trim())
          .filter((u) => u !== possessionClean),
      )).slice(0, MAX_PHOTOS)
    : []
  const conditionClean: number | null = typeof condition_score === 'number' && Number.isInteger(condition_score) ? condition_score : null
  if (
    typeof title !== 'string' || !title.trim() ||
    typeof brand !== 'string' || !brand.trim() ||
    typeof category !== 'string' || !category.trim() ||
    typeof size !== 'string' || !size.trim() ||
    (condition_score !== undefined && condition_score !== null && (conditionClean === null || conditionClean < 1 || conditionClean > 10)) ||
    typeof price_cents !== 'number' || price_cents <= 0 ||
    !Number.isInteger(price_cents) ||
    (possession_photo_url !== undefined && possession_photo_url !== null && typeof possession_photo_url !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid listing data' }, { status: 400 })
  }
  if (imageArr.length < MIN_PHOTOS) {
    return NextResponse.json({ error: `Add at least ${MIN_PHOTOS} photos.`, code: 'too_few_photos' }, { status: 400 })
  }

  // ── Taxonomy (lib/taxonomy): department, category tree, colour, measurements ──
  const departmentClean: string = typeof department === 'string' && (DEPARTMENTS as readonly string[]).includes(department) ? department : 'menswear'
  const categoryClean = category.trim()
  if (!CATEGORIES.includes(categoryClean)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
  }
  const subcategoryClean: string | null =
    typeof subcategory === 'string' && subcategory.trim() && isValidSubcategory(categoryClean, subcategory.trim())
      ? subcategory.trim()
      : null
  const colorClean: string | null = typeof color === 'string' && COLOR_LABELS.includes(color.trim()) ? color.trim() : null
  const measurementsClean = normalizeMeasurements(measurements, categoryClean)
  const draftId: string | null = typeof draft_id === 'string' && /^[0-9a-f-]{36}$/i.test(draft_id) ? draft_id : null

  // ── Shipping lanes (lib/shipping-regions): where the seller ships from decides which
  // region keys apply. A seller outside the US has no automatic lane, so needs one region.
  const shipFrom = await sellerShipFrom(createServiceClientRaw(), user.id)
  if (isRestrictedCountry(shipFrom.country) || !normalizeCountry(shipFrom.country)) {
    return NextResponse.json({ error: `Selling from ${countryName(shipFrom.country)} isn’t supported.`, code: 'origin_unsupported' }, { status: 403 })
  }
  const intlShippingClean = cleanIntlShipping(intl_shipping, shipFrom.country)
  if (needsIntlRegion(shipFrom.country, intlShippingClean)) {
    return NextResponse.json({ error: 'Add at least one shipping region.', code: 'no_shipping_region' }, { status: 400 })
  }

  // Titles keep the seller's casing (reference cards: "1998 painter-dyed tee");
  // brand + size are normalised upper-case for filtering.
  const titleClean = title.trim()
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

  // ── Image-URL allowlist (security) — every stored image must be an HTTPS URL on our
  // Storage host, so nothing off-platform is hashed (SSRF) or later rendered in <img>.
  // Fail-OPEN only if the Storage host env is somehow unset (never block all listings on a
  // misconfiguration); otherwise reject off-host URLs.
  const imgHost = storageHost()
  if (imgHost && !allImageUrlsAllowed([...imageArr, ...(possessionClean ? [possessionClean] : [])], imgHost)) {
    return NextResponse.json({ error: 'Images must be uploaded to the platform.', code: 'invalid_image_url' }, { status: 400 })
  }

  const slotHashes = await hashAllSlots(imageArr, possessionClean ?? '')

  const service = await createServiceClient()

  // ── Possession-photo dedup: reject if exact match from a DIFFERENT seller ─
  const possessionHash = slotHashes[POSSESSION_SLOT]
  if (possessionHash) {
    const { data: existingPoss } = await service
      .from('image_hashes')
      .select(`
        listing_id,
        listing:listing_id (seller_id, status)
      `)
      .eq('slot', POSSESSION_SLOT)
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

  // ── System-derived US shipping (sellers cannot set it) ────────────────────
  // Category → parcel preset → max(worst-zone quote, floor) + $2. The EasyPost rater quotes
  // from the seller's ship-from ZIP; it is dormant (returns null → floor) while
  // SHIPPING_LABELS_ENABLED=false or when the seller is outside the US (no domestic lane).
  const shipping = await quoteShippingCents(categoryClean, makeEasypostRater(shipFrom.country === 'US' ? shipFrom.zip : null))

  // ── Insert listing ────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      title:     titleClean,
      brand:     brand.trim().toUpperCase(),
      category:  categoryClean,
      department: departmentClean,
      subcategory: subcategoryClean,
      color: colorClean,
      measurements: measurementsClean,
      shipping_cents:  shipping.cents,
      shipping_source: shipping.source,
      ships_from:      shipFrom.country,
      intl_shipping:   intlShippingClean,
      size:      size.trim().toUpperCase(),
      description: descClean,
      condition_score: conditionClean,
      condition_notes: condition_notes ?? {},
      price_cents,
      images:    imageArr,
      possession_photo_url: possessionClean,
      status: 'pending_review',
    })
    .select('id, status')
    .single()

  if (error) {
    console.error('[api/listings] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const listingId = data.id

  // ── Draft hand-off: the wizard auto-saves a draft row while the seller types; once
  // the real listing exists the draft is redundant (photos are shared by URL).
  if (draftId) {
    await service.from('listings').delete().eq('id', draftId).eq('seller_id', user.id).eq('status', 'draft')
  }

  // ── Prohibited-items scan (G6) — 'block' hides the listing, 'review' queues it ──
  // Always on (trust enforcement, not a flag feature). The 'block' tier is narrow
  // (explicit weapons/ammo) so a fashion listing is never auto-hidden on a graphic
  // print; softer signals fall to 'review' for a human. Evidence lands in listing_flags.
  const prohibited = scanListing({
    title: titleClean,
    description: descClean,
    category: categoryClean,
    brand: brand.trim(),
  })
  if (prohibited.length > 0) {
    const blocked = prohibited.some((m) => m.tier === 'block')
    const { error: pflagErr } = await service
      .from('listing_flags')
      .insert({
        listing_id: listingId,
        type: blocked ? 'prohibited_block' : 'prohibited_review',
        evidence: { matches: prohibited },
      })
    if (pflagErr) console.warn('[api/listings] prohibited flag insert warning:', pflagErr.message)
    if (blocked) {
      // Hide it (seller-insert RLS forbids non-draft/pending status, so use the service client).
      await service
        .from('listings')
        .update({ status: 'removed', rejection_reason: 'Prohibited items policy — this listing cannot be published.' })
        .eq('id', listingId)
      return NextResponse.json(
        { error: 'This listing can\u2019t be published \u2014 it appears to contain prohibited items. Contact support if you believe this is a mistake.', code: 'prohibited_block' },
        { status: 422 },
      )
    }
  }

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

      // Group by listing_id: photos are in the seller's own order (drag to reorder), so a
      // stored photo counts as a match when it is close to ANY of the new photos, not
      // only the one at the same position.
      const byListing = new Map<
        string,
        { slot: string; new_slot: string; distance: number }[]
      >()
      const newHashes = Object.entries(slotHashes)

      for (const row of existingHashes ?? []) {
        const r = row as { listing_id: string; slot: string; hash: string }
        let dist = Number.POSITIVE_INFINITY
        let newSlot = ''
        for (const [slot, h] of newHashes) {
          const d = hammingDistance(h, r.hash)
          if (d < dist) { dist = d; newSlot = slot }
        }
        if (dist <= ANTISLOP.DUPLICATE_DISTANCE_THRESHOLD) {
          if (!byListing.has(r.listing_id)) byListing.set(r.listing_id, [])
          byListing.get(r.listing_id)!.push({ slot: r.slot, new_slot: newSlot, distance: dist })
        }
      }

      // Listings with >= MIN_SLOT_MATCHES close matches are duplicate suspects
      const duplicates: { listing_id: string; matches: { slot: string; new_slot: string; distance: number }[] }[] = []
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
                d.matches.map(m => ({ listing_id: d.listing_id, slot: m.slot, new_slot: m.new_slot, distance: m.distance }))
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

  // ── Authentication pre-screen (G5) — high-value or flagged listings enter the
  // authentication review queue. Behind AUTH_BADGE_ENABLED; the badge is set by an admin.
  if (AUTH_BADGE_ENABLED) {
    const { data: flagRows } = await service.from('listing_flags').select('type').eq('listing_id', listingId)
    const flagTypes = ((flagRows ?? []) as Array<{ type: string }>).map((r) => r.type)
    const screen = needsAuthenticationReview({ priceCents: price_cents, flagTypes })
    if (screen.review) {
      await service.from('listings')
        .update({ authentication_status: 'pending', authentication_reasons: screen.reasons })
        .eq('id', listingId)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
