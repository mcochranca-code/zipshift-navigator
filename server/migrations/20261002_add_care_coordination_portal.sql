ALTER TABLE app_users ADD COLUMN IF NOT EXISTS specialist_role VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS care_coordination_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  document_type VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  required_role VARCHAR(40) NULL,
  body_json TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uq_care_doc_case_type (case_id, document_type),
  INDEX idx_care_doc_case_status (case_id, status),
  CONSTRAINT fk_care_doc_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_care_doc_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS care_document_signatures (
  id CHAR(36) NOT NULL PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  signer_user_id CHAR(36) NULL,
  signer_name VARCHAR(120) NOT NULL,
  signer_role VARCHAR(40) NOT NULL,
  signature_method VARCHAR(32) NOT NULL DEFAULT 'typed_acknowledgement',
  consent_text TEXT NOT NULL,
  signed_at BIGINT NOT NULL,
  INDEX idx_care_signature_document (document_id, signed_at),
  CONSTRAINT fk_care_signature_document FOREIGN KEY (document_id) REFERENCES care_coordination_documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_care_signature_user FOREIGN KEY (signer_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS care_team_handoffs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  from_team VARCHAR(40) NOT NULL,
  to_team VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  note TEXT NULL,
  created_by CHAR(36) NOT NULL,
  accepted_by CHAR(36) NULL,
  created_at BIGINT NOT NULL,
  accepted_at BIGINT NULL,
  INDEX idx_care_handoff_case_status (case_id, status, created_at),
  CONSTRAINT fk_care_handoff_case FOREIGN KEY (case_id) REFERENCES referral_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_care_handoff_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_care_handoff_accepted_by FOREIGN KEY (accepted_by) REFERENCES app_users(id) ON DELETE SET NULL
);
