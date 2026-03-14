-- =============================================================================
-- Migration 22: Seed data for all 5 non-DDC programs
--
-- 500 deterministic rows per program (2,500 total) using the same
-- abs(hashtext(i::text||'seed_X'))%range pattern as migration 20.
--
-- Decision is computed in SQL using each program's key GATE rule logic so
-- impact flip counts are meaningful when sandbox conditions are changed.
--
-- Target distributions: ~60% approved · ~30% blocked · ~10% approved_with_conditions
--
-- Run directly in the Supabase SQL Editor AFTER migration 21.
-- =============================================================================


-- =============================================================================
-- 1. HOSPITAL LICENSING (hosp-licensing / ohio-odh)
--
-- Key facts: beds, net_change, involves_ob, involves_ed, capex, type,
--            accredited, quality_score, deficiencies
--
-- Gate logic:
--   blocked              if beds < 25 OR quality_score < 75 OR deficiencies > 8
--   approved_with_cond   if type='critical_access' AND beds > 20
--                        OR capex >= 5000000 AND involves_ob
--   approved             otherwise
-- =============================================================================
INSERT INTO applications (program_id, tenant_id, data_source, key_facts, decision)
WITH raw AS (
  SELECT i,
    abs(hashtext(i::text||'hosp_A'))%100  AS rA,  -- beds band
    abs(hashtext(i::text||'hosp_B'))%40   AS rB,  -- beds fine (0-39)
    abs(hashtext(i::text||'hosp_C'))%100  AS rC,  -- net_change band
    abs(hashtext(i::text||'hosp_D'))%60   AS rD,  -- net_change fine (-30 to +29)
    abs(hashtext(i::text||'hosp_E'))%100  AS rE,  -- involves_ob
    abs(hashtext(i::text||'hosp_F'))%100  AS rF,  -- involves_ed
    abs(hashtext(i::text||'hosp_G'))%100  AS rG,  -- capex band
    abs(hashtext(i::text||'hosp_H'))%100  AS rH,  -- type
    abs(hashtext(i::text||'hosp_I'))%100  AS rI,  -- accredited
    abs(hashtext(i::text||'hosp_J'))%100  AS rJ,  -- quality_score band
    abs(hashtext(i::text||'hosp_K'))%25   AS rK,  -- quality_score fine (0-24)
    abs(hashtext(i::text||'hosp_L'))%100  AS rL   -- deficiencies band
  FROM generate_series(1, 500) i
),
f AS (
  SELECT raw.*,
    CASE WHEN rA<30 THEN 10 + rB           -- 30%: 10-49 beds (some blocked)
         WHEN rA<80 THEN 50 + rB           -- 50%: 50-89 beds (safe range)
         ELSE            90 + (rB%60)      -- 20%: 90-149 beds
    END AS beds,
    (rD - 30) AS net_change,               -- -30 to +29
    (rE < 25) AS involves_ob,
    (rF < 40) AS involves_ed,
    CASE WHEN rG<70 THEN 500000 + rG*50000    -- 70%: $500K-$4M (below CON threshold)
         WHEN rG<90 THEN 5000000 + rG*100000  -- 20%: $5M-$14M (CON required)
         ELSE            15000000 + rG*200000  -- 10%: $15M-$35M (major project)
    END AS capex,
    CASE WHEN rH<15 THEN 'critical_access' ELSE 'general_acute' END AS facility_type,
    (rI >= 10) AS accredited,              -- 90% accredited
    CASE WHEN rJ<25 THEN 60 + rK          -- 25%: 60-84 (borderline)
         WHEN rJ<85 THEN 85 + (rK%11)     -- 60%: 85-95 (good)
         ELSE            96 + (rK%5)       -- 15%: 96-100 (excellent)
    END AS quality_score,
    CASE WHEN rL<20 THEN 9 + (rL%6)       -- 20%: 9-14 deficiencies (high)
         WHEN rL<50 THEN 4 + (rL%5)       -- 30%: 4-8 (moderate)
         ELSE            rL%4              -- 50%: 0-3 (low)
    END AS deficiencies
  FROM raw
),
d AS (
  SELECT f.*,
    CASE
      WHEN beds < 25 OR quality_score < 75 OR deficiencies > 8 THEN 'blocked'
      WHEN (facility_type='critical_access' AND beds > 20)
        OR (capex >= 5000000 AND involves_ob)                  THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM f
)
SELECT
  'hosp-licensing',
  'ohio-odh',
  'seeded',
  jsonb_build_object(
    'beds',         d.beds,
    'net_change',   d.net_change,
    'involves_ob',  d.involves_ob,
    'involves_ed',  d.involves_ed,
    'capex',        d.capex,
    'type',         d.facility_type,
    'accredited',   d.accredited,
    'quality_score',d.quality_score,
    'deficiencies', d.deficiencies
  ),
  d.dec
