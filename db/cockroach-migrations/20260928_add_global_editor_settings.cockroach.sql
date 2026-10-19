-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20260928_add_global_editor_settings.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS admin_global_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by VARCHAR(36) NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_global_setting_revisions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  setting_key VARCHAR(80) NOT NULL,
  previous_value_json TEXT NOT NULL,
  next_value_json TEXT NOT NULL,
  changed_by VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_global_setting_revisions_key_time (setting_key, created_at)
);
