-- =============================================================================
-- Migration 20: DDC Grant Application History
-- 1,000 historical applications (24 months) + 100 pending needs-review records
-- Provides test data for the scenario sandbox and AI simulator demos.
-- Run directly in the Supabase SQL Editor.
-- =============================================================================


-- =============================================================================
-- 1. TABLE + INDEXES
-- =============================================================================
CREATE TABLE IF NOT EXISTS grant_applications (
  app_id                   TEXT PRIMARY KEY,
  program_id               TEXT NOT NULL,
  tenant_id                TEXT NOT NULL,
  applicant_name           TEXT NOT NULL,
  county                   TEXT NOT NULL,
  household_size           INTEGER NOT NULL,
  household_income         NUMERIC(10,2) NOT NULL,
  household_type           TEXT NOT NULL,
  veteran_status           BOOLEAN NOT NULL DEFAULT false,
  dog_count                INTEGER NOT NULL,
  dog_breed                TEXT NOT NULL,
  dog_age_years            NUMERIC(4,1) NOT NULL,
  days_since_vaccination   INTEGER NOT NULL,
  facility_name            TEXT NOT NULL,
  facility_license_status  TEXT NOT NULL,
  facility_slots_remaining INTEGER NOT NULL,
  first_time_applicant     BOOLEAN NOT NULL DEFAULT true,
  months_since_last_grant  INTEGER NOT NULL DEFAULT 0,
  total_annual_benefit_ytd NUMERIC(10,2) NOT NULL DEFAULT 0,
  income_doc_age_days      INTEGER NOT NULL,
  decision                 TEXT NOT NULL,
  decision_reason          TEXT,
  monthly_benefit          NUMERIC(8,2),
  annual_benefit           NUMERIC(10,2),
  review_flags             TEXT[],
  review_notes             TEXT,
  submitted_at             TIMESTAMPTZ NOT NULL,
  decided_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ga_decision    CHECK (decision IN ('approved','approved_with_conditions','blocked','pending')),
  CONSTRAINT chk_ga_hh_type     CHECK (household_type IN ('standard','single_parent')),
  CONSTRAINT chk_ga_lic_status  CHECK (facility_license_status IN ('active','suspended','expired'))
);

CREATE INDEX IF NOT EXISTS idx_grantapps_program   ON grant_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_grantapps_decision  ON grant_applications(decision);
CREATE INDEX IF NOT EXISTS idx_grantapps_submitted ON grant_applications(submitted_at);
CREATE INDEX IF NOT EXISTS idx_grantapps_county    ON grant_applications(county);
CREATE INDEX IF NOT EXISTS idx_grantapps_tenant    ON grant_applications(tenant_id);


-- =============================================================================
-- 2. 1,000 HISTORICAL RECORDS — spread over the last 24 months
--
-- Distributions:
--   County:          45% Sunridge · 30% Maplewood · 15% Crestview · 10% Riverside (ineligible)
--   Income:          25% Tier 1 (≤$30K) · 30% Tier 2 ($30-42K) · 25% Tier 3 ($42-52K)
--                    10% over limit ($52-65K) · 10% well over ($65K+)
--   Household size:  15% 1p · 30% 2p · 30% 3p · 15% 4p · 10% 5p
--   Household type:  75% standard · 25% single_parent
--   Veteran:         10%
--   Dog count:       70% single · 30% two dogs
--   Breed:           88% approved · 12% restricted (blocks)
--   Dog age:         2% too young · 93% valid · 5% over 10yr (blocks)
--   Vaccination:     80% ≤200d · 10% 200-365d · 10% >365d (blocks)
--   Facility status: 85% active · 10% suspended · 5% expired (blocks)
--   Facility slots:  80% ≥3 · 10% 1-2 · 10% zero (flags)
--   First-time:      60% yes
--   Cooling period:  returning apps: 78% ≥6mo clear · 22% <6mo (blocks)
--   Income doc age:  70% <60d · 20% 60-89d · 10% ≥91d (flags)
--
-- Deterministic pseudo-random via abs(hashtext(row||seed)) % range
-- =============================================================================
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason,
  monthly_benefit, annual_benefit, review_flags, review_notes,
  submitted_at, decided_at)
