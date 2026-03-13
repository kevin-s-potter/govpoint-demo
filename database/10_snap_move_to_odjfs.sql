-- ============================================================
-- LexiPoint Migration 10: Move SNAP from ohio-odh to ohio-odjfs
-- SNAP Benefits is an ODJFS program, not ODH.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. Move the program record ────────────────────────────────
UPDATE programs
SET tenant_id = 'ohio-odjfs'
WHERE program_id = 'snap';

-- ── 2. Move all SNAP rules ────────────────────────────────────
UPDATE rules
SET tenant_id   = 'ohio-odjfs',
    created_by  = 'user-301'
WHERE program_id = 'snap';

-- ── 3. Reassign user roles to ODJFS users ─────────────────────
DELETE FROM user_roles WHERE program_id = 'snap';

INSERT INTO user_roles (user_id, program_id, role) VALUES
  ('user-301', 'snap', 'publisher'),
  ('user-302', 'snap', 'reviewer')
ON CONFLICT DO NOTHING;

-- ── 4. Audit this migration ───────────────────────────────────
INSERT INTO audit_log (tenant_id, user_id, role, action, target_type, target_id, detail)
VALUES (
  'ohio-odjfs', 'user-301', 'publisher', 'tenant_reassign', 'program', 'snap',
  '{"from": "ohio-odh", "to": "ohio-odjfs", "reason": "SNAP is an ODJFS program, not ODH"}'
);
