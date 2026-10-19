ALTER TABLE research_instruments
  ADD COLUMN scoring_rules_json TEXT NULL;

ALTER TABLE care_coordination_documents
  ADD COLUMN required_signer_roles_json TEXT NULL;

ALTER TABLE care_document_signatures
  ADD COLUMN signature_storage_key VARCHAR(255) NULL,
  ADD COLUMN signature_sha256 CHAR(64) NULL;