WITH
-- ── Raw pseudo-random integers per row ───────────────────────────────────────
raw AS (
  SELECT i,
    abs(hashtext(i::text||'A'))%1000 AS rA,  -- county selector
    abs(hashtext(i::text||'B'))%1000 AS rB,  -- income band
    abs(hashtext(i::text||'C'))%100  AS rC,  -- household size
    abs(hashtext(i::text||'D'))%100  AS rD,  -- household type
    abs(hashtext(i::text||'E'))%100  AS rE,  -- veteran
    abs(hashtext(i::text||'F'))%100  AS rF,  -- dog count
    abs(hashtext(i::text||'G'))%100  AS rG,  -- breed
    abs(hashtext(i::text||'H'))%100  AS rH,  -- dog age band
    abs(hashtext(i::text||'I'))%100  AS rI,  -- dog age fine
    abs(hashtext(i::text||'J'))%100  AS rJ,  -- vaccination band
    abs(hashtext(i::text||'K'))%180  AS rK,  -- vaccination fine
    abs(hashtext(i::text||'L'))%100  AS rL,  -- facility license
    abs(hashtext(i::text||'M'))%100  AS rM,  -- facility slots band
    abs(hashtext(i::text||'N'))%8    AS rN,  -- facility slots fine
    abs(hashtext(i::text||'O'))%100  AS rO,  -- first_time
    abs(hashtext(i::text||'P'))%18   AS rP,  -- months since grant
    abs(hashtext(i::text||'Q'))%100  AS rQ,  -- doc age band
    abs(hashtext(i::text||'R'))%40   AS rR,  -- doc age fine
    abs(hashtext(i::text||'S'))%40   AS rS,  -- first name
    abs(hashtext(i::text||'T'))%40   AS rT,  -- last name
    abs(hashtext(i::text||'U'))%5    AS rU,  -- facility name
    abs(hashtext(i::text||'V'))%720  AS rV,  -- days ago submitted (0-719)
    abs(hashtext(i::text||'W'))%12   AS rW,  -- income fine within band
    abs(hashtext(i::text||'Z'))%6    AS rZ   -- decision delay days (1-6)
  FROM generate_series(1, 1000) i
),
-- ── Derive primary application fields ────────────────────────────────────────
f AS (
  SELECT r.*,
    CASE WHEN rA<450 THEN 'Sunridge' WHEN rA<750 THEN 'Maplewood'
         WHEN rA<900 THEN 'Crestview' ELSE 'Riverside' END AS county,
    CASE WHEN rC<15 THEN 1 WHEN rC<45 THEN 2 WHEN rC<75 THEN 3
         WHEN rC<90 THEN 4 ELSE 5 END AS hh_size,
    CASE WHEN rB<250 THEN (15000 + rW*1250)::NUMERIC
         WHEN rB<500 THEN (30001 + rW*1000)::NUMERIC
         WHEN rB<750 THEN (42001 + rW*834)::NUMERIC
         WHEN rB<900 THEN (52001 + rW*1083)::NUMERIC
         ELSE             (65001 + rW*2916)::NUMERIC END AS hh_income,
    CASE WHEN rD<25 THEN 'single_parent' ELSE 'standard' END AS hh_type,
    (rE < 10) AS vet,
    CASE WHEN rF<70 THEN 1 ELSE 2 END AS dogs,
    CASE WHEN rG<88
         THEN (ARRAY['Labrador','Golden Retriever','Poodle','Beagle','Bulldog',
                     'Dachshund','Shih Tzu','Boxer','Siberian Husky',
                     'Border Collie','Mixed Breed'])[1+(rG%11)]
         ELSE (ARRAY['German Shepherd','Rottweiler','Pit Bull','Doberman'])[1+(rG%4)]
    END AS breed,
    CASE WHEN rH<2  THEN 0.1
         WHEN rH<95 THEN (0.5 + (rI::NUMERIC/10.0))
         ELSE            (11.0 + (rI::NUMERIC/50.0)) END AS dog_age,
    CASE WHEN rJ<80 THEN rK
         WHEN rJ<90 THEN 200 + rK
         ELSE            366 + rK END AS vax_days,
    CASE WHEN rL<85 THEN 'active' WHEN rL<95 THEN 'suspended'
         ELSE 'expired' END AS lic_status,
    CASE WHEN rM<80 THEN 3+rN WHEN rM<90 THEN 1+(rN%2) ELSE 0 END AS slots,
    (rO < 60) AS first_time,
    CASE WHEN rO<60 THEN 0 WHEN rP<14 THEN rP+6 ELSE rP%6 END AS mo_since,
    CASE WHEN rQ<70 THEN rR WHEN rQ<90 THEN 60+(rR%29) ELSE 91+(rR%39) END AS doc_age,
    (NOW() - (rV||' days')::INTERVAL) AS submitted_ts
  FROM raw
),
-- ── Income adjustment and eligibility gates ───────────────────────────────────
g AS (
  SELECT f.*,
    CASE WHEN hh_size>=5 THEN 0.80 WHEN hh_size>=3 THEN 0.90 ELSE 1.0 END AS adj,
    county IN ('Sunridge','Maplewood','Crestview') AS county_ok,
    breed  IN ('Labrador','Golden Retriever','Poodle','Beagle','Bulldog',
               'Dachshund','Shih Tzu','Boxer','Siberian Husky',
               'Border Collie','Mixed Breed') AS breed_ok,
    (dog_age >= 0.15 AND dog_age <= 10) AS age_ok,
    (vax_days <= 365) AS vax_ok,
    (lic_status = 'active') AS lic_ok,
    (first_time OR mo_since >= 6) AS cool_ok
  FROM f
),
-- ── Benefit calculation ───────────────────────────────────────────────────────
c AS (
  SELECT g.*,
    (hh_income * adj)::NUMERIC(10,2) AS adj_income,
    CASE WHEN (hh_income*adj)<=30000 THEN 200
         WHEN (hh_income*adj)<=42000 THEN 150
         WHEN (hh_income*adj)<=52000 THEN 100 ELSE 0 END AS base_mo,
    CASE WHEN dogs=2        THEN 50 ELSE 0 END AS sup_dogs,
    CASE WHEN hh_type='single_parent' THEN 30 ELSE 0 END AS sup_emrg,
    CASE WHEN vet           THEN 25 ELSE 0 END AS sup_vet
  FROM g
),
-- ── Final totals and decision ─────────────────────────────────────────────────
d AS (
  SELECT c.*,
    (base_mo + sup_dogs + sup_emrg + sup_vet)      AS mo_total,
    (base_mo + sup_dogs + sup_emrg + sup_vet) * 12 AS yr_total,
    CASE
      WHEN NOT county_ok OR NOT breed_ok OR NOT age_ok OR NOT vax_ok
        OR NOT lic_ok OR NOT cool_ok OR (hh_income*adj)>52000 THEN 'blocked'
      WHEN (base_mo+sup_dogs+sup_emrg+sup_vet)*12>2400
        OR  doc_age>90
        OR  slots<1                                            THEN 'approved_with_conditions'
      ELSE 'approved'
    END AS dec
  FROM c
),
-- ── Names ─────────────────────────────────────────────────────────────────────
nm AS (
  SELECT i,
    (ARRAY['Maria','James','Linda','Robert','Jennifer','Michael','Lisa','David',
           'Patricia','William','Barbara','Richard','Susan','Joseph','Jessica',
           'Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel',
           'Margaret','Matthew','Betty','Anthony','Sandra','Mark','Dorothy',
           'Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna',
           'Kenneth','Michelle','Joshua','Brenda'])[1+(rS%40)] AS fn,
    (ARRAY['Santos','Park','Williams','Johnson','Brown','Jones','Garcia','Miller',
           'Davis','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White',
           'Harris','Martin','Thompson','Young','Lee','Walker','Hall','Allen',
           'Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell',
           'Perez','Roberts','Turner','Phillips','Campbell','Evans','Edwards','Collins'])[1+(rT%40)] AS ln
  FROM d
),
-- ── Facility names by county ──────────────────────────────────────────────────
fac AS (
  SELECT d.i, d.county, d.rU,
    CASE d.county
      WHEN 'Sunridge'  THEN (ARRAY['Sunridge Paws Day Care','Sunridge Pet Resort',
                                   'Happy Tails Sunridge','Sunridge Canine Club',
                                   'Paws & Play Sunridge'])[1+(d.rU%5)]
      WHEN 'Maplewood' THEN (ARRAY['Maplewood Pet Resort','Maplewood Doggy Day',
                                   'Happy Dogs Maplewood','Maplewood K9 Club',
                                   'Maplewood Paw House'])[1+(d.rU%5)]
      WHEN 'Crestview' THEN (ARRAY['Crestview Canine Club','Crestview Pet Care',
                                   'Happy Paws Crestview','Crestview Dog Lodge',
                                   'Crestview Doggy Day'])[1+(d.rU%5)]
      ELSE             (ARRAY['Riverside Kennels','Riverside Pet Services',
                               'Riverside Dog Care','Riverside Paw House',
                               'Riverside K9 Resort'])[1+(d.rU%5)]
    END AS fac_name
  FROM d
)
SELECT
  'DDC-APP-'||LPAD(d.i::text,6,'0'),
  'doggy-daycare',
  'city-of-sunridge',
  nm.fn||' '||nm.ln,
  d.county,
  d.hh_size,
  d.hh_income,
  d.hh_type,
  d.vet,
  d.dogs,
  d.breed,
  d.dog_age,
  d.vax_days,
  fac.fac_name,
  d.lic_status,
  d.slots,
  d.first_time,
  d.mo_since,
  CASE WHEN NOT d.first_time THEN ROUND(LEAST(d.yr_total * 0.9, 1800), 2) ELSE 0 END,
  d.doc_age,
  d.dec,
  -- decision_reason
  CASE d.dec
    WHEN 'blocked' THEN
      CASE
        WHEN NOT d.county_ok THEN 'County "'||d.county||'" is not in the eligible service area (Sunridge, Maplewood, Crestview)'
        WHEN NOT d.breed_ok  THEN 'Breed "'||d.breed||'" is on the federal restricted breed list (Federal Pet Day Care Safety Act § 3.2(b))'
        WHEN NOT d.age_ok    THEN 'Dog age '||d.dog_age||' yrs is outside eligible range (8 weeks – 10 years)'
        WHEN NOT d.vax_ok    THEN 'Vaccination records are '||d.vax_days||' days old — 365-day maximum exceeded'
        WHEN NOT d.lic_ok    THEN 'Facility license is '||d.lic_status||' — an active municipal license is required'
        WHEN NOT d.cool_ok   THEN 'Only '||d.mo_since||' month(s) since last grant — 6-month cooling period required (§ 12.7.2)'
        ELSE 'Adjusted household income $'||d.adj_income||' exceeds the $52,000 eligibility threshold (§ 12.6.1)'
      END
    WHEN 'approved_with_conditions' THEN
      CASE
        WHEN d.yr_total>2400 THEN 'Annual benefit $'||d.yr_total||' exceeds $2,400 cap — prorated to $200/month (DDC-013)'
        WHEN d.doc_age>90    THEN 'Income documentation is '||d.doc_age||' days old — 90-day maximum exceeded (DDC-015)'
        ELSE                      'Selected facility has 0 open slots — alternate facility required (DDC-014)'
      END
    ELSE NULL
  END,
  -- monthly_benefit (NULL if blocked)
  CASE WHEN d.dec='blocked' THEN NULL
       WHEN d.yr_total>2400 THEN 200
       ELSE d.mo_total END,
  -- annual_benefit (NULL if blocked)
  CASE WHEN d.dec='blocked' THEN NULL
       WHEN d.yr_total>2400 THEN 2400
       ELSE d.yr_total END,
  -- review_flags
  CASE WHEN d.dec='approved_with_conditions' THEN
    ARRAY_REMOVE(ARRAY[
      CASE WHEN d.yr_total>2400 THEN 'DDC-013:annual_cap_exceeded'  END,
      CASE WHEN d.doc_age>90    THEN 'DDC-015:income_doc_expired'   END,
      CASE WHEN d.slots<1       THEN 'DDC-014:no_facility_capacity' END
    ], NULL)
  END,
  NULL, -- review_notes
  d.submitted_ts,
  d.submitted_ts + ((1+d.rZ)||' days')::INTERVAL
