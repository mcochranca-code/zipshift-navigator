-- GENERATED CANDIDATE DDL: review before applying to CockroachDB.
-- Source migration: 20261009_add_field_test_analytics.sql
-- This file was generated offline; it does not connect to or mutate any database.
-- Warnings are recorded in db/cockroach-migrations/manifest.json.
CREATE TABLE IF NOT EXISTS field_test_events (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  resource_id VARCHAR(180) NULL,
  session_key VARCHAR(80) NULL,
  metadata_json JSONB NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_field_test_events_type_time (event_type, created_at),
  INDEX idx_field_test_events_resource_time (resource_id, created_at)
);
