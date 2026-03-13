-- ============================================================
-- LexiPoint Migration 14 — Child Care Live Demo Rules
-- Adds CC-CAP-001 and CC-CAP-002 to childcare-licensing.
--
-- These rules are fetched at runtime by childcare.html and can
-- be edited in the Ontology Manager to change evaluation outcomes
-- in real-time — the core LexiPoint live demo story.
--
-- Run AFTER 09_ohio_childcare_rules.sql (program/tenant must exist)
-- ============================================================

INSERT INTO rules (
  rule_id, program_id, tenant_id, name, description, citation,
  jurisdiction, rule_type, phase, priority, status, version,
  effective_date, classification, created_by, updated_at
) VALUES
(
  'CC-CAP-001', 'childcare-licensing', 'ohio-odjfs',
  'Indoor Space Threshold Per Child',
  'Minimum usable indoor square footage per child (excluding hallways, restrooms, offices, and kitchen). Edit this threshold in the Ontology Manager to immediately change which applications pass or fail the physical environment check.',
  'OAC §5101:2-12-11',
  'Ohio', 'GATE', 'PHYSICAL_ENVIRONMENT', 'P1', 'active', '1.0',
  '2024-01-01', 'standard', 'user-301', NOW()
),
(
  'CC-CAP-002', 'childcare-licensing', 'ohio-odjfs',
  'Staff-to-Child Ratio (Preschool 3–5 yr)',
  'Maximum number of preschool-age children (3–5 years) per staff member. Adjust this value to demonstrate how a regulatory amendment immediately propagates through live evaluations.',
  'OAC §5101:2-12-18',
  'Ohio', 'GATE', 'RATIOS_GROUP_SIZE', 'P1', 'active', '1.0',
  '2024-01-01', 'standard', 'user-301', NOW()
);

INSERT INTO rule_conditions (rule_id, "order", field, operator, value, value_type)
VALUES
  ('CC-CAP-001', 1, 'indoor_space_per_child', '>=', '35', 'integer'),
  ('CC-CAP-002', 1, 'children_per_staff',     '<=', '12', 'integer');

INSERT INTO audit_log (audit_id, tenant_id, user_id, role, action, target_type, target_id, detail, timestamp)
VALUES
  ('aud-cc-cap-001', 'ohio-odjfs', 'user-301', 'publisher', 'publish', 'rule', 'CC-CAP-001', 'Migration 14: added CC-CAP-001 (Indoor Space Threshold) live demo rule', NOW()),
  ('aud-cc-cap-002', 'ohio-odjfs', 'user-301', 'publisher', 'publish', 'rule', 'CC-CAP-002', 'Migration 14: added CC-CAP-002 (Preschool Staff Ratio) live demo rule',  NOW());
