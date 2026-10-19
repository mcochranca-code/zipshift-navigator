-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261006_add_longitudinal_milestone_permissions.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS case_milestones (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  milestone_type VARCHAR(48) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  assigned_team VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  summary TEXT NULL,
  metadata_json JSONB NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_by CHAR(36) NOT NULL,
  updated_at BIGINT NOT NULL,
  completed_by CHAR(36) NULL,
  completed_at BIGINT NULL,
  INDEX idx_case_milestones_case (case_id, updated_at),
  INDEX idx_case_milestones_team (assigned_team, status, updated_at),
  CONSTRAINT fk_milestone_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_milestone_creator FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_milestone_updater FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_milestone_completer FOREIGN KEY (completed_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_milestone_audit_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  milestone_id CHAR(36) NOT NULL,
  case_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  actor_role VARCHAR(48) NOT NULL,
  action VARCHAR(48) NOT NULL,
  previous_status VARCHAR(24) NULL,
  next_status VARCHAR(24) NULL,
  details_json JSONB NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_milestone_audit_milestone (milestone_id, created_at),
  INDEX idx_milestone_audit_case (case_id, created_at),
  CONSTRAINT fk_milestone_audit_milestone FOREIGN KEY (milestone_id) REFERENCES case_milestones(id) ON DELETE CASCADE,
  CONSTRAINT fk_milestone_audit_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_milestone_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);
