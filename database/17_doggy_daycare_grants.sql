-- ============================================================
-- LexiPoint Database Migration 17
-- Paws & Progress Doggy Day Care Grant Program
-- Tenant: city-of-sunridge (fictional city — demo only)
-- Program ID: doggy-daycare | Code: DDC
-- Users: user-401 (Jamie Rivera), user-402 (Alex Kim)
-- Rules: 20 (DDC-001 – DDC-020)
-- Run via Supabase MCP: mcp__supabase__apply_migration
-- ============================================================

-- ── TENANT ──────────────────────────────────────────────────
INSERT INTO tenants (tenant_id, name, abbreviation, state, settings) VALUES
('city-of-sunridge', 'City of Sunridge', 'COS', NULL, '{
  "ai_model": "claude-sonnet-4-6",
  "sso_provider": "okta",
  "classification_levels": ["standard", "restricted", "confidential"]
}'::jsonb);

-- ── PROGRAM ─────────────────────────────────────────────────
INSERT INTO programs (tenant_id, program_id, name, code, description, status) VALUES
('city-of-sunridge', 'doggy-daycare',
 'Paws & Progress Doggy Day Care Grant Program', 'DDC',
 'Municipal grant program subsidizing doggy day care costs for eligible households in Sunridge, Maplewood, and Crestview counties. Illustrates income-tiered benefit calculation, cascading eligibility logic, and multi-variable routing. Fictional — for demo purposes only.',
 'active');

-- ── USERS ───────────────────────────────────────────────────
INSERT INTO users (user_id, tenant_id, email, display_name, avatar_initials, sso_subject, last_login) VALUES
('user-401', 'city-of-sunridge', 'jamie.rivera@sunridge.gov', 'Jamie Rivera', 'JR', 'jamie.rivera@okta', '2025-12-15 09:30:00-05'),
('user-402', 'city-of-sunridge', 'alex.kim@sunridge.gov',    'Alex Kim',    'AK', 'alex.kim@okta',    '2025-12-10 14:00:00-05');

-- ── USER ROLES ──────────────────────────────────────────────
INSERT INTO user_roles (user_id, program_id, role) VALUES
('user-401', 'doggy-daycare', 'program_admin'),
('user-402', 'doggy-daycare', 'reviewer');

-- ── RULES ───────────────────────────────────────────────────
-- GATE rules — application is blocked if the condition fails

INSERT INTO rules
  (rule_id, program_id, tenant_id, name, description, citation,
   jurisdiction, rule_type, phase, priority, status, version,
   effective_date, sunset_date, classification, created_by, updated_at)
VALUES

