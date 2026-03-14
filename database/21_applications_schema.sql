-- =============================================================================
-- Migration 21: Shared applications table + schema fixes
--
-- 1. Creates the shared `applications` table used by the Scenario Sandbox
--    impact analysis engine for all 6 programs.
--
-- 2. Adds a UNIQUE constraint to scenario_impact_results so that Impact
--    Preview results can be upserted rather than duplicated on re-run.
--
-- 3. Adds a data_source column to grant_applications so DDC records can
--    be flagged as 'live' when real client data is connected (badge auto-upgrade).
--
-- Run directly in the Supabase SQL Editor or via Supabase MCP.
-- =============================================================================


-- =============================================================================
-- 1. SHARED APPLICATIONS TABLE
--
-- One row per evaluated application across all programs.
-- key_facts JSONB holds program-specific evaluation fields.
--
-- data_source is the scalability hook:
--   'seeded' = deterministic synthetic test data (default)
--   'live'   = real client application data
--
-- When rows with data_source='live' exist for a program, the Scenario Sandbox
-- automatically upgrades the Impact Preview badge from "Seeded" to "Live"
-- with no code changes.
--
-- Adding a new program:
--   1. INSERT 500 rows with the program's key_facts and data_source='seeded'
--   2. Add one entry to PROGRAM_IMPACT_CONFIG in scenario-sandbox.html
--   Done. No schema changes needed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS applications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  TEXT        NOT NULL REFERENCES programs(program_id),
  tenant_id   TEXT        NOT NULL REFERENCES tenants(tenant_id),
  data_source TEXT        NOT NULL DEFAULT 'seeded'
              CHECK (data_source IN ('seeded', 'live')),
  key_facts   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decision    TEXT        NOT NULL
              CHECK (decision IN ('approved', 'approved_with_conditions', 'blocked', 'pending')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_program
  ON applications(program_id);

CREATE INDEX IF NOT EXISTS idx_applications_source
  ON applications(program_id, data_source);

-- GIN index enables fast key-existence queries on key_facts if needed later
CREATE INDEX IF NOT EXISTS idx_applications_facts
  ON applications USING gin(key_facts);


-- =============================================================================
-- 2. FIX scenario_impact_results — add UNIQUE constraint for upserts
--
-- The table was created in migration 16 without a unique constraint, so
-- repeated Impact Preview clicks INSERT duplicate rows instead of updating.
-- This constraint enables POST with "Prefer: resolution=merge-duplicates"
-- (Supabase REST upsert pattern).
-- =============================================================================
DO $$
BEGIN
  ALTER TABLE scenario_impact_results
    ADD CONSTRAINT uq_impact_scenario_rule UNIQUE (scenario_id, rule_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- 3. ADD data_source TO grant_applications
--
-- Prepares the DDC grant_applications table for the same live-data upgrade
-- path as the shared applications table. When real DDC grant data is loaded,
-- insert with data_source='live' and the badge auto-upgrades.
-- =============================================================================
ALTER TABLE grant_applications
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'seeded'
  CHECK (data_source IN ('seeded', 'live'));


-- =============================================================================
-- VERIFICATION — run after applying to confirm:
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='applications';
--
-- SELECT constraint_name FROM information_schema.table_constraints
--   WHERE table_name='scenario_impact_results'
--     AND constraint_type='UNIQUE';
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='grant_applications' AND column_name='data_source';