FROM d
JOIN nm  ON nm.i  = d.i
JOIN fac ON fac.i = d.i;


-- =============================================================================
-- 3. 100 PENDING "NEEDS REVIEW" RECORDS — submitted in the last 30 days
--
-- Five categories of 20 records each, designed to exercise the AI simulator:
--
--   Cat 1 (NR-001–020): Income doc just expired (91-100 days) — courtesy window
--   Cat 2 (NR-021–040): Benefit cap exceeded — max supplement stack requiring proration
--   Cat 3 (NR-041–060): Cooling period borderline — exactly 5 months (1 short)
--   Cat 4 (NR-061–080): Facility at capacity — priority applicants need transfer assist
--   Cat 5 (NR-081–100): Multi-flag — cap exceeded AND doc expired simultaneously
-- =============================================================================

-- ── Category 1: Income documentation just expired (91–100 days) ──────────────
-- Clean Tier 1/2 applicants who just missed the 90-day doc refresh window.
-- Human review: coordinator can approve a 30-day courtesy extension (CD-01).
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason, monthly_benefit, annual_benefit,
  review_flags, review_notes, submitted_at, decided_at)
SELECT
  'DDC-APP-NR-'||LPAD(i::text,3,'0'),
  'doggy-daycare', 'city-of-sunridge',
  (ARRAY['Olivia','Ethan','Ava','Noah','Sophia','Liam','Emma','Mason',
         'Isabella','Logan','Mia','Lucas','Charlotte','Jackson','Amelia',
         'Aiden','Harper','Elijah','Evelyn','Oliver'])[i] ||' '||
  (ARRAY['Rivera','Chen','Patel','Kim','Okafor','Nguyen','Reyes','Singh',
         'Kowalski','Yamamoto','Osei','Fernandez','Nakamura','Diaz','Okonkwo',
         'Petrov','Hassan','Andersen','Kofi','Beaumont'])[i],
  (ARRAY['Sunridge','Maplewood','Sunridge','Crestview','Sunridge',
         'Maplewood','Sunridge','Crestview','Maplewood','Sunridge',
         'Sunridge','Maplewood','Crestview','Sunridge','Maplewood',
         'Sunridge','Crestview','Maplewood','Sunridge','Sunridge'])[i],
  CASE WHEN i%3=0 THEN 3 WHEN i%3=1 THEN 2 ELSE 4 END,                 -- household_size
  CASE WHEN i%2=0 THEN 24000+(i*500) ELSE 33000+(i*400) END,            -- income (Tier1/2)
  CASE WHEN i%4=0 THEN 'single_parent' ELSE 'standard' END,             -- hh_type
  (i%10=0),                                                              -- 10% veteran
  CASE WHEN i%3=0 THEN 2 ELSE 1 END,                                    -- dog_count
  (ARRAY['Labrador','Golden Retriever','Poodle','Beagle','Bulldog',
         'Dachshund','Shih Tzu','Boxer','Siberian Husky','Border Collie',
         'Mixed Breed','Labrador','Golden Retriever','Poodle','Beagle',
         'Bulldog','Dachshund','Labrador','Golden Retriever','Mixed Breed'])[i],
  2.0 + (i % 8),                                                         -- dog age 2-9yr
  30 + (i % 60),                                                         -- vax 30-89 days
  (ARRAY['Sunridge Paws Day Care','Maplewood Pet Resort','Happy Paws Crestview',
         'Sunridge Canine Club','Maplewood Doggy Day','Crestview Dog Lodge',
         'Happy Tails Sunridge','Maplewood K9 Club','Crestview Pet Care',
         'Paws & Play Sunridge','Sunridge Pet Resort','Maplewood Paw House',
         'Crestview Canine Club','Sunridge Paws Day Care','Maplewood Pet Resort',
         'Happy Paws Crestview','Sunridge Canine Club','Crestview Doggy Day',
         'Happy Tails Sunridge','Sunridge Pet Resort'])[i],
  'active',
  2 + (i % 5),                                                           -- 2-6 slots
  true,  0,  0,
  91 + (i % 10),                                                         -- doc age 91-100
  'pending',
  'Income documentation is '||(91+(i%10))||' days old — exceeds the 90-day maximum (DDC-015). Application is otherwise complete and eligible.',
  CASE WHEN (CASE WHEN i%2=0 THEN 24000+(i*500) ELSE 33000+(i*400) END) <= 30000 THEN 200 ELSE 150 END,
  CASE WHEN (CASE WHEN i%2=0 THEN 24000+(i*500) ELSE 33000+(i*400) END) <= 30000 THEN 2400 ELSE 1800 END,
  ARRAY['DDC-015:income_doc_expired'],
  'Income documentation expired '||(i%10+1)||' day(s) ago. Coordinator may approve a 30-day courtesy extension per Discretionary Policy CD-01 for first-time applicants with otherwise clean records.',
  NOW() - ((i*1.4)||' days')::INTERVAL,
  NULL