FROM d;


-- =============================================================================
-- 2. SNAP BENEFITS (snap / ohio-odjfs)
--
-- Key facts: household_size, gross_income, net_income, assets,
--            citizenship_met, work_eligible, has_earned_income,
--            has_elderly_disabled, categorically_eligible
--
-- FPL gross income limits (130%) approximate monthly values used:
--   HH 1: $1,580  HH 2: $2,137  HH 3: $2,694  HH 4: $3,250  HH 5+: $3,807
--
-- Gate logic:
--   blocked              if NOT citizenship_met OR gross_income > fpl_limit
--   approved_with_cond   if assets > 2750 AND NOT has_elderly_disabled
--   approved             otherwise
-- =============================================================================
INSERT INTO applications (program_id, tenant_id, data_source, key_facts, decision)
WITH raw AS (
  SELECT i,
    abs(hashtext(i::text||'snap_A'))%100  AS rA,  -- household_size
    abs(hashtext(i::text||'snap_B'))%100  AS rB,  -- income band
    abs(hashtext(i::text||'snap_C'))%100  AS rC,  -- income fine offset
    abs(hashtext(i::text||'snap_D'))%100  AS rD,  -- citizenship
    abs(hashtext(i::text||'snap_E'))%100  AS rE,  -- work_eligible
    abs(hashtext(i::text||'snap_F'))%100  AS rF,  -- has_earned_income
    abs(hashtext(i::text||'snap_G'))%100  AS rG,  -- has_elderly_disabled
    abs(hashtext(i::text||'snap_H'))%100  AS rH,  -- categorically_eligible
    abs(hashtext(i::text||'snap_I'))%100  AS rI,  -- assets band
    abs(hashtext(i::text||'snap_J'))%1500 AS rJ   -- assets fine
  FROM generate_series(1, 500) i
),
f AS (
  SELECT raw.*,
    CASE WHEN rA<20 THEN 1 WHEN rA<50 THEN 2 WHEN rA<75 THEN 3
         WHEN rA<90 THEN 4 ELSE 5 END AS hh_size,
    (rD >= 5)  AS citizenship_met,   -- 95% pass
    (rE >= 15) AS work_eligible,     -- 85% eligible
    (rF >= 30) AS has_earned_income, -- 70% have earnings
    (rG < 25)  AS has_elderly_disabled, -- 25% elderly/disabled
    (rH < 20)  AS cat_eligible       -- 20% categorically eligible
  FROM raw
),
g AS (
  SELECT f.*,
    -- FPL limits by household size (130% FPL monthly, approximate 2025 values)
    CASE WHEN hh_size=1 THEN 1580 WHEN hh_size=2 THEN 2137
         WHEN hh_size=3 THEN 2694 WHEN hh_size=4 THEN 3250
         ELSE 3807 END AS fpl_limit,
    -- Gross income: 70% below limit, 30% above
    CASE WHEN rB<70
         THEN (CASE WHEN hh_size=1 THEN 800+(rC*8)
                    WHEN hh_size=2 THEN 1100+(rC*11)
                    WHEN hh_size=3 THEN 1400+(rC*13)
                    WHEN hh_size=4 THEN 1700+(rC*16)
                    ELSE 2000+(rC*19) END)
         ELSE (CASE WHEN hh_size=1 THEN 1600+(rC*20)
                    WHEN hh_size=2 THEN 2200+(rC*25)
                    WHEN hh_size=3 THEN 2800+(rC*30)
                    WHEN hh_size=4 THEN 3400+(rC*35)
                    ELSE 4000+(rC*40) END)
    END AS gross_income,
    -- Assets: 60% under $2750, 30% $2750-$5000, 10% over
    CASE WHEN rI<60 THEN (rJ%2750)
         WHEN rI<90 THEN 2750+(rJ%2250)
         ELSE            5000+(rJ%3000)
    END AS assets
  FROM f
),
d AS (
  SELECT g.*,
    -- Net income approx: gross - 20% earned income deduction - standard deduction
    GREATEST(0, ROUND(
      gross_income * (CASE WHEN has_earned_income THEN 0.8 ELSE 1.0 END)
      - (CASE WHEN hh_size<=3 THEN 198 WHEN hh_size=4 THEN 208 ELSE 238 END)
    )) AS net_income,
    CASE
      WHEN NOT citizenship_met OR gross_income > fpl_limit THEN 'blocked'
      WHEN assets > 2750 AND NOT has_elderly_disabled        THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM g
)
SELECT
  'snap',
  'ohio-odjfs',
  'seeded',
  jsonb_build_object(
    'household_size',       d.hh_size,
    'gross_income',         d.gross_income,
    'net_income',           d.net_income,
    'assets',               d.assets,
    'citizenship_met',      d.citizenship_met,
    'work_eligible',        d.work_eligible,
    'has_earned_income',    d.has_earned_income,
    'has_elderly_disabled', d.has_elderly_disabled,
    'categorically_eligible', d.cat_eligible
  ),
  d.dec
