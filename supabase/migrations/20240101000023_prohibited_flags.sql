-- Migration: 20240101000023_prohibited_flags
-- Extends listing_flags.type to cover the prohibited-items scanner (G6, lib/trust/prohibited-items).
--   'prohibited_block'  — a 'block'-tier match (explicit weapons / ammunition); listing is hidden.
--   'prohibited_review' — a 'review'-tier match (counterfeit / regulated / stolen / gift-card); queued.
-- Evidence shape: { matches: [{ category, tier, label, field, matched }] }
-- db-guard: extends an existing CHECK constraint only. No data migration, no RLS/grant change.
--           The inline CHECK from 0007 is named listing_flags_type_check by Postgres convention;
--           DROP IF EXISTS makes this safe whether or not that name resolved.

ALTER TABLE listing_flags DROP CONSTRAINT IF EXISTS listing_flags_type_check;

ALTER TABLE listing_flags
  ADD CONSTRAINT listing_flags_type_check
  CHECK (type IN ('duplicate', 'keyword_stuffing', 'prohibited_block', 'prohibited_review'));
