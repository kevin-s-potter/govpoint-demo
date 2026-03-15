-- Migration 24: Auth tables for Google OAuth login, login audit trail, and API usage tracking
-- Run in Supabase SQL Editor after completing manual Google OAuth config steps

-- ── APPROVED USERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approved_users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('viewer', 'admin')),
  persona_name TEXT        NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO approved_users (email, role, persona_name, active)
VALUES ('kevin@aimpointtechnology.com', 'admin', 'Kevin Potter, Aimpoint Technology', true)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read own approved_users row"
  ON approved_users FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- ── LOGIN AUDIT LOG ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  event_type   TEXT        NOT NULL CHECK (event_type IN ('login', 'blocked', 'logout')),
  persona_name TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_email      ON login_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit_log(created_at DESC);

ALTER TABLE login_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert login events"
  ON login_audit_log FOR INSERT
  WITH CHECK (true);

-- ── API USAGE LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name  TEXT          NOT NULL,
  model          TEXT          NOT NULL,
  input_tokens   INTEGER       NOT NULL,
  output_tokens  INTEGER       NOT NULL,
  estimated_cost NUMERIC(10,6) GENERATED ALWAYS AS (
    CASE
      WHEN model LIKE '%haiku%'
        THEN (input_tokens::numeric / 1000000 * 0.80) + (output_tokens::numeric / 1000000 * 4.00)
      ELSE
        (input_tokens::numeric / 1000000 * 3.00) + (output_tokens::numeric / 1000000 * 15.00)
    END
  ) STORED,
  program_id     TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_function   ON api_usage_log(function_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_log(created_at DESC);
