-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261016_add_consent_expiry.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
ALTER TABLE consent_documents
  ADD COLUMN expires_at BIGINT NULL;
