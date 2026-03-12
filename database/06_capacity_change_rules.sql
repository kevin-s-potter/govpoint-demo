-- ============================================================
-- LexiPoint Migration 06 — Capacity Change Evaluation Rules
-- Adds CAP-001, CAP-002, CAP-003 to the hosp-licensing program.
-- These rules drive live evaluation in the New Request form.
-- Editing their conditions in the Ontology Manager immediately
-- changes evaluation outcomes — the core LexiPoint demo story.
-- Run AFTER 02_seed_data.sql
-- ============================================================

-- ── CAP RULES ───────────────────────────────────────────────
INSERT INTO rules (
  rule_id, program_id, tenant_id, name, description, citation,
  jurisdiction, rule_type, phase, priority, status, version,
  effective_date, sunset_date, classification, created_by, updated_at
) VALUES

('CAP-001', 'hosp-licensing', 'ohio-odh',
 'CON Capital Expenditure Threshold',
 'Certificate of Need review is required when a capacity change project capital expenditure meets or exceeds the defined threshold. Change the threshold value here to immediately change which applications are flagged for CON review — no code deployment required.',
 'ORC 3702.51', 'Ohio', 'GATE', 'APPLICATION_PROCESSING', 'P1', 'active', '1.0',
 '2024-01-01', NULL, 'standard', 'user-001', NOW()),

('CAP-002', 'hosp-licensing', 'ohio-odh',
 'CAH Inpatient Bed Limit',
 'Critical Access Hospitals must keep their total proposed inpatient bed count at or below the defined limit. Exceeding this threshold blocks the capacity change and triggers CAH status review — potentially converting the facility from cost-based to prospective payment reimbursement.',
 '42 CFR 485 Subpart F', 'Federal', 'GATE', 'APPLICATION_PROCESSING', 'P1', 'active', '1.0',
 '2024-01-01', NULL, 'standard', 'user-001', NOW()),

('CAP-003', 'hosp-licensing', 'ohio-odh',
 'Swing Bed Authorization Threshold',
 'Swing-bed authorization under 42 CFR 482.58 is limited to hospitals below the defined bed count. When proposed total beds meets or exceeds this threshold, swing-bed authorization is automatically revoked. Adjust the threshold to change which capacity changes trigger this review.',
 '42 CFR 482.58', 'Federal', 'INFO', 'APPLICATION_PROCESSING', 'P2', 'active', '1.0',
 '2024-01-01', NULL, 'standard', 'user-001', NOW());


-- ── CAP RULE CONDITIONS ──────────────────────────────────────
-- These use evaluation-specific field names that map to
-- the capacity change application form inputs in index.html.
-- Fields: capital_expenditure, facility_class, total_beds_proposed

INSERT INTO rule_conditions (rule_id, "order", field, operator, value, value_type) VALUES
('CAP-001', 1, 'capital_expenditure', '>=', '5000000',        'number'),
('CAP-002', 1, 'facility_class',      '=',  'CRITICAL_ACCESS','text'),
('CAP-002', 2, 'total_beds_proposed', '>',  '25',             'number'),
('CAP-003', 1, 'total_beds_proposed', '>=', '100',            'number');


-- ── AUDIT LOG ───────────────────────────────────────────────
INSERT INTO audit_log (
  audit_id, tenant_id, timestamp, user_id, role, action,
  target_type, target_id, detail, ip_address
) VALUES
('aud-cap-001', 'ohio-odh', NOW(), 'user-001', 'publisher', 'create_draft',
 'rule', 'CAP-001', 'Created capacity change evaluation rule: CON Capital Expenditure Threshold', '10.0.1.42'),
('aud-cap-002', 'ohio-odh', NOW(), 'user-001', 'publisher', 'create_draft',
 'rule', 'CAP-002', 'Created capacity change evaluation rule: CAH Inpatient Bed Limit', '10.0.1.42'),
('aud-cap-003', 'ohio-odh', NOW(), 'user-001', 'publisher', 'create_draft',
 'rule', 'CAP-003', 'Created capacity change evaluation rule: Swing Bed Authorization Threshold', '10.0.1.42');


-- ── VERIFICATION ────────────────────────────────────────────
-- After running, verify with:
-- SELECT rule_id, name, status FROM rules WHERE rule_id LIKE 'CAP-%';
-- SELECT * FROM rule_conditions WHERE rule_id LIKE 'CAP-%' ORDER BY rule_id, "order";
