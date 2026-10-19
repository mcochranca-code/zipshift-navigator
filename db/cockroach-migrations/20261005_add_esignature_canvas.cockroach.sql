-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261005_add_esignature_canvas.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
ALTER TABLE case_document_file_signatures
  ADD COLUMN IF NOT EXISTS signature_storage_key VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS signature_storage_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS signature_sha256 CHAR(64) NULL;
