-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20260828_add_yellowbook_updated_by_role.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
-- ZipShift YellowBook staff attribution
-- Role-only attribution intentionally avoids storing staff names in the patient summary card.
ALTER TABLE yellowbook_encounters
  ADD COLUMN IF NOT EXISTS updated_by_role VARCHAR(32) NULL;
