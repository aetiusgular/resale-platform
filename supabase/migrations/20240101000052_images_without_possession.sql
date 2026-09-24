-- Migration: 20240101000052_images_without_possession
-- Listing photos are one ordered list now (sell page redesign A): listings.images holds only
-- public photos, up to 15, the first is the cover; the possession proof lives only in
-- possession_photo_url. The old six-slot form wrote images as FRONT · BACK · TAG · DETAIL ·
-- FLAW · POSSESSION, with '' for an empty slot and the proof at images[6] (uploaded to a fixed
-- …/possession.jpg path, and mirrored into possession_photo_url). Rewrite those rows once, so
-- every reader (loaders, SEO, recs sync, the native apps) can treat images as public photos
-- with no positional rules.
--
-- Data only, idempotent, no schema change. An old row is recognised by its blank slots, or by
-- a …/possession.jpg element; the proof is dropped by POSITION for those rows (never trusting
-- that possession_photo_url still equals images[6]) and backfilled into possession_photo_url
-- when that column is empty. Blank and NULL elements go, and so does any element equal to the
-- proof. Rows already in the list shape — including ones with six real photos — are untouched.
--
-- image_hashes.slot keeps FRONT … FLAW for old rows whose five public slots were all filled
-- (they still name positions 1 … 5, see lib/listings/images photoIndexForSlot). Rows that had
-- blanks get their hashes renamed to PHOTO_n by the photo's position once the blanks are gone.
--
-- updated_at is left as it was: this is a storage-shape rewrite, not an edit (the public
-- "SOLD n AGO" line and the seller catalog read updated_at), so the trigger is paused inside
-- the block — atomic with the rewrite, re-enabled on the way out or by the rollback.
SET lock_timeout = '5s';

DO $$
BEGIN
  ALTER TABLE listings DISABLE TRIGGER listings_updated_at;

  -- 1. Hash slots of the six-slot rows that had blanks: rename to the compacted position.
  WITH legacy AS (
    SELECT id, images
    FROM listings
    WHERE cardinality(images) = 6 AND '' = ANY(images)
  ),
  filled AS (
    SELECT l.id, s.slot, row_number() OVER (PARTITION BY l.id ORDER BY s.idx) AS pos
    FROM legacy l
    CROSS JOIN unnest(ARRAY['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW']) WITH ORDINALITY AS s(slot, idx)
    WHERE coalesce(l.images[s.idx], '') <> ''
  )
  UPDATE image_hashes h
  SET slot = 'PHOTO_' || f.pos
  FROM filled f
  WHERE h.listing_id = f.id AND h.slot = f.slot;

  -- 2. listings.images → the public photos, in order.
  UPDATE listings
  SET possession_photo_url = coalesce(
        nullif(possession_photo_url, ''),
        CASE WHEN cardinality(images) = 6 AND ('' = ANY(images) OR images[6] LIKE '%/possession.jpg')
             THEN nullif(images[6], '') END),
      images = (
        SELECT coalesce(array_agg(t.u ORDER BY t.ord), '{}')
        FROM unnest(
          CASE WHEN cardinality(images) = 6 AND ('' = ANY(images) OR images[6] LIKE '%/possession.jpg')
               THEN images[1:5]
               ELSE images END
        ) WITH ORDINALITY AS t(u, ord)
        WHERE t.u IS NOT NULL
          AND t.u <> ''
          AND t.u IS DISTINCT FROM nullif(possession_photo_url, '')
          AND t.u NOT LIKE '%/possession.jpg'
      )
  WHERE '' = ANY(images)
     OR array_position(images, NULL) IS NOT NULL
     OR nullif(possession_photo_url, '') = ANY(images)
     OR EXISTS (SELECT 1 FROM unnest(images) AS e(u) WHERE e.u LIKE '%/possession.jpg');

  ALTER TABLE listings ENABLE TRIGGER listings_updated_at;
END $$;

RESET lock_timeout;
