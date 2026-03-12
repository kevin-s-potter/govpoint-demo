-- ============================================================
-- GovPoint Seed Data — Migration 02
-- Run this AFTER 01_create_tables.sql
-- Populates all tables with Ohio Hospital Licensing demo data
-- ============================================================

-- ── TENANT ──────────────────────────────────────────────────
INSERT INTO tenants (tenant_id, name, abbreviation, state, settings) VALUES
('ohio-odh', 'Ohio Department of Health', 'ODH', 'OH', '{
  "ai_model": "claude-3.5-sonnet",
  "sso_provider": "okta",
  "classification_levels": ["standard", "restricted", "confidential"]
}'::jsonb);

-- ── PROGRAMS ────────────────────────────────────────────────
INSERT INTO programs (tenant_id, program_id, name, code, description, status) VALUES
('ohio-odh', 'hosp-licensing', 'Hospital Licensing', 'HEA-3614', 'Ohio hospital licensing under ORC Chapter 3702', 'active'),
('ohio-odh', 'snap',           'SNAP Benefits',      'SNAP-OH',  'Supplemental Nutrition Assistance Program — Ohio implementation', 'planned'),
('ohio-odh', 'medicaid',       'Medicaid Eligibility','MCD-OH',   'Ohio Medicaid eligibility and enrollment rules', 'planned'),
('ohio-odh', 'child-care',     'Child Care Licensing','CCL-OH',   'Ohio child care facility licensing', 'planned');

-- ── USERS ───────────────────────────────────────────────────
INSERT INTO users (user_id, tenant_id, email, display_name, avatar_initials, sso_subject, last_login) VALUES
('user-001', 'ohio-odh', 'sarah.chen@odh.ohio.gov',   'Sarah Chen',   'SC', 'sarah.chen@okta',   '2026-03-11 08:15:00-05'),
('user-002', 'ohio-odh', 'james.miller@odh.ohio.gov', 'James Miller', 'JM', 'james.miller@okta', '2026-03-10 14:22:00-05'),
('user-003', 'ohio-odh', 'lisa.park@odh.ohio.gov',    'Lisa Park',    'LP', 'lisa.park@okta',    '2026-03-09 11:05:00-05');

-- ── USER ROLES ──────────────────────────────────────────────
INSERT INTO user_roles (user_id, program_id, role) VALUES
('user-001', 'hosp-licensing', 'publisher'),
('user-002', 'hosp-licensing', 'reviewer'),
('user-003', 'hosp-licensing', 'viewer');

-- ── RULES ───────────────────────────────────────────────────
INSERT INTO rules (rule_id, program_id, tenant_id, name, description, citation, jurisdiction, rule_type, phase, priority, status, version, effective_date, sunset_date, classification, created_by, updated_at) VALUES
('OH-001', 'hosp-licensing', 'ohio-odh', 'Bed Capacity Minimum',
 'Hospital must maintain a minimum of 25 licensed beds to qualify for full hospital licensure under ORC § 3702.30.',
 'ORC § 3702.30(A)(1)', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '2.1', '2024-01-01', NULL, 'standard', 'user-001', '2026-03-10 14:32:00-05'),

('OH-002', 'hosp-licensing', 'ohio-odh', 'Emergency Department Staffing',
 'Emergency departments must maintain minimum physician staffing levels and bed counts per OAC 3701-59-01.',
 'OAC 3701-59-01(B)', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '1.8', '2024-01-01', NULL, 'standard', 'user-001', '2026-03-08 09:15:00-05'),

('OH-003', 'hosp-licensing', 'ohio-odh', 'ICU Isolation Requirements',
 'ICU units must maintain isolation capacity of at least 50% of ICU beds per infection control standards.',
 'OAC 3701-59-03(C)', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '3.0', '2024-01-01', NULL, 'standard', 'user-001', '2026-02-28 16:00:00-05'),

