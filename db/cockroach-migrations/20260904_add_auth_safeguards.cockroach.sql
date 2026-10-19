-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20260904_add_auth_safeguards.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at BIGINT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_expiry (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
