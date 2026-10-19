-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261003_add_intake_packet_library.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS intake_packet_forms (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  required_role VARCHAR(40) NULL,
  source_file_name VARCHAR(255) NOT NULL,
  storage_url VARCHAR(500) NOT NULL,
  page_count INT NOT NULL DEFAULT 1,
  official_notice TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_document_files (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  packet_form_id CHAR(36) NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  storage_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'uploaded',
  uploaded_by CHAR(36) NOT NULL,
  uploaded_at BIGINT NOT NULL,
  INDEX idx_case_files_case (case_id, uploaded_at),
  CONSTRAINT fk_case_file_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_case_file_packet FOREIGN KEY (packet_form_id) REFERENCES intake_packet_forms(id) ON DELETE SET NULL,
  CONSTRAINT fk_case_file_user FOREIGN KEY (uploaded_by) REFERENCES app_users(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS case_document_file_signatures (
  id CHAR(36) NOT NULL PRIMARY KEY,
  file_id CHAR(36) NOT NULL,
  signer_user_id CHAR(36) NULL,
  signer_name VARCHAR(120) NOT NULL,
  signer_role VARCHAR(60) NOT NULL,
  acknowledgement TEXT NOT NULL,
  signature_method VARCHAR(32) NOT NULL DEFAULT 'typed_acknowledgement',
  signed_at BIGINT NOT NULL,
  CONSTRAINT fk_file_sig_file FOREIGN KEY (file_id) REFERENCES case_document_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_file_sig_user FOREIGN KEY (signer_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS intake_packets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'assembled',
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT fk_packet_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_packet_user FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS intake_packet_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  packet_id CHAR(36) NOT NULL,
  packet_form_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL,
  CONSTRAINT fk_packet_item_packet FOREIGN KEY (packet_id) REFERENCES intake_packets(id) ON DELETE CASCADE,
  CONSTRAINT fk_packet_item_form FOREIGN KEY (packet_form_id) REFERENCES intake_packet_forms(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS case_document_audit_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  file_id CHAR(36) NULL,
  packet_id CHAR(36) NULL,
  actor_user_id CHAR(36) NOT NULL,
  action VARCHAR(48) NOT NULL,
  details_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_case_doc_audit (case_id, created_at),
  CONSTRAINT fk_doc_audit_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_audit_file FOREIGN KEY (file_id) REFERENCES case_document_files(id) ON DELETE SET NULL,
  CONSTRAINT fk_doc_audit_packet FOREIGN KEY (packet_id) REFERENCES intake_packets(id) ON DELETE SET NULL,
  CONSTRAINT fk_doc_audit_user FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE RESTRICT
);
