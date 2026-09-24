-- Migration: 20240101000051_international_shipping_validate
-- Validates the CHECKs 20240101000050 added NOT VALID. VALIDATE CONSTRAINT takes only a
-- SHARE UPDATE EXCLUSIVE lock (reads and writes continue), and running it in its own
-- migration keeps 000050's ACCESS EXCLUSIVE locks short. Every existing row holds the
-- column defaults, so these pass.

ALTER TABLE listings          VALIDATE CONSTRAINT listings_ships_from_check;
ALTER TABLE listings          VALIDATE CONSTRAINT listings_intl_shipping_check;
ALTER TABLE listings          VALIDATE CONSTRAINT listings_published_complete_ck;
ALTER TABLE checkout_sessions VALIDATE CONSTRAINT checkout_sessions_label_mode_check;
ALTER TABLE checkout_sessions VALIDATE CONSTRAINT checkout_sessions_shipping_region_check;
ALTER TABLE orders            VALIDATE CONSTRAINT orders_label_mode_check;
ALTER TABLE orders            VALIDATE CONSTRAINT orders_shipping_region_check;
ALTER TABLE orders            VALIDATE CONSTRAINT orders_seller_label_transfer_check;
