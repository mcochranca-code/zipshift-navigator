CREATE TABLE IF NOT EXISTS field_test_events (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  resource_id VARCHAR(180) NULL,
  session_key VARCHAR(80) NULL,
  metadata_json JSON NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_field_test_events_type_time (event_type, created_at),
  INDEX idx_field_test_events_resource_time (resource_id, created_at)
);
