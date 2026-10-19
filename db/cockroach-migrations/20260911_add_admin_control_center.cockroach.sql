-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20260911_add_admin_control_center.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS admin_pages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  content_json TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by VARCHAR(36) NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  actor_user_id VARCHAR(36) NOT NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NULL,
  details_json TEXT NULL,
  created_at BIGINT NOT NULL
);
