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

-- ── 4. Update audit_log entries ───────────────────────────────
UPDATE audit_log
SET tenant_id  = 'ohio-odjfs',
    changed_by = 'user-301'
WHERE program_id = 'snap';

-- ── 5. Audit this migration ───────────────────────────────────
INSERT INTO audit_log (
  tenant_id, program_id, rule_id, action, changed_by,
  old_value, new_value, changed_at
) VALUES (
  'ohio-odjfs', 'snap', NULL, 'tenant_reassign', 'user-301',
  '{"tenant_id": "ohio-odh"}',
  '{"tenant_id": "ohio-odjfs", "reason": "SNAP is an ODJFS program, not ODH"}',
  NOW()
);
