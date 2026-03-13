-- ============================================================
-- LexiPoint Migration 11: Fix rule_conditions CHECK constraints
-- The operator and value_type CHECK constraints were misaligned
-- with the values the UI (Ontology Manager Logic Builder) produces.
-- Dropping them here; valid values are enforced by the UI via
-- CB_OPERATORS and CB_FIELDS definitions.
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE rule_conditions
  DROP CONSTRAINT IF EXISTS rule_conditions_operator_check;

ALTER TABLE rule_conditions
  DROP CONSTRAINT IF EXISTS rule_conditions_value_type_check;
