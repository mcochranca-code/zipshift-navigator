-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261016_add_scoring_and_dual_signature_controls.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
ALTER TABLE research_instruments
  ADD COLUMN scoring_rules_json TEXT NULL;

ALTER TABLE care_coordination_documents
  ADD COLUMN required_signer_roles_json TEXT NULL;

ALTER TABLE care_document_signatures
  ADD COLUMN signature_storage_key VARCHAR(255) NULL,
  ADD COLUMN signature_sha256 CHAR(64) NULL;
