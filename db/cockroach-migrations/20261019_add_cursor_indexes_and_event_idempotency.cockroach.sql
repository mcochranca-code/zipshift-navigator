-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261019_add_cursor_indexes_and_event_idempotency.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
-- Candidate migration for stable cursor pagination and protected event retries.
-- Review existing indexes and row counts before applying in production.

CREATE INDEX IF NOT EXISTS idx_case_events_case_created_id ON case_events (case_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_referral_cases_updated_id ON referral_cases (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_referral_cases_status_updated_id ON referral_cases (status, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_referral_cases_assignee_status_updated_id ON referral_cases (assigned_to, status, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_handoffs_case_created_id ON care_team_handoffs (case_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_handoffs_team_status_created_id ON care_team_handoffs (to_team, status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_case_files_case_uploaded_id ON case_document_files (case_id, uploaded_at, id);
CREATE INDEX IF NOT EXISTS idx_case_doc_audit_case_created_id ON case_document_audit_events (case_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_care_docs_case_status_updated_id ON care_coordination_documents (case_id, status, updated_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_care_signatures_document_role ON care_document_signatures (document_id, signer_role);
CREATE INDEX IF NOT EXISTS idx_care_signatures_document_signed_id ON care_document_signatures (document_id, signed_at, id);

CREATE INDEX IF NOT EXISTS idx_milestones_team_status_updated_id ON case_milestones (assigned_team, status, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_milestones_case_updated_id ON case_milestones (case_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_status_due_updated_id ON case_tasks (assigned_team, status, due_at, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_tasks_case_updated_id ON case_tasks (case_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_memberships_user_active_study ON study_memberships (user_id, is_active, study_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_study_decision_date ON participant_consents (participant_user_id, study_id, decision, withdrawn_at, decided_at, id);
CREATE INDEX IF NOT EXISTS idx_participants_study_status_updated_id ON research_participant_controls (study_id, enrollment_status, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_assessments_participant_status_created_id ON research_assessments (participant_control_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS idx_assessments_study_instrument_created_id ON research_assessments (study_id, instrument_key, created_at, id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_id ON admin_audit_log (created_at, id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created_id ON admin_audit_log (actor_user_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_admin_pages_published_updated_id ON admin_pages (is_published, updated_at, id);

CREATE TABLE IF NOT EXISTS case_event_idempotency (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  case_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE INDEX uq_event_idempotency_actor_key (actor_user_id, idempotency_key),
  UNIQUE INDEX uq_event_idempotency_event (event_id),
  INDEX idx_event_idempotency_created (created_at)
);