FROM generate_series(1,20) i;


-- ── Category 2: Annual benefit cap exceeded — maximum supplement stack ────────
-- Veteran + single_parent + 2 dogs at Tier 1 income = $305/month ($3,660/year).
-- Cap prorates to $200/month but applicants may qualify for hardship supplement review.
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason, monthly_benefit, annual_benefit,
  review_flags, review_notes, submitted_at, decided_at)
SELECT
  'DDC-APP-NR-'||LPAD((20+i)::text,3,'0'),
  'doggy-daycare', 'city-of-sunridge',
  (ARRAY['James','Maria','Robert','Linda','Michael','Jennifer','David','Patricia',
         'Richard','Susan','William','Barbara','Thomas','Karen','Joseph','Nancy',
         'Charles','Lisa','Christopher','Margaret'])[i] ||' '||
  (ARRAY['Veteran','Torres','Marcus','Wells','Reeves','Grant','Hayes','Burke',
         'Flynn','Pierce','Ward','Stone','Carr','Page','Wade','Cross',
         'Moss','Holt','Ford','Hunt'])[i],
  (ARRAY['Sunridge','Maplewood','Sunridge','Crestview','Sunridge',
         'Maplewood','Maplewood','Sunridge','Crestview','Sunridge',
         'Maplewood','Sunridge','Crestview','Maplewood','Sunridge',
         'Sunridge','Crestview','Maplewood','Sunridge','Maplewood'])[i],
  CASE WHEN i%3=0 THEN 2 WHEN i%3=1 THEN 3 ELSE 1 END,
  18000 + (i * 600),                                                      -- income $18.6K-$30K (Tier 1)
  'single_parent',                                                        -- all single-parent
  true,                                                                   -- all veterans
  2,                                                                      -- all 2 dogs
  'Golden Retriever',
  3.0 + (i % 7),
  15 + (i % 45),
  (ARRAY['Sunridge Paws Day Care','Maplewood Pet Resort','Happy Tails Sunridge',
         'Crestview Canine Club','Paws & Play Sunridge','Maplewood K9 Club',
         'Sunridge Pet Resort','Crestview Pet Care','Happy Dogs Maplewood',
         'Sunridge Canine Club','Maplewood Paw House','Crestview Dog Lodge',
         'Happy Paws Crestview','Sunridge Paws Day Care','Maplewood Pet Resort',
         'Sunridge Canine Club','Crestview Doggy Day','Happy Tails Sunridge',
         'Maplewood Doggy Day','Sunridge Pet Resort'])[i],
  'active',
  3 + (i % 4),
  (i % 3 = 0),                                                            -- ~33% returning
  CASE WHEN i%3=0 THEN 8+(i%6) ELSE 0 END,
  CASE WHEN i%3=0 THEN 1800 ELSE 0 END,
  20 + (i % 50),
  'pending',
  'Calculated monthly benefit $305 (Tier 1 $200 + 2-dog $50 + single-parent $30 + veteran $25) yields $3,660/year — exceeds the $2,400 annual cap (DDC-013). Prorated to $200/month pending coordinator review.',
  200,   -- capped monthly
  2400,  -- capped annual
  ARRAY['DDC-013:annual_cap_exceeded','DDC-018:priority_queue_eligible'],
  'Maximum supplement stack: veteran + single-parent + 2-dog combination. Annual cap proration applied. Coordinator should review whether Hardship Supplement (Municipal Resolution HR-2024-07) applies before finalizing at cap rate.',
  NOW() - ((i*1.3)||' days')::INTERVAL,
  NULL