('OH-004', 'hosp-licensing', 'ohio-odh', 'Pharmacy Licensing',
 'Hospital pharmacy must be staffed by a licensed pharmacist with minimum 16 operating hours daily.',
 'ORC § 4729.27', 'Ohio', 'GATE', 'LICENSING', 'P2', 'active', '1.5', '2024-01-01', NULL, 'standard', 'user-001', '2026-01-15 10:00:00-05'),

('OH-005', 'hosp-licensing', 'ohio-odh', 'Infection Control Program',
 'Hospitals must establish an infection control committee and conduct quarterly surveillance audits.',
 'OAC 3701-59-05', 'Ohio', 'GATE', 'COMPLIANCE', 'P1', 'review', '2.3', '2024-01-01', NULL, 'standard', 'user-002', '2026-03-09 13:45:00-05'),

('OH-006', 'hosp-licensing', 'ohio-odh', 'Medical Records Management',
 'Hospitals must maintain digital medical records with daily backup frequency and audit trails.',
 'ORC § 3701.74', 'Ohio', 'GATE', 'COMPLIANCE', 'P2', 'active', '1.9', '2024-01-01', NULL, 'restricted', 'user-001', '2026-02-10 08:30:00-05'),

('OH-007', 'hosp-licensing', 'ohio-odh', 'Patient Safety Reporting',
 'Hospitals must maintain incident reporting system with response time not exceeding 24 hours.',
 'ORC § 3727.60', 'Ohio', 'GATE', 'COMPLIANCE', 'P1', 'active', '2.0', '2024-01-01', NULL, 'standard', 'user-001', '2026-02-20 11:00:00-05'),

('OH-008', 'hosp-licensing', 'ohio-odh', 'Quality Assurance Program',
 'Hospitals must establish a quality assurance committee with monthly review cadence.',
 'OAC 3701-59-08', 'Ohio', 'GATE', 'COMPLIANCE', 'P2', 'active', '1.6', '2024-01-01', NULL, 'standard', 'user-002', '2026-01-30 14:00:00-05'),

('OH-009', 'hosp-licensing', 'ohio-odh', 'CON Expedited Review',
 'Certificate of Need expedited review pathway for projects exceeding $200K with bed changes of 5 or fewer.',
 'ORC § 3702.52(A)', 'Ohio', 'ROUTE', 'APPLICATION_PROCESSING', 'P2', 'active', '1.2', '2024-01-01', NULL, 'standard', 'user-001', '2026-01-10 09:00:00-05'),

('OH-010', 'hosp-licensing', 'ohio-odh', 'Capital Equipment Reporting',
 'Equipment purchases exceeding $50K must be reported within 30 days of acquisition.',
 'OAC 3701-59-10', 'Ohio', 'INFO', 'REPORTING_VERIFICATION', 'P3', 'active', '1.0', '2024-01-01', NULL, 'standard', 'user-002', '2024-02-15 00:00:00-05'),

('OH-011', 'hosp-licensing', 'ohio-odh', 'Telemedicine Compliance',
 'Telehealth services must be provided by licensed practitioners with documented patient consent.',
 'ORC § 3702.30(B)(2)', 'Ohio', 'GATE', 'LICENSING', 'P2', 'draft', '1.0', NULL, NULL, 'standard', 'user-001', '2026-03-05 16:48:00-05'),

('OH-012', 'hosp-licensing', 'ohio-odh', 'Surgical Suite Standards',
 'Hospitals must maintain minimum 2 surgical suites with air exchange rate of 25+ per hour.',
 'OAC 3701-59-12', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '2.1', '2024-01-01', NULL, 'standard', 'user-001', '2026-02-15 10:30:00-05'),

('OH-013', 'hosp-licensing', 'ohio-odh', 'Laboratory Accreditation',
 'Hospital laboratories must maintain CLIA certification and participate in proficiency testing.',
 'ORC § 3701.21', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '1.7', '2024-01-01', NULL, 'standard', 'user-002', '2026-01-20 09:00:00-05'),

