-- =============================================================================
-- Migration 23: Fix superseded rules left in 'active' status
--
-- Finds parent rules that have an active child amendment and archives them.
-- Safe to run multiple times (idempotent).
-- =============================================================================

-- Preview first (read-only check):
-- SELECT parent.rule_id AS should_archive, child.rule_id AS superseded_by
-- FROM rules parent
-- JOIN rules child ON child.parent_rule_id = parent.rule_id
-- WHERE child.status = 'active' AND parent.status = 'active';

-- Apply the fix:
UPDATE rules AS parent
SET
  status        = 'archived',
  superseded_by = child.rule_id
FROM rules AS child
WHERE child.parent_rule_id = parent.rule_id
  AND child.status  = 'active'
  AND parent.status = 'active';

-- Verify result:
-- SELECT rule_id, status, superseded_by, parent_rule_id
-- FROM rules
-- WHERE status = 'archived' AND superseded_by IS NOT NULL
-- ORDER BY rule_id;
