-- Closed-loop access outcomes and consent-gated housing status (SDOH).
-- Additive and idempotent. Apply before deploying code that reads these fields.
--
-- referral_cases.housing_status uses the HUD-aligned vocabulary in
-- shared/accessOutcomes.ts (unsheltered, emergency_shelter, transitional_housing,
-- doubled_up, at_risk, housed, prefer_not_to_say). It is NULL unless the person
-- agreed (sdoh_consent = TRUE) to housing status being used to improve services.
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS housing_status VARCHAR(40) NULL;
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS housing_status_updated_at BIGINT NULL;
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS sdoh_consent BOOLEAN NOT NULL DEFAULT FALSE;
-- How the person can be reached: call, text, shared_phone_no_details,
-- case_manager, or check_back_with_code (no phone).
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS contact_preference VARCHAR(40) NULL;
-- Denormalized latest outcome for queue views; referral_access_outcomes is the ledger.
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS access_outcome VARCHAR(30) NULL;
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS connected_at BIGINT NULL;

ALTER TABLE referral_cases ADD INDEX IF NOT EXISTS idx_referral_cases_housing_outcome (housing_status, access_outcome, created_at);

-- Append-only ledger of recorded outcomes. The latest row per case is current.
-- housing_status_snapshot freezes the exposure at the time of the outcome so
-- later housing changes do not rewrite history.
CREATE TABLE IF NOT EXISTS referral_access_outcomes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  outcome VARCHAR(30) NOT NULL,
  barriers_json JSON NULL,
  housing_status_snapshot VARCHAR(40) NULL,
  connected_at BIGINT NULL,
  source VARCHAR(20) NOT NULL,
  recorded_by CHAR(36) NULL,
  recorded_by_role VARCHAR(40) NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_access_outcomes_case_created (case_id, created_at, id),
  INDEX idx_access_outcomes_created (created_at)
);
