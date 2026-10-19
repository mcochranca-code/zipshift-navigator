-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20260930_add_study_protocol_consent_foundation.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS studies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_key VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  protocol_version VARCHAR(40) NOT NULL,
  owner_user_id CHAR(36) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_studies_status (status),
  INDEX idx_studies_owner (owner_user_id),
  CONSTRAINT fk_studies_owner FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_studies_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS study_protocol_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  version VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  summary_json TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  effective_at BIGINT NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE INDEX uq_study_protocol_version (study_id, version),
  INDEX idx_protocol_study_status (study_id, status),
  CONSTRAINT fk_protocol_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_protocol_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS study_memberships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  membership_role VARCHAR(32) NOT NULL DEFAULT 'researcher',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE INDEX uq_study_membership (study_id, user_id),
  INDEX idx_membership_user (user_id),
  CONSTRAINT fk_membership_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS consent_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  version VARCHAR(40) NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  effective_at BIGINT NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE INDEX uq_consent_document_version (study_id, purpose, version, language),
  INDEX idx_consent_document_active (study_id, purpose, status),
  CONSTRAINT fk_consent_document_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_consent_document_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS participant_consents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  consent_document_id CHAR(36) NOT NULL,
  participant_user_id CHAR(36) NOT NULL,
  decision VARCHAR(16) NOT NULL,
  decided_at BIGINT NOT NULL,
  withdrawn_at BIGINT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'profile',
  recorded_by CHAR(36) NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_participant_consent_user (participant_user_id, study_id),
  INDEX idx_participant_consent_document (consent_document_id),
  CONSTRAINT fk_participant_consent_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_participant_consent_document FOREIGN KEY (consent_document_id) REFERENCES consent_documents(id) ON DELETE RESTRICT,
  CONSTRAINT fk_participant_consent_user FOREIGN KEY (participant_user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_participant_consent_recorded_by FOREIGN KEY (recorded_by) REFERENCES app_users(id) ON DELETE SET NULL
);

ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS study_id CHAR(36) NULL;
ALTER TABLE referral_cases ADD COLUMN IF NOT EXISTS protocol_version_id CHAR(36) NULL;
CREATE INDEX IF NOT EXISTS idx_referral_cases_study ON referral_cases (study_id);
ALTER TABLE referral_cases ADD CONSTRAINT fk_referral_cases_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE SET NULL;
ALTER TABLE referral_cases ADD CONSTRAINT fk_referral_cases_protocol FOREIGN KEY (protocol_version_id) REFERENCES study_protocol_versions(id) ON DELETE SET NULL;
