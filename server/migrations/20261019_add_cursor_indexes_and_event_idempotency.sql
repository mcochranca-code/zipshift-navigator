-- Candidate migration for stable cursor pagination and protected event retries.
-- Review existing indexes and row counts before applying in production.

ALTER TABLE case_events ADD INDEX IF NOT EXISTS idx_case_events_case_created_id (case_id, created_at, id);

ALTER TABLE referral_cases ADD INDEX IF NOT EXISTS idx_referral_cases_updated_id (updated_at, id);
ALTER TABLE referral_cases ADD INDEX IF NOT EXISTS idx_referral_cases_status_updated_id (status, updated_at, id);
ALTER TABLE referral_cases ADD INDEX IF NOT EXISTS idx_referral_cases_assignee_status_updated_id (assigned_to, status, updated_at, id);

ALTER TABLE care_team_handoffs ADD INDEX IF NOT EXISTS idx_handoffs_case_created_id (case_id, created_at, id);
ALTER TABLE care_team_handoffs ADD INDEX IF NOT EXISTS idx_handoffs_team_status_created_id (to_team, status, created_at, id);

ALTER TABLE case_document_files ADD INDEX IF NOT EXISTS idx_case_files_case_uploaded_id (case_id, uploaded_at, id);
ALTER TABLE case_document_audit_events ADD INDEX IF NOT EXISTS idx_case_doc_audit_case_created_id (case_id, created_at, id);
ALTER TABLE care_coordination_documents ADD INDEX IF NOT EXISTS idx_care_docs_case_status_updated_id (case_id, status, updated_at, id);

ALTER TABLE care_document_signatures ADD UNIQUE INDEX IF NOT EXISTS uq_care_signatures_document_role (document_id, signer_role);
ALTER TABLE care_document_signatures ADD INDEX IF NOT EXISTS idx_care_signatures_document_signed_id (document_id, signed_at, id);

ALTER TABLE case_milestones ADD INDEX IF NOT EXISTS idx_milestones_team_status_updated_id (assigned_team, status, updated_at, id);
ALTER TABLE case_milestones ADD INDEX IF NOT EXISTS idx_milestones_case_updated_id (case_id, updated_at, id);
ALTER TABLE case_tasks ADD INDEX IF NOT EXISTS idx_tasks_team_status_due_updated_id (assigned_team, status, due_at, updated_at, id);
ALTER TABLE case_tasks ADD INDEX IF NOT EXISTS idx_tasks_case_updated_id (case_id, updated_at, id);

ALTER TABLE study_memberships ADD INDEX IF NOT EXISTS idx_memberships_user_active_study (user_id, is_active, study_id);
ALTER TABLE participant_consents ADD INDEX IF NOT EXISTS idx_consents_user_study_decision_date (participant_user_id, study_id, decision, withdrawn_at, decided_at, id);
ALTER TABLE research_participant_controls ADD INDEX IF NOT EXISTS idx_participants_study_status_updated_id (study_id, enrollment_status, updated_at, id);
ALTER TABLE research_assessments ADD INDEX IF NOT EXISTS idx_assessments_participant_status_created_id (participant_control_id, status, created_at, id);
ALTER TABLE research_assessments ADD INDEX IF NOT EXISTS idx_assessments_study_instrument_created_id (study_id, instrument_key, created_at, id);

ALTER TABLE admin_audit_log ADD INDEX IF NOT EXISTS idx_admin_audit_created_id (created_at, id);
ALTER TABLE admin_audit_log ADD INDEX IF NOT EXISTS idx_admin_audit_actor_created_id (actor_user_id, created_at, id);
ALTER TABLE admin_pages ADD INDEX IF NOT EXISTS idx_admin_pages_published_updated_id (is_published, updated_at, id);

CREATE TABLE IF NOT EXISTS case_event_idempotency (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  case_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_event_idempotency_actor_key (actor_user_id, idempotency_key),
  UNIQUE KEY uq_event_idempotency_event (event_id),
  INDEX idx_event_idempotency_created (created_at)
);