FROM generate_series(1,20) i;


-- ── Category 3: Cooling period borderline — exactly 5 months since last grant ─
-- Applicants are 1 month short of the 6-month cooling period.
-- Human review: § 12.7.3 allows coordinator waiver for documented hardship.
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason, monthly_benefit, annual_benefit,
  review_flags, review_notes, submitted_at, decided_at)
SELECT
  'DDC-APP-NR-'||LPAD((40+i)::text,3,'0'),
  'doggy-daycare', 'city-of-sunridge',
  (ARRAY['Aisha','Carlos','Mei','Dmitri','Fatima','Bruno','Yuki','Kwame',
         'Priya','Diego','Nadia','Tariq','Ingrid','Kofi','Amara','Stefan',
         'Laila','Raj','Chloe','Marcus'])[i] ||' '||
  (ARRAY['Ahmed','Mendez','Zhang','Volkov','Hassan','Costa','Tanaka','Asante',
         'Sharma','Herrera','Petrova','Al-Farsi','Larsen','Mensah','Diallo',
         'Novak','Khalil','Kapoor','Moreau','Baptiste'])[i],
  (ARRAY['Sunridge','Maplewood','Sunridge','Sunridge','Crestview',
         'Maplewood','Sunridge','Crestview','Maplewood','Sunridge',
         'Sunridge','Maplewood','Crestview','Sunridge','Maplewood',
         'Sunridge','Crestview','Maplewood','Sunridge','Maplewood'])[i],
  CASE WHEN i%4=0 THEN 4 WHEN i%4=1 THEN 2 WHEN i%4=2 THEN 3 ELSE 1 END,
  22000 + (i * 900),                                                      -- $22.9K-$40K
  CASE WHEN i%3=0 THEN 'single_parent' ELSE 'standard' END,
  (i%8=0),
  CASE WHEN i%4=0 THEN 2 ELSE 1 END,
  (ARRAY['Labrador','Golden Retriever','Poodle','Beagle','Mixed Breed',
         'Bulldog','Shih Tzu','Border Collie','Dachshund','Boxer',
         'Labrador','Golden Retriever','Mixed Breed','Poodle','Beagle',
         'Bulldog','Siberian Husky','Labrador','Golden Retriever','Mixed Breed'])[i],
  1.5 + (i % 8),
  25 + (i % 80),
  (ARRAY['Sunridge Paws Day Care','Maplewood Pet Resort','Sunridge Pet Resort',
         'Happy Tails Sunridge','Maplewood K9 Club','Crestview Canine Club',
         'Paws & Play Sunridge','Maplewood Paw House','Crestview Pet Care',
         'Happy Paws Crestview','Sunridge Canine Club','Maplewood Doggy Day',
         'Crestview Dog Lodge','Sunridge Paws Day Care','Maplewood Pet Resort',
         'Happy Tails Sunridge','Crestview Doggy Day','Sunridge Pet Resort',
         'Maplewood K9 Club','Happy Dogs Maplewood'])[i],
  'active',
  2 + (i % 6),
  false,   -- all returning applicants
  5,       -- exactly 5 months — 1 short of the 6-month cooling period
  1200 + (i * 50),  -- prior benefit YTD
  30 + (i % 55),
  'pending',
  'Applicant is 1 month short of the 6-month cooling period (DDC-008). Last grant was 5 months ago. System cannot auto-approve; coordinator review required.',
  NULL, NULL,
  ARRAY['DDC-008:cooling_period_borderline'],
  'Applicant submitted 5 months after previous grant — 1 month short of the standard 6-month wait. Under § 12.7.3, coordinator may approve a hardship waiver if applicant documents a qualifying change in circumstances (job loss, medical expense, housing disruption).',
  NOW() - ((i*1.5)||' days')::INTERVAL,
  NULL
