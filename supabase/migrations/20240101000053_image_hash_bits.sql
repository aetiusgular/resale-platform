-- Migration: 20240101000053_image_hash_bits
-- Visual search P1: an indexed Hamming lookup over the per-photo blockhashes.
--
-- image_hashes.hash is the 64-hex-char 16x16 blockhash (256 bits) lib/image-hash.ts writes
-- for every listing photo. Until now the only consumer was the near-duplicate scan in
-- app/api/listings/route.ts, which pulled up to 5,000 rows and compared them in JS (the
-- antislop-config TODO: "replace with a DB-side nearest-neighbour before beta"). This adds:
--   1. pgvector (Supabase-managed extension; version >= 0.7 is required for bit vectors)
--   2. image_hashes.hash_bits bit(256), a STORED generated column derived from hash
--   3. an HNSW index on hash_bits with the Hamming operator class
--   4. similar_image_hashes(): a SECURITY DEFINER RPC the platform's service client calls
--      for the "same photo" tier of search-by-image AND for near-duplicate detection.
-- No new tables. RLS on image_hashes unchanged (service-role reads stay service-role).
-- db-guard: review before `pnpm exec supabase db push`.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- pgvector < 0.7.0 has no bit type support (bit_hamming_ops), so the index below would fail
-- with an opaque "operator class does not exist". Fail first, with the fix in the message.
-- (Supabase: Database → Extensions → vector, or a Postgres image upgrade, then re-run.)
DO $$
DECLARE
  v text := (SELECT extversion FROM pg_extension WHERE extname = 'vector');
BEGIN
  IF v ~ '^\d+\.\d+\.\d+$' AND string_to_array(v, '.')::int[] < ARRAY[0, 7, 0] THEN
    RAISE EXCEPTION 'image_hash_bits needs pgvector >= 0.7.0 (installed: %). Upgrade the vector extension, then re-run this migration.', v;
  END IF;
END $$;

-- ─── 1. Derived bit column (NULL when a legacy row is not a 64-hex blockhash) ───────────
-- The cast accepts the 'x' hex prefix; the regex guard keeps a malformed legacy value from
-- failing the whole migration. NULL rows are simply absent from the index and from results.
ALTER TABLE image_hashes
  ADD COLUMN IF NOT EXISTS hash_bits bit(256)
  GENERATED ALWAYS AS (
    CASE WHEN hash ~ '^[0-9a-f]{64}$' THEN ('x' || hash)::bit(256) ELSE NULL END
  ) STORED;

COMMENT ON COLUMN image_hashes.hash_bits IS
  'bit(256) form of hash (16x16 blockhash) for pgvector Hamming search; generated, never written.';

-- ─── 2. HNSW Hamming index ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS image_hashes_hash_bits_hnsw
  ON image_hashes USING hnsw (hash_bits extensions.bit_hamming_ops);

-- ─── 3. RPC: nearest photo hashes among live listings ──────────────────────────────────
-- Returns at most max_rows (listing_id, slot, distance) rows with Hamming distance
-- <= max_distance, nearest first, restricted to listings a buyer could actually see or a
-- moderator is about to review (active, pending_review). exclude_listing / exclude_seller
-- let the near-duplicate scan skip the seller's own inventory, exactly like the JS scan did.
-- SECURITY DEFINER so the service client can call it without a SELECT grant on listings
-- for anon; EXECUTE is granted to service_role ONLY.
CREATE OR REPLACE FUNCTION public.similar_image_hashes(
  query_hex        text,
  max_distance     integer DEFAULT 12,
  max_rows         integer DEFAULT 50,
  exclude_listing  uuid    DEFAULT NULL,
  exclude_seller   uuid    DEFAULT NULL
)
RETURNS TABLE (listing_id uuid, slot text, distance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  q bit(256);
  cap integer := GREATEST(COALESCE(max_rows, 50), 1);
BEGIN
  IF query_hex IS NULL OR query_hex !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'query_hex must be 64 lowercase hex characters' USING ERRCODE = '22023';
  END IF;
  q := ('x' || query_hex)::bit(256);
  -- pgvector defines its hnsw.* settings when its library loads into the backend, which
  -- happens on the first vector operator, not at CREATE EXTENSION. Load it now so the
  -- settings exist (and the "hnsw" prefix is reserved) before they are read or written.
  PERFORM q <~> q;
  -- Widen the HNSW candidate set: the join/status filter is applied AFTER the index scan.
  PERFORM set_config('hnsw.ef_search', '200', true);
  -- hnsw.iterative_scan exists from pgvector 0.8. On 0.7 the prefix is reserved and setting
  -- an unknown name under it raises, so only set it when this backend knows the setting.
  -- Without it 0.7 still works; the filter can just eat more of the ef_search candidates.
  IF current_setting('hnsw.iterative_scan', true) IS NOT NULL THEN
    PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);
  END IF;
  RETURN QUERY
    SELECT c.listing_id, c.slot, c.distance
    FROM (
      SELECT h.listing_id, h.slot, (h.hash_bits <~> q)::integer AS distance
      FROM image_hashes h
      JOIN listings l ON l.id = h.listing_id
      WHERE h.hash_bits IS NOT NULL
        AND l.status IN ('active', 'pending_review')
        AND (exclude_listing IS NULL OR l.id <> exclude_listing)
        AND (exclude_seller IS NULL OR l.seller_id <> exclude_seller)
      ORDER BY h.hash_bits <~> q
      LIMIT cap * 4
    ) c
    WHERE c.distance <= GREATEST(COALESCE(max_distance, 12), 0)
    ORDER BY c.distance, c.listing_id, c.slot
    LIMIT cap;
END;
$$;

REVOKE ALL ON FUNCTION public.similar_image_hashes(text, integer, integer, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.similar_image_hashes(text, integer, integer, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.similar_image_hashes(text, integer, integer, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.similar_image_hashes(text, integer, integer, uuid, uuid) IS
  'Visual search hash tier + near-duplicate detection: nearest blockhashes (Hamming) among live listings. service_role only.';