FROM d;


-- =============================================================================
-- 3. NURSING HOME LICENSING (nursing-home / ky-chfs)
--
-- Key facts: beds, rn_daily_hours, complaint_pending, cms_rating,
--            inspection_days_ago
--
-- Gate logic:
--   blocked              if beds < 25 OR rn_daily_hours < 2.5 OR cms_rating < 2
--                        OR complaint_pending
--   approved_with_cond   if cms_rating = 2 OR inspection_days_ago > 365
--   approved             otherwise
-- =============================================================================
INSERT INTO applications (program_id, tenant_id, data_source, key_facts, decision)
WITH raw AS (
  SELECT i,
    abs(hashtext(i::text||'nh_A'))%100 AS rA,  -- beds
    abs(hashtext(i::text||'nh_B'))%100 AS rB,  -- rn_daily_hours band
    abs(hashtext(i::text||'nh_C'))%100 AS rC,  -- complaint_pending
    abs(hashtext(i::text||'nh_D'))%100 AS rD,  -- cms_rating
    abs(hashtext(i::text||'nh_E'))%500 AS rE   -- inspection_days_ago
  FROM generate_series(1, 500) i
),
f AS (
  SELECT raw.*,
    CASE WHEN rA<25 THEN 15 + rA           -- 25%: 15-39 (some blocked)
         ELSE            40 + rA           -- 75%: 40-139
    END AS beds,
    CASE WHEN rB<20 THEN 1.5+(rB::numeric/20)  -- 20%: 1.5-2.49 (blocked/borderline)
         WHEN rB<70 THEN 2.5+(rB::numeric/50)  -- 50%: 2.5-3.49
         ELSE            3.5+(rB::numeric/100) -- 30%: 3.5-4.49
    END AS rn_hours,
    (rC < 10) AS complaint,       -- 10% have pending complaints
    CASE WHEN rD<15 THEN 1 WHEN rD<30 THEN 2 WHEN rD<60 THEN 3
         WHEN rD<85 THEN 4 ELSE 5 END AS cms,
    rE AS insp_days               -- 0-499 days since last inspection
  FROM raw
),
d AS (
  SELECT f.*,
    CASE
      WHEN beds < 25 OR rn_hours < 2.5 OR cms < 2 OR complaint THEN 'blocked'
      WHEN cms = 2 OR insp_days > 365                           THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM f
)
SELECT
  'nursing-home',
  'ky-chfs',
  'seeded',
  jsonb_build_object(
    'beds',              d.beds,
    'rn_daily_hours',    ROUND(d.rn_hours::numeric, 1),
    'complaint_pending', d.complaint,
    'cms_rating',        d.cms,
    'inspection_days_ago', d.insp_days
  ),
  d.dec