('OH-014', 'hosp-licensing', 'ohio-odh', 'Radiology Department',
 'Hospitals must maintain on-call radiologist coverage and MRI availability.',
 'OAC 3701-59-14', 'Ohio', 'GATE', 'LICENSING', 'P2', 'active', '2.0', '2024-01-01', NULL, 'standard', 'user-001', '2026-01-25 14:00:00-05'),

('OH-015', 'hosp-licensing', 'ohio-odh', 'Fire Code Compliance',
 'Hospitals must maintain sprinkler systems and minimum 3 emergency exits per floor.',
 'ORC § 3737.83', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '1.8', '2024-01-01', NULL, 'standard', 'user-001', '2026-02-01 08:00:00-05'),

('OH-016', 'hosp-licensing', 'ohio-odh', 'Nursing Staffing Ratios',
 'Hospitals must maintain minimum RN ratio of 0.5 per patient with continuous staffing coverage.',
 'OAC 3701-59-16', 'Ohio', 'GATE', 'LICENSING', 'P1', 'active', '2.2', '2024-01-01', NULL, 'standard', 'user-002', '2026-03-01 11:00:00-05'),

('OH-017', 'hosp-licensing', 'ohio-odh', 'Dietary Services',
 'Hospitals must employ a licensed dietitian with quarterly menu planning review cycles.',
 'OAC 3701-59-17', 'Ohio', 'GATE', 'COMPLIANCE', 'P3', 'active', '1.4', '2024-01-01', NULL, 'standard', 'user-001', '2025-12-01 09:00:00-05'),

('OH-018', 'hosp-licensing', 'ohio-odh', 'Environmental Health & Safety',
 'Hospitals must conduct annual hazmat training and maintain compliant waste disposal.',
 'OAC 3701-59-18', 'Ohio', 'GATE', 'COMPLIANCE', 'P2', 'active', '1.6', '2024-01-01', NULL, 'standard', 'user-002', '2025-11-15 14:00:00-05'),

('OH-019', 'hosp-licensing', 'ohio-odh', 'Patient Rights & Grievance',
 'Hospitals must maintain a documented grievance process with response time not exceeding 14 days.',
 'ORC § 3727.10', 'Ohio', 'GATE', 'COMPLIANCE', 'P2', 'active', '1.9', '2024-01-01', NULL, 'standard', 'user-001', '2026-02-05 10:00:00-05'),

('OH-020', 'hosp-licensing', 'ohio-odh', 'Telehealth Bed Equivalency',
 'Virtual bed equivalency for telehealth monitoring programs with minimum patient satisfaction thresholds.',
 'ORC § 3702.30(B)(4)', 'Ohio', 'GATE', 'LICENSING', 'P2', 'draft', '1.1', NULL, NULL, 'standard', 'user-002', '2026-03-10 14:32:00-05'),

('FED-001', 'hosp-licensing', 'ohio-odh', 'CMS Conditions of Participation',
 'Medicare-participating hospitals must meet CMS Conditions of Participation with quality scores at or above 85%.',
 '42 CFR § 482.1', 'Federal', 'GATE', 'COMPLIANCE', 'P1', 'active', '3.1', '2024-01-01', NULL, 'standard', 'user-001', '2026-03-05 09:00:00-05'),

('FED-002', 'hosp-licensing', 'ohio-odh', 'Medicaid Compliance - Rates',
 'Medicaid-enrolled hospitals must undergo annual rate review to maintain program participation.',
 '42 CFR § 447.253', 'Federal', 'GATE', 'COMPLIANCE', 'P1', 'review', '2.0', '2024-01-01', NULL, 'restricted', 'user-002', '2026-03-08 13:00:00-05'),

('FED-003', 'hosp-licensing', 'ohio-odh', 'CMS CoP Compliance',
 'Hospitals must pass CMS survey with no more than 5 deficiencies to maintain deemed status.',
 '42 CFR § 488.5', 'Federal', 'GATE', 'COMPLIANCE', 'P1', 'active', '2.4', '2024-01-01', NULL, 'standard', 'user-001', '2026-03-07 16:00:00-05');


