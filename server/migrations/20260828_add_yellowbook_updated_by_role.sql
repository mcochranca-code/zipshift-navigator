-- ZipShift YellowBook staff attribution
-- Role-only attribution intentionally avoids storing staff names in the patient summary card.
ALTER TABLE yellowbook_encounters
  ADD COLUMN IF NOT EXISTS updated_by_role VARCHAR(32) NULL AFTER updated_at;
