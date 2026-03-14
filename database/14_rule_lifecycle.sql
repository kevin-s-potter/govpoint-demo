-- ============================================================
-- LexiPoint Database Schema — Migration 14
-- Rule Lifecycle: parent_rule_id, superseded_by, next_review_date,
--                 approved_by, approved_at + 'pending' status
-- ============================================================

-- ── ADD COLUMNS TO rules ─────────────────────────────────────
ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS parent_rule_id   TEXT REFERENCES rules(rule_id),
  ADD COLUMN IF NOT EXISTS superseded_by    TEXT REFERENCES rules(rule_id),
  ADD COLUMN IF NOT EXISTS next_review_date DATE,
  ADD COLUMN IF NOT EXISTS approved_by      TEXT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

-- ── UPDATE status CHECK to include 'pending' ─────────────────
ALTER TABLE rules
  DROP CONSTRAINT rules_status_check,
  ADD CONSTRAINT rules_status_check
    CHECK (status IN ('draft', 'review', 'active', 'pending', 'sunset', 'archived'));

-- ── DROP unique constraint on rule_versions so multiple saves ─
-- per version are allowed (e.g. multiple edits to a v1.0 rule)
ALTER TABLE rule_versions
  DROP CONSTRAINT IF EXISTS rule_versions_rule_id_version_key;

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rules_parent      ON rules(parent_rule_id);
CREATE INDEX IF NOT EXISTS idx_rules_review_date ON rules(next_review_date)
  WHERE next_review_date IS NOT NULL;

-- ============================================================
-- DONE. ontology.html lifecycle features can now be activated.
-- ============================================================