-- ── RULE CONDITIONS ─────────────────────────────────────────
INSERT INTO rule_conditions (rule_id, "order", field, operator, value, value_type) VALUES
('OH-001', 1, 'beds',                       '>=', '25',   'integer'),
('OH-001', 2, 'licensed_facility',           '==', 'true', 'boolean'),
('OH-002', 1, 'ed_beds',                     '>=', '10',   'integer'),
('OH-002', 2, 'physicians',                  '>=', '1',    'integer'),
('OH-003', 1, 'icu_beds',                    '>',  '0',    'integer'),
('OH-003', 2, 'isolation_rate',              '>=', '0.5',  'decimal'),
('OH-004', 1, 'licensed_pharmacist',         '==', 'true', 'boolean'),
('OH-004', 2, 'pharmacy_hours',              '>=', '16',   'integer'),
('OH-005', 1, 'infection_control_committee', '==', 'true', 'boolean'),
('OH-005', 2, 'quarterly_audit',             '==', 'true', 'boolean'),
('OH-006', 1, 'digital_records',             '==', 'true', 'boolean'),
('OH-006', 2, 'backup_frequency',            '==', 'daily','string'),
('OH-007', 1, 'incident_reporting',          '==', 'true', 'boolean'),
('OH-007', 2, 'response_time',              '<=', '24',   'integer'),
('OH-008', 1, 'qa_committee',               '==', 'true', 'boolean'),
('OH-008', 2, 'review_frequency',            '==', 'monthly','string'),
('OH-009', 1, 'project_cost',               '>',  '200000','integer'),
('OH-009', 2, 'bed_change',                 '<=', '5',    'integer'),
('OH-010', 1, 'equipment_cost',             '>',  '50000','integer'),
('OH-010', 2, 'report_within_30_days',      '==', 'true', 'boolean'),
('OH-011', 1, 'telehealth_enabled',         '==', 'true', 'boolean'),
('OH-011', 2, 'licensed_provider',           '==', 'true', 'boolean'),
('OH-012', 1, 'surgical_suites',            '>=', '2',    'integer'),
('OH-012', 2, 'air_exchange_rate',           '>=', '25',   'integer'),
('OH-013', 1, 'clia_certified',             '==', 'true', 'boolean'),
('OH-013', 2, 'proficiency_testing',         '==', 'true', 'boolean'),
('OH-014', 1, 'radiologist_on_call',        '==', 'true', 'boolean'),
('OH-014', 2, 'mri_available',              '==', 'true', 'boolean'),
('OH-015', 1, 'sprinkler_system',           '==', 'true', 'boolean'),
('OH-015', 2, 'emergency_exits',            '>=', '3',    'integer'),
('OH-016', 1, 'rn_ratio',                   '>=', '0.5',  'decimal'),
('OH-016', 2, 'continuous_staffing',         '==', 'true', 'boolean'),
('OH-017', 1, 'dietitian_licensed',         '==', 'true', 'boolean'),
('OH-017', 2, 'menu_planning',              '==', 'quarterly','string'),
('OH-018', 1, 'hazmat_training',            '==', 'annual','string'),
('OH-018', 2, 'waste_disposal',             '==', 'compliant','string'),
('OH-019', 1, 'grievance_process',          '==', 'documented','string'),
('OH-019', 2, 'response_time',             '<=', '14',   'integer'),
('OH-020', 1, 'telehealth_beds',            '>=', '5',    'integer'),
('OH-020', 2, 'patient_satisfaction',        '>=', '4.0',  'decimal'),
('FED-001', 1, 'medicare_participating',    '==', 'true', 'boolean'),
('FED-001', 2, 'quality_score',             '>=', '85',   'integer'),
('FED-002', 1, 'medicaid_enrolled',         '==', 'true', 'boolean'),
('FED-002', 2, 'rate_review',              '==', 'annual','string'),
('FED-003', 1, 'cms_surveyed',             '==', 'true', 'boolean'),
('FED-003', 2, 'deficiencies',             '<=', '5',    'integer');