FROM d;


-- =============================================================================
-- 4. CONTRACTOR LICENSING (contractor-licensing / michigan-lara)
--
-- Key facts: license_type, exam_passed, insurance_amount, bond_amount,
--            years_experience
--
-- Gate logic:
--   blocked              if NOT exam_passed OR insurance_amount < 100000
--                        OR bond_amount < 25000
--   approved_with_cond   if years_experience < 2 OR insurance_amount < 300000
--   approved             otherwise
-- =============================================================================
INSERT INTO applications (program_id, tenant_id, data_source, key_facts, decision)
WITH raw AS (
  SELECT i,
    abs(hashtext(i::text||'cl_A'))%5   AS rA,  -- license_type
    abs(hashtext(i::text||'cl_B'))%100 AS rB,  -- exam_passed
    abs(hashtext(i::text||'cl_C'))%100 AS rC,  -- insurance band
    abs(hashtext(i::text||'cl_D'))%100 AS rD,  -- bond band
    abs(hashtext(i::text||'cl_E'))%100 AS rE,  -- years_experience band
    abs(hashtext(i::text||'cl_F'))%10  AS rF   -- years_experience fine
  FROM generate_series(1, 500) i
),
f AS (
  SELECT raw.*,
    (ARRAY['residential_builder','commercial_builder','electrical',
           'plumbing','hvac'])[1+(rA%5)] AS lic_type,
    (rB >= 15) AS exam_ok,          -- 85% pass exam
    CASE WHEN rC<20 THEN 50000+(rC*2500)    -- 20%: $50K-$99K (blocked)
         WHEN rC<60 THEN 100000+(rC*2000)   -- 40%: $100K-$219K (borderline)
         ELSE            300000+(rC*5000)    -- 40%: $300K-$795K (solid)
    END AS ins_amount,
    CASE WHEN rD<15 THEN 10000+(rD*1000)    -- 15%: $10K-$24K (blocked)
         WHEN rD<50 THEN 25000+(rD*500)     -- 35%: $25K-$49K (minimum)
         ELSE            50000+(rD*2000)     -- 50%: $50K-$249K (solid)
    END AS bond_amount,
    CASE WHEN rE<20 THEN rF                 -- 20%: 0-9 years
         WHEN rE<50 THEN 2+rF               -- 30%: 2-11
         ELSE            5+rF               -- 50%: 5-14
    END AS yrs_exp
  FROM raw
),
d AS (
  SELECT f.*,
    CASE
      WHEN NOT exam_ok OR ins_amount < 100000 OR bond_amount < 25000 THEN 'blocked'
      WHEN yrs_exp < 2 OR ins_amount < 300000                         THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM f
)
SELECT
  'contractor-licensing',
  'michigan-lara',
  'seeded',
  jsonb_build_object(
    'license_type',      d.lic_type,
    'exam_passed',       d.exam_ok,
    'insurance_amount',  d.ins_amount,
    'bond_amount',       d.bond_amount,
    'years_experience',  d.yrs_exp
  ),
  d.dec
FROM d;


