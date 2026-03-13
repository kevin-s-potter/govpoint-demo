-- ============================================================
-- LexiPoint Migration 12: Disable RLS on rule_conditions
-- RLS was accidentally left enabled on rule_conditions, blocking
-- anon-key INSERT and DELETE. All other tables are in demo mode
-- (RLS off). This aligns rule_conditions with the rest of the schema.
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE rule_conditions DISABLE ROW LEVEL SECURITY;
