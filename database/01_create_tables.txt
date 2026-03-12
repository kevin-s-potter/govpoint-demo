-- ============================================================
-- GovPoint Database Schema — Migration 01
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- ── TENANTS ─────────────────────────────────────────────────
-- Top-level organizational unit (state agency or department)
CREATE TABLE tenants (
  tenant_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  abbreviation TEXT,
  state        TEXT,
  logo_url     TEXT,
  settings     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── PROGRAMS ────────────────────────────────────────────────
-- A regulatory program within a tenant (e.g., Hospital Licensing, SNAP)
CREATE TABLE programs (
  program_id   TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(tenant_id),
  name         TEXT NOT NULL,
  code         TEXT,
  description  TEXT,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active', 'planned', 'archived')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_programs_tenant ON programs(tenant_id);

-- ── USERS ───────────────────────────────────────────────────
-- People who interact with the ontology manager
CREATE TABLE users (
  user_id          TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id),
  email            TEXT UNIQUE NOT NULL,
  display_name     TEXT NOT NULL,
  avatar_initials  TEXT,
  sso_subject      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  last_login       TIMESTAMPTZ
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email  ON users(email);

-- ── USER ROLES ──────────────────────────────────────────────
-- Per-program role assignments (viewer, author, reviewer, publisher, program_admin, tenant_admin)
CREATE TABLE user_roles (
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  program_id TEXT NOT NULL REFERENCES programs(program_id),
  role       TEXT NOT NULL CHECK (role IN ('viewer', 'author', 'reviewer', 'publisher', 'program_admin', 'tenant_admin')),
  PRIMARY KEY (user_id, program_id)
);

-- ── RULES ───────────────────────────────────────────────────
-- The core entity — a single regulatory rule in the ontology
CREATE TABLE rules (
  rule_id         TEXT PRIMARY KEY,
  program_id      TEXT NOT NULL REFERENCES programs(program_id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  name            TEXT NOT NULL,
  description     TEXT,
  citation        TEXT,
  jurisdiction    TEXT CHECK (jurisdiction IN ('Federal', 'Ohio', 'Local')),
  rule_type       TEXT CHECK (rule_type IN ('GATE', 'FILTER', 'CALC', 'ROUTE', 'INFO')),
  phase           TEXT,
  priority        TEXT CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'active', 'sunset', 'archived')),
  version         TEXT DEFAULT '1.0',
  effective_date  DATE,
  sunset_date     DATE,
  classification  TEXT DEFAULT 'standard' CHECK (classification IN ('standard', 'restricted', 'confidential')),
  created_by      TEXT REFERENCES users(user_id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rules_program  ON rules(tenant_id, program_id, status);
CREATE INDEX idx_rules_status   ON rules(status);
CREATE INDEX idx_rules_type     ON rules(rule_type);

-- ── RULE CONDITIONS ─────────────────────────────────────────
-- Structured conditions for deterministic evaluation
CREATE TABLE rule_conditions (
  id          SERIAL PRIMARY KEY,
  rule_id     TEXT NOT NULL REFERENCES rules(rule_id) ON DELETE CASCADE,
  "order"     INTEGER NOT NULL,
  field       TEXT NOT NULL,
  operator    TEXT NOT NULL CHECK (operator IN ('==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT_IN', 'BETWEEN', 'CONTAINS')),
  value       TEXT NOT NULL,
  value_type  TEXT DEFAULT 'string' CHECK (value_type IN ('string', 'integer', 'decimal', 'boolean', 'date', 'list')),
  UNIQUE (rule_id, "order")
);

CREATE INDEX idx_conditions_rule ON rule_conditions(rule_id);

-- ── RULE DEPENDENCIES ───────────────────────────────────────
-- How rules relate to each other
CREATE TABLE rule_dependencies (
  id              SERIAL PRIMARY KEY,
  rule_id         TEXT NOT NULL REFERENCES rules(rule_id) ON DELETE CASCADE,
  depends_on      TEXT NOT NULL REFERENCES rules(rule_id),
  dependency_type TEXT CHECK (dependency_type IN ('requires', 'impacts', 'related', 'overrides')),
  description     TEXT,
  UNIQUE (rule_id, depends_on)
);

CREATE INDEX idx_deps_rule ON rule_dependencies(rule_id);
CREATE INDEX idx_deps_target ON rule_dependencies(depends_on);

-- ── RULE VERSIONS ───────────────────────────────────────────
-- Full version history for every rule change
CREATE TABLE rule_versions (
  id              SERIAL PRIMARY KEY,
  rule_id         TEXT NOT NULL REFERENCES rules(rule_id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  changed_by      TEXT REFERENCES users(user_id),
  changed_at      TIMESTAMPTZ DEFAULT now(),
  change_summary  TEXT,
  diff            JSONB,
  UNIQUE (rule_id, version)
);

CREATE INDEX idx_versions_rule ON rule_versions(rule_id);

-- ── COMMENTS ────────────────────────────────────────────────
-- Discussion threads on rules
CREATE TABLE comments (
  comment_id  TEXT PRIMARY KEY DEFAULT 'cmt-' || gen_random_uuid()::text,
  rule_id     TEXT NOT NULL REFERENCES rules(rule_id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(user_id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_rule ON comments(rule_id);

-- ── AUDIT LOG ───────────────────────────────────────────────
-- Immutable record of every action in the system
CREATE TABLE audit_log (
  audit_id    TEXT PRIMARY KEY DEFAULT 'aud-' || gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id),
  timestamp   TIMESTAMPTZ DEFAULT now(),
  user_id     TEXT REFERENCES users(user_id),
  role        TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  ip_address  INET
);

CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_target      ON audit_log(target_type, target_id);

-- ── NOTIFICATIONS ───────────────────────────────────────────
-- User-facing notifications
CREATE TABLE notifications (
  notification_id  TEXT PRIMARY KEY DEFAULT 'ntf-' || gen_random_uuid()::text,
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id),
  user_id          TEXT NOT NULL REFERENCES users(user_id),
  title            TEXT NOT NULL,
  read             BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, read, created_at DESC);

-- ── ROW LEVEL SECURITY (RLS) ────────────────────────────────
-- These policies ensure tenant isolation when you enable RLS later.
-- For now they're defined but RLS is not enabled (demo mode).
-- To enable: ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment when ready):
-- CREATE POLICY tenant_isolation ON rules
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant')::text);

-- ============================================================
-- DONE. Now run 02_seed_data.sql to populate.
-- ============================================================