-- ── RULE DEPENDENCIES ───────────────────────────────────────
INSERT INTO rule_dependencies (rule_id, depends_on, dependency_type, description) VALUES
('OH-001', 'FED-001', 'requires', 'CMS participation requires minimum bed count'),
('OH-002', 'OH-016', 'related',  'ED staffing interacts with nursing ratio requirements'),
('OH-002', 'OH-007', 'impacts',  'ED incidents feed into patient safety reporting'),
('OH-005', 'FED-003', 'requires','Infection control is a CMS CoP requirement'),
('OH-009', 'OH-001', 'related',  'CON review threshold relates to bed capacity'),
('OH-011', 'OH-020', 'related',  'Telemedicine compliance governs telehealth bed equivalency'),
('FED-001', 'FED-003', 'requires','CoP conditions must pass CMS survey');


-- ── RULE VERSIONS ───────────────────────────────────────────
INSERT INTO rule_versions (rule_id, version, changed_by, changed_at, change_summary, diff) VALUES
('OH-001', '2.1', 'user-001', '2026-03-10 14:32:00-05', 'Updated threshold parameter from 50 to 25 beds',
 '{"field": "conditions[0].value", "old": "50", "new": "25"}'::jsonb),
('OH-001', '2.0', 'user-002', '2026-03-05 10:15:00-05', 'Reviewed and approved threshold change per HB 247', NULL),
('OH-001', '1.0', 'user-001', '2024-01-20 00:00:00-05', 'Initial rule creation from ORC § 3702.30', NULL),
('OH-005', '2.3', 'user-002', '2026-03-09 13:45:00-05', 'Added quarterly audit frequency requirement',
 '{"field": "conditions[1]", "old": null, "new": "quarterly_audit == true"}'::jsonb),
('OH-005', '2.2', 'user-001', '2026-02-15 08:00:00-05', 'Expanded committee membership requirements', NULL),
('FED-003', '2.4', 'user-001', '2026-03-07 16:00:00-05', 'Lowered deficiency threshold from 10 to 5',
 '{"field": "conditions[1].value", "old": "10", "new": "5"}'::jsonb);


-- ── COMMENTS ────────────────────────────────────────────────
INSERT INTO comments (comment_id, rule_id, user_id, body, created_at) VALUES
('cmt-001', 'OH-001', 'user-001', 'Updated threshold from 50 to 30 beds based on 2026 ORC amendment',                                          '2026-03-05 00:00:00-05'),
('cmt-002', 'OH-001', 'user-002', 'Confirmed — matches the enrolled version of HB 247. Approved.',                                              '2026-03-06 00:00:00-05'),
('cmt-003', 'OH-001', 'user-003', '@Sarah — note that this may interact with the federal CON exemption for critical access hospitals. Flagging for cross-reference.', '2026-03-07 00:00:00-05'),
('cmt-004', 'OH-005', 'user-002', 'Quarterly audit cadence aligned with CMS survey cycle. Recommend adding documentation template reference.',   '2026-03-09 10:00:00-05'),
('cmt-005', 'OH-020', 'user-002', 'Submitted for review — telehealth bed equivalency is a new concept. Need legal sign-off before publish.',     '2026-03-10 08:00:00-05'),
('cmt-006', 'FED-003', 'user-001', 'CMS updated CoP guidance Feb 2026. Tightened deficiency threshold from 10 to 5.',                            '2026-03-07 15:00:00-05');