FROM generate_series(1,20) i;


-- ── Category 4: Facility at capacity — priority applicants need transfer ───────
-- Veterans and single-parent households with 0 facility slots.
-- DDC-018 qualifies them for priority queue; coordinator must find alternate facility.
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason, monthly_benefit, annual_benefit,
  review_flags, review_notes, submitted_at, decided_at)
SELECT
  'DDC-APP-NR-'||LPAD((60+i)::text,3,'0'),
  'doggy-daycare', 'city-of-sunridge',
  (ARRAY['Victor','Hannah','Leon','Rosa','Felix','Iris','Omar','Clara',
         'Rex','June','Cyrus','Pearl','Aldo','Vera','Bruno','Alma',
         'Tito','Nora','Kurt','Ida'])[i] ||' '||
  (ARRAY['Quinn','Stern','Fox','Webb','Nash','Lane','Cole','Reed',
         'Holt','Shaw','Dean','Park','Bell','Day','Rice','Long',
         'Rose','King','Ward','Hall'])[i],
  (ARRAY['Sunridge','Maplewood','Sunridge','Crestview','Sunridge',
         'Maplewood','Sunridge','Crestview','Maplewood','Sunridge',
         'Sunridge','Maplewood','Sunridge','Crestview','Maplewood',
         'Sunridge','Crestview','Sunridge','Maplewood','Sunridge'])[i],
  CASE WHEN i%3=0 THEN 3 WHEN i%3=1 THEN 2 ELSE 1 END,
  19000 + (i * 1100),
  CASE WHEN i%2=0 THEN 'single_parent' ELSE 'standard' END,              -- all get priority
  (i%2=1),                                                                -- alternating veteran
  CASE WHEN i%3=0 THEN 2 ELSE 1 END,
  (ARRAY['Labrador','Golden Retriever','Poodle','Mixed Breed','Beagle',
         'Bulldog','Shih Tzu','Boxer','Golden Retriever','Labrador',
         'Border Collie','Dachshund','Mixed Breed','Poodle','Labrador',
         'Golden Retriever','Beagle','Mixed Breed','Bulldog','Labrador'])[i],
  2.0 + (i % 7),
  20 + (i % 70),
  (ARRAY['Sunridge Paws Day Care','Maplewood Pet Resort','Happy Tails Sunridge',
         'Crestview Canine Club','Sunridge Canine Club','Maplewood K9 Club',
         'Paws & Play Sunridge','Crestview Pet Care','Maplewood Paw House',
         'Happy Paws Crestview','Sunridge Pet Resort','Maplewood Doggy Day',
         'Crestview Dog Lodge','Sunridge Paws Day Care','Happy Dogs Maplewood',
         'Happy Tails Sunridge','Crestview Doggy Day','Sunridge Canine Club',
         'Maplewood Pet Resort','Sunridge Paws Day Care'])[i],
  'active',
  0,                                                                      -- ZERO slots
  (i%4<3),
  CASE WHEN i%4>=3 THEN 7+(i%6) ELSE 0 END,
  CASE WHEN i%4>=3 THEN 900+(i*60) ELSE 0 END,
  25 + (i % 60),
  'pending',
  'Selected facility has no open enrollment slots (DDC-014). Applicant qualifies for priority processing (DDC-018) but must be placed at an alternate facility.',
  CASE WHEN (19000+(i*1100)) <= 30000 THEN 200 WHEN (19000+(i*1100)) <= 42000 THEN 150 ELSE 100 END,
  CASE WHEN (19000+(i*1100)) <= 30000 THEN 2400 WHEN (19000+(i*1100)) <= 42000 THEN 1800 ELSE 1200 END,
  ARRAY['DDC-014:no_facility_capacity','DDC-018:priority_queue_eligible'],
  'Priority applicant (veteran or single-parent household) selected a facility with no current availability. Coordinator must identify and confirm an alternate licensed facility with open slots. Target resolution: 3 business days per § 12.12.1 priority SLA.',
  NOW() - ((i*1.2)||' days')::INTERVAL,
  NULL
