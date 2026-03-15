-- Migration 25: Add program_id to audit_log and rule_versions for direct program-scoped filtering
-- This avoids client-side Set cross-referencing and enables efficient indexed queries.

-- Add program_id to audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES programs(program_id);
UPDATE audit_log al
  SET program_id = r.program_id
  FROM rules r
  WHERE al.target_type = 'rule' AND al.target_id = r.rule_id;
CREATE INDEX IF NOT EXISTS idx_audit_log_program ON audit_log(program_id, timestamp DESC);

-- Add program_id to rule_versions
ALTER TABLE rule_versions ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES programs(program_id);
UPDATE rule_versions rv
  SET program_id = r.program_id
  FROM rules r
  WHERE rv.rule_id = r.rule_id;
CREATE INDEX IF NOT EXISTS idx_rule_versions_program ON rule_versions(program_id, changed_at DESC);
