-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261006_add_case_tasks_milestone_links.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS case_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  milestone_id CHAR(36) NULL,
  assigned_team VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  due_at BIGINT NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_by CHAR(36) NOT NULL,
  updated_at BIGINT NOT NULL,
  completed_by CHAR(36) NULL,
  completed_at BIGINT NULL,
  INDEX idx_case_tasks_case (case_id, updated_at),
  INDEX idx_case_tasks_team (assigned_team, status, due_at),
  CONSTRAINT fk_case_task_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_case_task_milestone FOREIGN KEY (milestone_id) REFERENCES case_milestones(id) ON DELETE SET NULL,
  CONSTRAINT fk_case_task_creator FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_case_task_updater FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_case_task_completer FOREIGN KEY (completed_by) REFERENCES app_users(id) ON DELETE SET NULL
);