('DDC-001', 'doggy-daycare', 'city-of-sunridge',
 'Dog Age Eligibility',
 'Dog must be at least 8 weeks old and no older than 10 years to qualify for day care grant coverage. Ensures the program covers dogs in the primary day care age range.',
 'Sunridge Municipal Code § 12.4.1',
 'Local', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-15 09:00:00-05'),

('DDC-002', 'doggy-daycare', 'city-of-sunridge',
 'Breed Safety Classification',
 'Dog breed must appear on the approved breed list per the Federal Pet Day Care Safety Act. Breeds not on the list require a separate variance process; they are ineligible for standard grant processing and trigger DDC-019.',
 'Federal Pet Day Care Safety Act § 3.2(b)',
 'Federal', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-15 09:15:00-05'),

('DDC-003', 'doggy-daycare', 'city-of-sunridge',
 'Facility License Verification',
 'The day care facility named on the application must hold an active municipal operating license. Expired, suspended, or pending licenses disqualify the application until the facility is re-licensed.',
 'Sunridge Municipal Code § 12.5.1',
 'Local', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-15 09:30:00-05'),

('DDC-004', 'doggy-daycare', 'city-of-sunridge',
 'Owner Income Eligibility',
 'Household annual income must not exceed the income threshold set by DDC-010 based on household size. The default threshold for a household of 3–4 persons is $52,000. Income eligibility gates entry into the grant calculation chain (DDC-011).',
 'Sunridge Municipal Code § 12.6.1',
 'Local', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.1',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-06-15 11:00:00-05'),

('DDC-005', 'doggy-daycare', 'city-of-sunridge',
 'Vaccination Currency',
 'Dog must have received a rabies vaccination within the past 365 days as required by the Federal Pet Health Standards Act. Expired vaccinations block the application pending submission of a current vaccination certificate.',
 'Federal Pet Health Standards Act § 7.1',
 'Federal', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-05-10 10:00:00-05'),

('DDC-006', 'doggy-daycare', 'city-of-sunridge',
 'Application Completeness',
 'All required fields on the grant application must be completed and all supporting documents attached before the application enters processing. Incomplete applications are returned to the applicant without review.',
 'Sunridge Municipal Code § 12.3.1',
 'Local', 'GATE', 'APPLICATION_INTAKE', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-15 10:00:00-05'),

('DDC-007', 'doggy-daycare', 'city-of-sunridge',
 'Geographic Eligibility',
 'Applicant must reside in Sunridge, Maplewood, or Crestview county. Applications from other counties are ineligible under the municipal funding agreement that established this program.',
 'Sunridge Municipal Code § 12.2.1',
 'Local', 'GATE', 'ELIGIBILITY', 'P1', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-07-15 14:00:00-05'),

('DDC-008', 'doggy-daycare', 'city-of-sunridge',
 'Prior Grant Cooling Period',
 'Applicants must wait at least 6 months since their last approved grant before submitting a renewal application. Prevents duplicate benefit receipt within the same benefit year. Required check before DDC-020 Renewal Fast Track.',
 'Sunridge Municipal Code § 12.7.2',
 'Local', 'GATE', 'ELIGIBILITY', 'P2', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-01-20 10:30:00-05');

-- FILTER rules — application proceeds but is flagged for review

INSERT INTO rules
  (rule_id, program_id, tenant_id, name, description, citation,
   jurisdiction, rule_type, phase, priority, status, version,
   effective_date, sunset_date, classification, created_by, updated_at)
VALUES

('DDC-009', 'doggy-daycare', 'city-of-sunridge',
 'Max Dogs Per Household',
 'Households with more than 2 dogs are flagged for manual review. Standard grant processing covers up to 2 dogs; additional dogs require supervisor approval and supplemental documentation. Also triggers DDC-019 routing.',
 'Sunridge Municipal Code § 12.8.1',
 'Local', 'FILTER', 'REVIEW', 'P2', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-04-01 14:00:00-05'),

('DDC-013', 'doggy-daycare', 'city-of-sunridge',
 'Annual Benefit Cap',
 'Total annual grant benefits paid to a household must not exceed $2,400. This cap is checked against the combined output of DDC-011 (base amount), DDC-012 (multi-dog discount), and DDC-016 (emergency supplement). Applications that would push total benefits over the cap are flagged for benefit adjustment.',
 'Sunridge Municipal Code § 12.9.1',
 'Local', 'FILTER', 'BENEFIT_CALCULATION', 'P2', 'active', '1.2',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-09-10 14:00:00-05'),

('DDC-014', 'doggy-daycare', 'city-of-sunridge',
 'Facility Capacity Check',
 'The selected day care facility must have at least one available enrollment slot. Applications to facilities at maximum capacity are flagged for waitlist placement or alternate facility selection.',
 'Sunridge Municipal Code § 12.5.3',
 'Local', 'FILTER', 'REVIEW', 'P3', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-01-20 11:30:00-05'),

('DDC-015', 'doggy-daycare', 'city-of-sunridge',
 'Income Documentation Expiry',
 'Income verification documents must not be older than 90 days per Federal grant documentation standards. Documents older than 90 days trigger a request for updated income proof before the application can proceed.',
 'Federal Grant Documentation Standards § 4.1.2',
 'Federal', 'FILTER', 'REVIEW', 'P2', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-01-20 11:45:00-05');

-- CALC rules — compute derived values used by downstream rules

INSERT INTO rules
  (rule_id, program_id, tenant_id, name, description, citation,
   jurisdiction, rule_type, phase, priority, status, version,
   effective_date, sunset_date, classification, created_by, updated_at)
VALUES

('DDC-010', 'doggy-daycare', 'city-of-sunridge',
 'Household Size Income Adjustment',
 'Adjusts the income eligibility threshold (used by DDC-004) based on household size. Larger households receive a higher income limit to reflect greater financial need: 1–2 persons → $42,000; 3–4 persons → $52,000; 5+ persons → $62,000.',
 'Sunridge Municipal Code § 12.6.2',
 'Local', 'CALC', 'BENEFIT_CALCULATION', 'P2', 'active', '1.1',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-02-15 13:00:00-05'),

('DDC-011', 'doggy-daycare', 'city-of-sunridge',
 'Base Grant Amount Calculation',
 'Calculates the monthly grant amount based on household income tier. Tier 1 (income ≤ $30,000): $200/month. Tier 2 (income ≤ $42,000): $150/month. Tier 3 (income ≤ $52,000): $100/month. This base amount feeds DDC-012 (multi-dog discount), DDC-016 (emergency supplement), and DDC-013 (annual cap check).',
 'Sunridge Municipal Code § 12.10.1',
 'Local', 'CALC', 'BENEFIT_CALCULATION', 'P2', 'active', '1.3',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-03-12 10:00:00-05'),

('DDC-012', 'doggy-daycare', 'city-of-sunridge',
 'Multi-Dog Discount',
 'If a household has exactly 2 dogs, the second dog receives a discounted grant of 75% of the base monthly grant (from DDC-011). The first dog always receives the full base amount. Triggered by DDC-009 dog count check.',
 'Sunridge Municipal Code § 12.8.2',
 'Local', 'CALC', 'BENEFIT_CALCULATION', 'P3', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-20 12:00:00-05'),

('DDC-016', 'doggy-daycare', 'city-of-sunridge',
 'Emergency Supplement',
 'Single-parent households receive an additional $50/month supplement added to the base grant amount from DDC-011. This supplement is included in the annual cap calculation in DDC-013.',
 'Sunridge Municipal Code § 12.11.1',
 'Local', 'CALC', 'BENEFIT_CALCULATION', 'P3', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-12-01 09:00:00-05'),

('DDC-017', 'doggy-daycare', 'city-of-sunridge',
 'Veteran Preference Bonus',
 'Applicants with verified veteran status receive an additional $25/month bonus per the Federal Veteran Pet Welfare Act. This bonus is applied on top of the base grant and any household supplement from DDC-016.',
 'Federal Veteran Pet Welfare Act § 2.4',
 'Federal', 'CALC', 'BENEFIT_CALCULATION', 'P3', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-08-01 11:00:00-05');

-- ROUTE rules — determine processing path

INSERT INTO rules
  (rule_id, program_id, tenant_id, name, description, citation,
   jurisdiction, rule_type, phase, priority, status, version,
   effective_date, sunset_date, classification, created_by, updated_at)
VALUES

('DDC-018', 'doggy-daycare', 'city-of-sunridge',
 'Priority Processing Route',
 'Applications from verified veterans or single-parent households are routed to the priority queue for expedited review and payment processing. Priority queue targets a 5-business-day turnaround. Mutually exclusive with DDC-019 manual review.',
 'Sunridge Municipal Code § 12.12.1',
 'Local', 'ROUTE', 'ROUTING', 'P2', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-11-15 10:00:00-05'),

('DDC-019', 'doggy-daycare', 'city-of-sunridge',
 'Manual Review Route',
 'Applications with more than 2 dogs or a breed not on the approved safety list are routed to the manual review queue. A grant coordinator reviews supporting documentation and may approve with conditions or deny. Triggered by DDC-009 or DDC-002 failures.',
 'Sunridge Municipal Code § 12.12.2',
 'Local', 'ROUTE', 'ROUTING', 'P2', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-401', '2025-01-25 09:15:00-05'),

('DDC-020', 'doggy-daycare', 'city-of-sunridge',
 'Renewal Fast Track',
 'Returning applicants with at least 1 prior approved grant and a gap of 6–24 months since the last grant are routed to the renewal fast-track path, bypassing standard income re-verification steps. Requires DDC-008 cooling period check to pass first.',
 'Sunridge Municipal Code § 12.12.3',
 'Local', 'ROUTE', 'ROUTING', 'P3', 'active', '1.0',
 '2025-01-01', NULL, 'standard', 'user-402', '2025-10-05 09:00:00-05');

-- ── RULE CONDITIONS ─────────────────────────────────────────
-- Conditions for all 20 rules. "order" is 1-indexed per rule.

INSERT INTO rule_conditions (rule_id, "order", field, operator, value, value_type) VALUES

-- DDC-001: Dog Age Eligibility
('DDC-001', 1, 'dog_age_weeks', '>=', '8',  'integer'),
('DDC-001', 2, 'dog_age_years', '<=', '10', 'integer'),

-- DDC-002: Breed Safety Classification
('DDC-002', 1, 'breed', 'IN',
 'Labrador,Golden Retriever,Poodle,Beagle,Bulldog,Dachshund,Shih Tzu,Boxer,Siberian Husky,Border Collie,Mixed Breed',
 'list'),

-- DDC-003: Facility License Verification
('DDC-003', 1, 'facility_license_status', '==', 'active', 'string'),

-- DDC-004: Owner Income Eligibility
-- Note: threshold is set by DDC-010; 52000 is the default for 3–4 person household
('DDC-004', 1, 'household_annual_income', '<=', '52000', 'integer'),

-- DDC-005: Vaccination Currency
('DDC-005', 1, 'days_since_vaccination', '<=', '365', 'integer'),

-- DDC-006: Application Completeness
('DDC-006', 1, 'application_complete', '==', 'true', 'boolean'),

-- DDC-007: Geographic Eligibility
('DDC-007', 1, 'county', 'IN', 'Sunridge,Maplewood,Crestview', 'list'),

-- DDC-008: Prior Grant Cooling Period
('DDC-008', 1, 'months_since_last_grant', '>=', '6', 'integer'),

-- DDC-009: Max Dogs Per Household
('DDC-009', 1, 'dog_count', '<=', '2', 'integer'),

-- DDC-010: Household Size Income Adjustment (3 threshold tiers, evaluated top-down)
('DDC-010', 1, 'household_size', '>=', '1', 'integer'),
('DDC-010', 2, 'household_size', '>=', '3', 'integer'),
('DDC-010', 3, 'household_size', '>=', '5', 'integer'),

-- DDC-011: Base Grant Amount Calculation (3 income tiers, evaluated top-down)
('DDC-011', 1, 'household_annual_income', '<=', '30000', 'integer'),
('DDC-011', 2, 'household_annual_income', '<=', '42000', 'integer'),
('DDC-011', 3, 'household_annual_income', '<=', '52000', 'integer'),

-- DDC-012: Multi-Dog Discount
('DDC-012', 1, 'dog_count', '==', '2', 'integer'),

-- DDC-013: Annual Benefit Cap
('DDC-013', 1, 'total_annual_benefit', '<=', '2400', 'integer'),

-- DDC-014: Facility Capacity Check
('DDC-014', 1, 'facility_slots_remaining', '>=', '1', 'integer'),

-- DDC-015: Income Documentation Expiry
('DDC-015', 1, 'income_doc_age_days', '<=', '90', 'integer'),

-- DDC-016: Emergency Supplement
('DDC-016', 1, 'household_type', '==', 'single_parent', 'string'),

-- DDC-017: Veteran Preference Bonus
('DDC-017', 1, 'applicant_veteran_status', '==', 'true', 'boolean'),

-- DDC-018: Priority Processing Route (OR logic — either condition triggers route)
('DDC-018', 1, 'applicant_veteran_status', '==', 'true',          'boolean'),
('DDC-018', 2, 'household_type',           '==', 'single_parent', 'string'),

-- DDC-019: Manual Review Route (OR logic — either condition triggers route)
('DDC-019', 1, 'dog_count', '>', '2', 'integer'),
('DDC-019', 2, 'breed', 'NOT_IN',
 'Labrador,Golden Retriever,Poodle,Beagle,Bulldog,Dachshund,Shih Tzu,Boxer,Siberian Husky,Border Collie,Mixed Breed',
 'list'),

-- DDC-020: Renewal Fast Track (all 3 conditions must be met)
('DDC-020', 1, 'prior_grant_count',       '>=', '1',  'integer'),
('DDC-020', 2, 'months_since_last_grant', '>=', '6',  'integer'),
('DDC-020', 3, 'months_since_last_grant', '<=', '24', 'integer');

-- ── RULE DEPENDENCIES ───────────────────────────────────────
-- Cascading dependency chain. rule_id → dependency_type → depends_on.
-- "impacts":  rule_id's output is consumed by depends_on
-- "requires": rule_id cannot run before depends_on completes
-- "related":  rules are mutually exclusive / semantically linked

INSERT INTO rule_dependencies (rule_id, depends_on, dependency_type, description) VALUES

-- Income threshold chain
('DDC-010', 'DDC-004', 'impacts',
 'DDC-010 calculates the income_threshold value that DDC-004 uses to evaluate household income eligibility'),

('DDC-004', 'DDC-011', 'impacts',
 'DDC-004 income eligibility gate must pass before DDC-011 grant calculation can execute'),

-- Base grant feeds downstream CALC and FILTER rules
('DDC-011', 'DDC-012', 'impacts',
 'DDC-011 base monthly grant amount feeds the second-dog discount calculation in DDC-012'),

('DDC-011', 'DDC-016', 'impacts',
 'DDC-011 base monthly grant amount is the addend to which DDC-016 emergency supplement is applied'),

('DDC-011', 'DDC-013', 'impacts',
 'DDC-011 base monthly grant amount is summed against other benefit components checked by the DDC-013 annual cap'),

-- Secondary CALC outputs also feed annual cap
('DDC-012', 'DDC-013', 'impacts',
 'DDC-012 second-dog discounted grant is added to the benefit total checked by DDC-013 annual cap'),

('DDC-016', 'DDC-013', 'impacts',
 'DDC-016 emergency supplement is added to the benefit total checked by DDC-013 annual cap'),

-- Dog count triggers discount and manual review
('DDC-009', 'DDC-012', 'impacts',
 'DDC-009 dog count flag determines whether the multi-dog discount in DDC-012 applies'),

('DDC-009', 'DDC-019', 'impacts',
 'DDC-009 dog count > 2 flag triggers routing to the DDC-019 manual review queue'),

-- Breed failure also triggers manual review
('DDC-002', 'DDC-019', 'impacts',
 'DDC-002 breed safety failure (NOT_IN approved list) triggers routing to the DDC-019 manual review queue'),

-- Cooling period is a prerequisite for renewal fast track
('DDC-008', 'DDC-020', 'requires',
 'DDC-008 cooling period check must pass before an application can be routed to DDC-020 renewal fast track'),

-- Priority and manual review routes are mutually exclusive
('DDC-018', 'DDC-019', 'related',
 'DDC-018 priority queue and DDC-019 manual review are mutually exclusive routes; an application cannot be in both');

-- ── AUDIT LOG ───────────────────────────────────────────────
-- 18 entries spanning 2025-01-01 to 2025-12-01.
-- Key policy expansion entries:
--   DDC-011 Tier 1 threshold: 25000 → 28000 → 30000 (March 2025)
--   DDC-004 income threshold: 48000 → 52000 (June 2025)
--   DDC-013 annual cap: 2000 → 2400 (September 2025)

INSERT INTO audit_log
  (tenant_id, timestamp, user_id, role, action, target_type, target_id, detail, ip_address)
VALUES

-- Program and initial rule creation
('city-of-sunridge', '2025-01-10 09:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_created', 'rule', 'DDC-001,DDC-002,DDC-003,DDC-004,DDC-005,DDC-006,DDC-007,DDC-008',
 'Initial batch creation of 8 GATE eligibility rules for Paws & Progress DDC program',
 '192.168.10.45'),

('city-of-sunridge', '2025-01-20 10:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_created', 'rule', 'DDC-009,DDC-010,DDC-011,DDC-012,DDC-013,DDC-014,DDC-015',
 'Batch creation of FILTER and CALC rules including benefit calculation chain',
 '192.168.10.45'),

('city-of-sunridge', '2025-01-25 09:30:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_created', 'rule', 'DDC-016,DDC-017,DDC-018,DDC-019,DDC-020',
 'Batch creation of supplement CALC rules and all ROUTE rules; dependency chain verified',
 '192.168.10.62'),

('city-of-sunridge', '2025-01-30 11:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_activated', 'program', 'doggy-daycare',
 'Paws & Progress Doggy Day Care Grant Program activated; all 20 rules set to active status',
 '192.168.10.45'),

-- February: income threshold tier adjustment
('city-of-sunridge', '2025-02-15 13:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-010',
 'Added household size 5+ tier at $62,000; previously only 2 tiers existed; version bumped to 1.1',
 '192.168.10.62'),

-- March: DDC-011 Tier 1 income threshold expansion (3 condition_changed entries)
('city-of-sunridge', '2025-03-05 10:30:00-05', 'user-401', 'Grant Coordinator',
 'condition_changed', 'rule', 'DDC-011',
 'Condition 1 value changed: 25000 → 28000 | Tier 1 income threshold raised; grant amount $200/month now applies to broader low-income range following Q1 cost-of-living review',
 '192.168.10.45'),

('city-of-sunridge', '2025-03-12 09:00:00-05', 'user-401', 'Grant Coordinator',
 'condition_changed', 'rule', 'DDC-011',
 'Condition 1 value changed: 28000 → 30000 | Tier 1 income threshold final adjustment; aligns with updated federal poverty guideline at 150% FPL for household of 1',
 '192.168.10.45'),

('city-of-sunridge', '2025-03-12 09:45:00-05', 'user-401', 'Grant Coordinator',
 'condition_changed', 'rule', 'DDC-011',
 'Condition 2 value changed: 40000 → 42000 | Tier 2 income threshold raised to maintain proportional spacing between tiers; Tier 2 grant $150/month now applies up to $42,000',
 '192.168.10.45'),

-- April: process documentation update
('city-of-sunridge', '2025-04-01 14:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-009',
 'Multi-dog review workflow documentation updated; supervisor approval path clarified in description; no condition changes',
 '192.168.10.62'),

-- May: vaccination citation update
('city-of-sunridge', '2025-05-10 10:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-005',
 'Citation updated to reflect 2025 Federal Pet Health Standards Act amendment; 365-day vaccination window unchanged',
 '192.168.10.62'),

-- June: DDC-004 income threshold raised (2-step expansion)
('city-of-sunridge', '2025-06-05 09:00:00-05', 'user-401', 'Grant Coordinator',
 'condition_changed', 'rule', 'DDC-004',
 'Condition 1 value changed: 48000 → 52000 | Income eligibility threshold raised to match DDC-010 default tier for 3-4 person households; effective immediately per council resolution CR-2025-44',
 '192.168.10.45'),

('city-of-sunridge', '2025-06-15 11:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_activated', 'rule', 'DDC-004',
 'DDC-004 version bumped to 1.1 after income threshold update; rule re-activated; downstream rules DDC-011 and DDC-013 reviewed — no cascading condition changes required',
 '192.168.10.45'),

-- July: geographic eligibility review
('city-of-sunridge', '2025-07-15 14:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-007',
 'Geographic eligibility county list verified against current municipal funding agreement; Crestview county confirmed; no condition changes needed',
 '192.168.10.62'),

-- August: veteran bonus documentation
('city-of-sunridge', '2025-08-01 11:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-017',
 'Veteran bonus citation updated to Federal Veteran Pet Welfare Act § 2.4 following federal register publication; $25/month bonus amount unchanged',
 '192.168.10.62'),

-- September: annual benefit cap raised
('city-of-sunridge', '2025-09-10 14:00:00-05', 'user-401', 'Grant Coordinator',
 'condition_changed', 'rule', 'DDC-013',
 'Condition 1 value changed: 2000 → 2400 | Annual benefit cap raised per council resolution CR-2025-71; supports households receiving multi-dog discount plus emergency supplement simultaneously',
 '192.168.10.45'),

-- October: renewal fast track activation
('city-of-sunridge', '2025-10-05 09:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_activated', 'rule', 'DDC-020',
 'Renewal Fast Track route confirmed active after 6-month review period; 47 renewal applications processed under fast track since January',
 '192.168.10.45'),

-- November: priority queue SLA update
('city-of-sunridge', '2025-11-15 10:00:00-05', 'user-401', 'Grant Coordinator',
 'rule_updated', 'rule', 'DDC-018',
 'Priority queue turnaround target updated to 5 business days in rule description; routing logic unchanged; aligns with updated service level agreement with city council',
 '192.168.10.45'),

-- December: emergency supplement annual review
('city-of-sunridge', '2025-12-01 09:00:00-05', 'user-402', 'Senior Policy Analyst',
 'rule_updated', 'rule', 'DDC-016',
 'Annual review complete: emergency supplement confirmed at $50/month for single-parent households; no change for 2026; note: council discussion open on raising to $75/month',
 '192.168.10.62');

-- ── NOTIFICATIONS ────────────────────────────────────────────
INSERT INTO notifications (tenant_id, user_id, title, read, created_at) VALUES
('city-of-sunridge', 'user-401',
 'DDC-011 grant tiers updated — review downstream rules DDC-012, DDC-016, DDC-013 for impact',
 false, '2025-03-12 10:00:00-05'),

('city-of-sunridge', 'user-401',
 'Annual benefit cap (DDC-013) increased to $2,400 — verify per-household totals',
 false, '2025-09-10 14:00:00-05'),

('city-of-sunridge', 'user-402',
 'Income threshold update (DDC-004) approved — effective per CR-2025-44',
 true, '2025-06-15 11:00:00-05'),

('city-of-sunridge', 'user-401',
 'Renewal Fast Track (DDC-020) activation confirmed — 47 renewals processed successfully',
 true, '2025-10-05 09:00:00-05');

-- ============================================================
-- DONE. 20 rules, 28 conditions, 12 dependencies, 18 audit entries.
-- Cascading dependency chain: DDC-010 → DDC-004 → DDC-011 → DDC-012/016/013
-- Apply via Supabase MCP then update program-switcher.js.
-- ============================================================
