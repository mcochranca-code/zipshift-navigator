CREATE TABLE IF NOT EXISTS data_dictionary_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  version VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_dictionary_study_version (study_id, version),
  INDEX idx_dictionary_study_status (study_id, status),
  CONSTRAINT fk_dictionary_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionary_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS data_dictionary_variables (
  id CHAR(36) NOT NULL PRIMARY KEY,
  dictionary_version_id CHAR(36) NOT NULL,
  variable_key VARCHAR(100) NOT NULL,
  label VARCHAR(180) NOT NULL,
  description TEXT NULL,
  data_type VARCHAR(32) NOT NULL,
  variable_role VARCHAR(32) NOT NULL DEFAULT 'measure',
  unit VARCHAR(80) NULL,
  permissible_values_json TEXT NULL,
  source_field VARCHAR(120) NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  is_derived BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_dictionary_variable_key (dictionary_version_id, variable_key),
  INDEX idx_dictionary_variable_order (dictionary_version_id, display_order),
  CONSTRAINT fk_dictionary_variable_version FOREIGN KEY (dictionary_version_id) REFERENCES data_dictionary_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS research_instruments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  study_id CHAR(36) NOT NULL,
  instrument_key VARCHAR(100) NOT NULL,
  version VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  purpose TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  mode VARCHAR(24) NOT NULL DEFAULT 'form',
  created_by CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_instrument_study_version (study_id, instrument_key, version),
  INDEX idx_instrument_study_status (study_id, status),
  CONSTRAINT fk_instrument_study FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  CONSTRAINT fk_instrument_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS research_instrument_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  instrument_id CHAR(36) NOT NULL,
  variable_id CHAR(36) NULL,
  item_key VARCHAR(100) NOT NULL,
  item_order INT NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  response_type VARCHAR(32) NOT NULL,
  config_json TEXT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_instrument_item_key (instrument_id, item_key),
  INDEX idx_instrument_item_order (instrument_id, item_order),
  CONSTRAINT fk_instrument_item_instrument FOREIGN KEY (instrument_id) REFERENCES research_instruments(id) ON DELETE CASCADE,
  CONSTRAINT fk_instrument_item_variable FOREIGN KEY (variable_id) REFERENCES data_dictionary_variables(id) ON DELETE SET NULL
);