-- ── AUDIT LOG ───────────────────────────────────────────────
INSERT INTO audit_log (audit_id, tenant_id, timestamp, user_id, role, action, target_type, target_id, detail, ip_address) VALUES
('aud-001', 'ohio-odh', '2026-03-10 14:32:00-05', 'user-001', 'publisher', 'edit_conditions', 'rule', 'OH-001', 'Updated threshold parameter',       '10.0.1.42'),
('aud-002', 'ohio-odh', '2026-03-09 10:15:00-05', 'user-002', 'reviewer',  'approve',         'rule', 'OH-001', 'Moved to Active status',            '10.0.1.58'),
('aud-003', 'ohio-odh', '2026-03-08 09:22:00-05', 'user-001', 'publisher', 'submit_for_review','rule', 'OH-001', 'Draft → Review workflow',            '10.0.1.42'),
('aud-004', 'ohio-odh', '2026-03-05 16:48:00-05', 'user-001', 'publisher', 'create_draft',    'rule', 'OH-001', 'New rule drafted from ORC § 3702.30','10.0.1.42'),
('aud-005', 'ohio-odh', '2026-03-01 08:00:00-05', NULL,        'system',    'publish',         'rule', 'OH-001', 'Rule published to production',       NULL),
('aud-006', 'ohio-odh', '2026-02-28 13:45:00-05', NULL,        'auditor',   'view',            'rule', 'OH-001', 'Compliance audit review',            NULL),
('aud-007', 'ohio-odh', '2026-03-10 14:00:00-05', 'user-002', 'reviewer',  'submit_for_review','rule', 'OH-020', 'New draft submitted for review',     '10.0.1.58'),
('aud-008', 'ohio-odh', '2026-03-09 13:45:00-05', 'user-002', 'reviewer',  'edit_conditions', 'rule', 'OH-005', 'Added quarterly audit condition',    '10.0.1.58'),
('aud-009', 'ohio-odh', '2026-03-07 16:00:00-05', 'user-001', 'publisher', 'edit_conditions', 'rule', 'FED-003','Lowered deficiency threshold',       '10.0.1.42'),
('aud-010', 'ohio-odh', '2026-03-11 08:15:00-05', 'user-001', 'publisher', 'login',           'session','user-001','User login via SSO',              '10.0.1.42');


-- ── NOTIFICATIONS ───────────────────────────────────────────
INSERT INTO notifications (notification_id, tenant_id, user_id, title, read, created_at) VALUES
('ntf-001', 'ohio-odh', 'user-001', 'OH-020 Telehealth Bed Equivalency submitted for review by James Miller',          false, '2026-03-11 06:00:00-05'),
('ntf-002', 'ohio-odh', 'user-001', 'Shared rule FED-003 CMS CoP updated — affects 4 rules in your program',          false, '2026-03-10 00:00:00-05'),
('ntf-003', 'ohio-odh', 'user-001', 'OH-015 Fire Code Compliance: Review deadline in 3 days',                          true,  '2026-03-04 00:00:00-05'),
('ntf-004', 'ohio-odh', 'user-002', 'OH-001 Bed Capacity Minimum: Your review was approved by Sarah Chen',             false, '2026-03-10 14:35:00-05'),
('ntf-005', 'ohio-odh', 'user-002', 'New comment from Lisa Park on OH-001',                                              true,  '2026-03-07 00:00:00-05');


-- ============================================================
-- VERIFICATION QUERIES — Run these to confirm everything loaded
-- ============================================================

-- Quick count check
SELECT 'tenants' AS entity, COUNT(*) FROM tenants
UNION ALL SELECT 'programs', COUNT(*) FROM programs
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL SELECT 'rules', COUNT(*) FROM rules
UNION ALL SELECT 'rule_conditions', COUNT(*) FROM rule_conditions
UNION ALL SELECT 'rule_dependencies', COUNT(*) FROM rule_dependencies
UNION ALL SELECT 'rule_versions', COUNT(*) FROM rule_versions
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY entity;

-- Expected output:
-- audit_log          | 10
-- comments           | 6
-- notifications      | 5
-- programs           | 4
-- rule_conditions    | 46
-- rule_dependencies  | 7
-- rule_versions      | 6
-- rules              | 23
-- tenants            | 1
-- user_roles         | 3
-- users              | 3
