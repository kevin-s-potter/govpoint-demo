-- ============================================================
-- LexiPoint Database Schema — Migration 16
-- Scenario Sandbox: AI Policy Goal Generator + Lightweight Sandbox
-- Run via Supabase MCP: mcp__supabase__apply_migration
-- ============================================================

-- ── SCENARIOS ────────────────────────────────────────────────
-- Top-level container for both AI-generated and manual sandbox scenarios
CREATE TABLE scenarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    TEXT NOT NULL REFERENCES programs(program_id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(tenant_id),
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('ai_generated', 'manual')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  policy_goal   TEXT,                     -- Capability 1: the natural-language input goal
  time_period_start TIMESTAMPTZ,          -- Capability 1: audit analysis window start
  time_period_end   TIMESTAMPTZ,          -- Capability 1: audit analysis window end
  confidence    INTEGER CHECK (confidence >= 0 AND confidence <= 100),  -- AI confidence 0-100
  ai_model      TEXT,                     -- model used for generation (e.g. claude-sonnet-4-6)
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenarios_program  ON scenarios(program_id);
CREATE INDEX idx_scenarios_tenant   ON scenarios(tenant_id);
CREATE INDEX idx_scenarios_status   ON scenarios(status);

-- ── SCENARIO RULE SNAPSHOTS ───────────────────────────────────
-- Per-rule condition snapshots inside a sandbox (original vs. proposed)
CREATE TABLE scenario_rule_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id         UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  rule_id             TEXT NOT NULL REFERENCES rules(rule_id),
  rule_name           TEXT NOT NULL,
  change_rationale    TEXT,              -- AI-generated explanation or analyst note
  original_conditions JSONB NOT NULL,   -- snapshot of rule_conditions at fork time
  sandbox_conditions  JSONB NOT NULL,   -- proposed modified conditions
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_scenario ON scenario_rule_snapshots(scenario_id);
CREATE INDEX idx_snapshots_rule     ON scenario_rule_snapshots(rule_id);

-- ── SCENARIO IMPACT RESULTS ───────────────────────────────────
-- Computed impact estimates per rule (recomputable on demand)
CREATE TABLE scenario_impact_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  rule_id         TEXT NOT NULL,
  outcome_changes INTEGER DEFAULT 0,   -- estimated Pass→Fail or Fail→Pass flips
  affected_count  INTEGER DEFAULT 0,   -- estimated submissions affected
  detail          JSONB,               -- breakdown by condition change
  computed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_impact_scenario ON scenario_impact_results(scenario_id);

-- ── AUDIT LOG entries for scenario actions ─────────────────────
-- No new table needed — we insert into existing audit_log table
-- ============================================================
-- DONE. Apply via Supabase MCP then deploy edge function.
-- ============================================================