-- =============================================================================
-- 5. CHILD CARE FACILITY LICENSING (childcare-licensing / ohio-odjfs)
--
-- Key facts: facility_type, capacity, director_age, education_met,
--            bci_completed, fbi_completed, indoor_sqft, children_per_staff
--
-- Gate logic:
--   blocked              if NOT bci_completed OR NOT fbi_completed
--                        OR NOT education_met OR director_age < 21
--   approved_with_cond   if indoor_sqft < 35 OR children_per_staff > 8
--   approved             otherwise
-- =============================================================================
INSERT INTO applications (program_id, tenant_id, data_source, key_facts, decision)
WITH raw AS (
  SELECT i,
    abs(hashtext(i::text||'cc_A'))%3   AS rA,  -- facility_type
    abs(hashtext(i::text||'cc_B'))%100 AS rB,  -- capacity band
    abs(hashtext(i::text||'cc_C'))%100 AS rC,  -- director_age band
    abs(hashtext(i::text||'cc_D'))%100 AS rD,  -- education_met
    abs(hashtext(i::text||'cc_E'))%100 AS rE,  -- bci_completed
    abs(hashtext(i::text||'cc_F'))%100 AS rF,  -- fbi_completed
    abs(hashtext(i::text||'cc_G'))%100 AS rG,  -- indoor_sqft band
    abs(hashtext(i::text||'cc_H'))%100 AS rH   -- children_per_staff band
  FROM generate_series(1, 500) i
),
f AS (
  SELECT raw.*,
    (ARRAY['center','type_a','type_b'])[1+(rA%3)] AS fac_type,
    CASE WHEN rB<30 THEN 10+(rB%20)     -- 30%: 10-29 children
         WHEN rB<70 THEN 30+(rB%40)     -- 40%: 30-69
         ELSE            70+(rB%80)      -- 30%: 70-149
    END AS capacity,
    CASE WHEN rC<10 THEN 18+(rC%3)     -- 10%: 18-20 (under 21 → blocked)
         ELSE            21+(rC%25)     -- 90%: 21-45
    END AS dir_age,
    (rD >= 10) AS edu_met,             -- 90% pass
    (rE >= 8)  AS bci_ok,             -- 92% complete BCI
    (rF >= 8)  AS fbi_ok,             -- 92% complete FBI
    CASE WHEN rG<15 THEN 25+(rG%10)    -- 15%: 25-34 sqft (blocked)
         WHEN rG<70 THEN 35+(rG%25)    -- 55%: 35-59 sqft
         ELSE            60+(rG%40)     -- 30%: 60-99 sqft
    END AS indoor_sq,
    CASE WHEN rH<20 THEN 9+(rH%6)      -- 20%: 9-14 ratio (too high)
         WHEN rH<60 THEN 6+(rH%3)      -- 40%: 6-8 ratio
         ELSE            3+(rH%4)       -- 40%: 3-6 ratio (excellent)
    END AS ratio
  FROM raw
),
d AS (
  SELECT f.*,
    CASE
      WHEN NOT bci_ok OR NOT fbi_ok OR NOT edu_met OR dir_age < 21 THEN 'blocked'
      WHEN indoor_sq < 35 OR ratio > 8                              THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM f
)
SELECT
  'childcare-licensing',
  'ohio-odjfs',
  'seeded',
  jsonb_build_object(
    'facility_type',       d.fac_type,
    'capacity',            d.capacity,
    'director_age',        d.dir_age,
    'education_met',       d.edu_met,
    'bci_completed',       d.bci_ok,
    'fbi_completed',       d.fbi_ok,
    'indoor_sqft',         d.indoor_sq,
    'children_per_staff',  d.ratio
  ),
  d.dec
FROM d;


-- =============================================================================
-- VERIFICATION — run after applying to confirm row counts
-- =============================================================================
-- SELECT program_id, decision, COUNT(*)
-- FROM applications
-- GROUP BY program_id, decision
-- ORDER BY program_id, decision;