FROM generate_series(1,20) i;


-- ── Category 5: Multi-flag — benefit cap exceeded AND income doc expired ───────
-- Both DDC-013 and DDC-015 are triggered simultaneously.
-- Coordinator must resolve both before grant can proceed.
INSERT INTO grant_applications (
  app_id, program_id, tenant_id, applicant_name, county,
  household_size, household_income, household_type, veteran_status,
  dog_count, dog_breed, dog_age_years, days_since_vaccination,
  facility_name, facility_license_status, facility_slots_remaining,
  first_time_applicant, months_since_last_grant, total_annual_benefit_ytd,
  income_doc_age_days, decision, decision_reason, monthly_benefit, annual_benefit,
  review_flags, review_notes, submitted_at, decided_at)
SELECT
  'DDC-APP-NR-'||LPAD((80+i)::text,3,'0'),
  'doggy-daycare', 'city-of-sunridge',
  (ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Avery',
         'Quinn','Peyton','Reese','Skyler','Drew','Cameron','Blake','Kendall',
         'Hayden','Parker','Rowan','Finley'])[i] ||' '||
  (ARRAY['Cross','Storm','Vale','Knox','Pike','Chase','Gray','Blaine',
         'Ford','Stark','West','Lake','Marsh','Hyde','Frost','Bloom',
         'Crane','Drake','Hale','Vance'])[i],
  (ARRAY['Sunridge','Maplewood','Sunridge','Maplewood','Crestview',
         'Sunridge','Maplewood','Sunridge','Crestview','Maplewood',
         'Sunridge','Sunridge','Maplewood','Crestview','Sunridge',
         'Maplewood','Sunridge','Crestview','Maplewood','Sunridge'])[i],
  CASE WHEN i%3=0 THEN 2 WHEN i%3=1 THEN 3 ELSE 1 END,
  17000 + (i * 650),                                                      -- Tier 1 income
  'single_parent',                                                        -- all single-parent
  (i%5=0),                                                                -- 20% veteran
  2,                                                                      -- all 2 dogs → high benefit
  (ARRAY['Labrador','Golden Retriever','Mixed Breed','Poodle','Bulldog',
         'Labrador','Golden Retriever','Beagle','Mixed Breed','Labrador',
         'Golden Retriever','Mixed Breed','Poodle','Bulldog','Labrador',
         'Golden Retriever','Beagle','Mixed Breed','Labrador','Golden Retriever'])[i],
  2.0 + (i % 8),
  30 + (i % 60),
  (ARRAY['Sunridge Paws Day Care','Maplewood Pet Resort','Happy Tails Sunridge',
         'Maplewood K9 Club','Crestview Canine Club','Sunridge Pet Resort',
         'Maplewood Paw House','Sunridge Canine Club','Crestview Pet Care',
         'Happy Paws Crestview','Paws & Play Sunridge','Maplewood Doggy Day',
         'Crestview Dog Lodge','Happy Dogs Maplewood','Sunridge Paws Day Care',
         'Happy Tails Sunridge','Crestview Doggy Day','Maplewood Pet Resort',
         'Sunridge Canine Club','Sunridge Paws Day Care'])[i],
  'active',
  2 + (i % 5),
  (i%3=0),
  CASE WHEN i%3=0 THEN 0 ELSE 7+(i%8) END,
  CASE WHEN i%3!=0 THEN 1200+(i*40) ELSE 0 END,
  92 + (i % 20),                                                          -- doc age 92-111 days
  'pending',
  'Two simultaneous conditions require coordinator resolution: (1) calculated annual benefit $'||
    (CASE WHEN (i%5=0) THEN 3660 ELSE 3360 END)||' exceeds $2,400 cap (DDC-013); '||
    '(2) income documentation is '||(92+(i%20))||' days old (DDC-015).',
  200,   -- capped at proration
  2400,
  ARRAY['DDC-013:annual_cap_exceeded','DDC-015:income_doc_expired'],
  'Dual-flag case: benefit cap proration AND income documentation refresh both required. Coordinator must: (1) confirm cap proration decision or initiate hardship supplement review; (2) request updated income documentation from applicant before grant issuance. Do not issue until both conditions are cleared.',
  NOW() - ((i*1.1)||' days')::INTERVAL,
  NULL
FROM generate_series(1,20) i;


-- =============================================================================
-- 4. VERIFICATION QUERY — run after insert to confirm counts
-- =============================================================================
-- SELECT decision, COUNT(*) FROM grant_applications
-- WHERE program_id = 'doggy-daycare'
-- GROUP BY decision ORDER BY decision;
