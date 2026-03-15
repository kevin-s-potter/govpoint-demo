-- ============================================================
-- LexiPoint Migration 10 — Application Evaluation Seed Records
-- Adds 5 application_evaluation entries to audit_log to demonstrate
-- the Audit Trail Detail View exhibit modal (PR #18).
--
-- Programs covered:
--   hosp-licensing  (ohio-odh)      — 3 records: DENIED, APPROVED, APPROVED_WITH_CONDITIONS
--   snap            (ohio-odjfs)    — 1 record:  DENIED (gross income > 130% FPL)
--   childcare-licensing (ohio-odjfs)— 1 record:  DENIED (indoor space < 35 sq ft)
--
-- Condition field names match rule_conditions.field values in the DB exactly.
-- Run via Supabase MCP (execute_sql), not directly.
-- ============================================================

INSERT INTO audit_log (audit_id, tenant_id, timestamp, user_id, role, action, target_type, target_id, detail, ip_address)
VALUES

-- ── RECORD 1: hosp-licensing — DENIED (bed count below minimum) ──
(
  'aud-eval-001',
  'ohio-odh',
  '2026-03-13 09:14:22-05',
  NULL,
  'system',
  'application_evaluation',
  'application',
  'APP-2026-001847',
  $json${
    "application_id": "APP-2026-001847",
    "applicant_name": "St. Francis Medical Center",
    "outcome": "denied",
    "deciding_condition_id": "cond-OH-001-01",
    "rules_evaluated": [
      {
        "rule_id": "OH-001",
        "rule_name": "Bed Capacity Minimum",
        "citation": "ORC § 3702.30(A)(1)",
        "rule_type": "GATE",
        "fired": true,
        "conditions": [
          {
            "condition_id": "cond-OH-001-01",
            "field": "beds",
            "operator": ">=",
            "threshold": "25",
            "actual_value": "18",
            "result": "FAIL",
            "deciding": true
          },
          {
            "condition_id": "cond-OH-001-02",
            "field": "licensed_facility",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-016",
        "rule_name": "Nursing Staffing Ratios",
        "citation": "OAC 3701-59-16",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-016-01",
            "field": "rn_ratio",
            "operator": ">=",
            "threshold": "0.5",
            "actual_value": "0.62",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-016-02",
            "field": "continuous_staffing",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-007",
        "rule_name": "Patient Safety Reporting",
        "citation": "ORC § 3727.60",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-007-01",
            "field": "incident_reporting",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-007-02",
            "field": "response_time",
            "operator": "<=",
            "threshold": "24",
            "actual_value": "18",
            "result": "PASS",
            "deciding": false
          }
        ]
      }
    ]
  }$json$,
  NULL
),

-- ── RECORD 2: hosp-licensing — APPROVED (all rules pass) ──
(
  'aud-eval-002',
  'ohio-odh',
  '2026-03-12 14:07:45-05',
  NULL,
  'system',
  'application_evaluation',
  'application',
  'APP-2026-001831',
  $json${
    "application_id": "APP-2026-001831",
    "applicant_name": "Lakewood General Hospital",
    "outcome": "approved",
    "deciding_condition_id": null,
    "rules_evaluated": [
      {
        "rule_id": "OH-001",
        "rule_name": "Bed Capacity Minimum",
        "citation": "ORC § 3702.30(A)(1)",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-001-01",
            "field": "beds",
            "operator": ">=",
            "threshold": "25",
            "actual_value": "47",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-001-02",
            "field": "licensed_facility",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-016",
        "rule_name": "Nursing Staffing Ratios",
        "citation": "OAC 3701-59-16",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-016-01",
            "field": "rn_ratio",
            "operator": ">=",
            "threshold": "0.5",
            "actual_value": "0.68",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-016-02",
            "field": "continuous_staffing",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-007",
        "rule_name": "Patient Safety Reporting",
        "citation": "ORC § 3727.60",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-007-01",
            "field": "incident_reporting",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-007-02",
            "field": "response_time",
            "operator": "<=",
            "threshold": "24",
            "actual_value": "11",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-005",
        "rule_name": "Infection Control Program",
        "citation": "OAC 3701-59-05",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-005-01",
            "field": "infection_control_committee",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-005-02",
            "field": "quarterly_audit",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      }
    ]
  }$json$,
  NULL
),

-- ── RECORD 3: hosp-licensing — APPROVED WITH CONDITIONS (quarterly audit outstanding) ──
(
  'aud-eval-003',
  'ohio-odh',
  '2026-03-10 11:33:09-05',
  NULL,
  'system',
  'application_evaluation',
  'application',
  'APP-2026-001819',
  $json${
    "application_id": "APP-2026-001819",
    "applicant_name": "Mercy Health Partners – Westside",
    "outcome": "approved_with_conditions",
    "deciding_condition_id": "cond-OH-005-02",
    "rules_evaluated": [
      {
        "rule_id": "OH-001",
        "rule_name": "Bed Capacity Minimum",
        "citation": "ORC § 3702.30(A)(1)",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-001-01",
            "field": "beds",
            "operator": ">=",
            "threshold": "25",
            "actual_value": "31",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-001-02",
            "field": "licensed_facility",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-016",
        "rule_name": "Nursing Staffing Ratios",
        "citation": "OAC 3701-59-16",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-OH-016-01",
            "field": "rn_ratio",
            "operator": ">=",
            "threshold": "0.5",
            "actual_value": "0.52",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-016-02",
            "field": "continuous_staffing",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "OH-005",
        "rule_name": "Infection Control Program",
        "citation": "OAC 3701-59-05",
        "rule_type": "GATE",
        "fired": true,
        "conditions": [
          {
            "condition_id": "cond-OH-005-01",
            "field": "infection_control_committee",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-OH-005-02",
            "field": "quarterly_audit",
            "operator": "==",
            "threshold": "true",
            "actual_value": "false",
            "result": "FAIL",
            "deciding": true
          }
        ]
      }
    ]
  }$json$,
  NULL
),

-- ── RECORD 4: snap — DENIED (gross income exceeds 130% FPL) ──
(
  'aud-eval-004',
  'ohio-odjfs',
  '2026-03-11 16:02:18-05',
  NULL,
  'system',
  'application_evaluation',
  'application',
  'APP-2026-SN-004471',
  $json${
    "application_id": "APP-2026-SN-004471",
    "applicant_name": "Franklin County Applicant #4471",
    "outcome": "denied",
    "deciding_condition_id": "cond-SNAP-FED-010-01",
    "rules_evaluated": [
      {
        "rule_id": "SNAP-FED-010",
        "rule_name": "Household Gross Income Limit - 130% FPL",
        "citation": "7 CFR §273.9(a)",
        "rule_type": "GATE",
        "fired": true,
        "conditions": [
          {
            "condition_id": "cond-SNAP-FED-010-01",
            "field": "household_gross_monthly_income",
            "operator": ">",
            "threshold": "130% FPL ($1,902/mo, household of 3)",
            "actual_value": "$2,813/mo (148% FPL)",
            "result": "FAIL",
            "deciding": true
          },
          {
            "condition_id": "cond-SNAP-FED-010-02",
            "field": "household_has_elderly_or_disabled",
            "operator": "==",
            "threshold": "false",
            "actual_value": "false",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-SNAP-FED-010-03",
            "field": "categorically_eligible",
            "operator": "==",
            "threshold": "false",
            "actual_value": "false",
            "result": "PASS",
            "deciding": false
          }
        ]
      }
    ]
  }$json$,
  NULL
),

-- ── RECORD 5: childcare-licensing — DENIED (indoor space below minimum) ──
(
  'aud-eval-005',
  'ohio-odjfs',
  '2026-03-09 10:48:33-05',
  NULL,
  'system',
  'application_evaluation',
  'application',
  'APP-2026-CC-000892',
  $json${
    "application_id": "APP-2026-CC-000892",
    "applicant_name": "Sunflower Learning Center",
    "outcome": "denied",
    "deciding_condition_id": "cond-CC-CAP-001-01",
    "rules_evaluated": [
      {
        "rule_id": "CC-CAP-001",
        "rule_name": "Indoor Space Threshold Per Child",
        "citation": "OAC §5101:2-12-11",
        "rule_type": "GATE",
        "fired": true,
        "conditions": [
          {
            "condition_id": "cond-CC-CAP-001-01",
            "field": "indoor_space_per_child",
            "operator": ">=",
            "threshold": "35",
            "actual_value": "28",
            "result": "FAIL",
            "deciding": true
          }
        ]
      },
      {
        "rule_id": "CC-CAP-002",
        "rule_name": "Staff-to-Child Ratio (Preschool 3–5 yr)",
        "citation": "OAC §5101:2-12-18",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-CC-CAP-002-01",
            "field": "children_per_staff",
            "operator": "<=",
            "threshold": "12",
            "actual_value": "9",
            "result": "PASS",
            "deciding": false
          }
        ]
      },
      {
        "rule_id": "CC-FED-001",
        "rule_name": "Health and Safety Standards Mandate",
        "citation": "45 CFR §98.41(a)",
        "rule_type": "GATE",
        "fired": false,
        "conditions": [
          {
            "condition_id": "cond-CC-FED-001-01",
            "field": "provider_receives_ccdf_funding",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          },
          {
            "condition_id": "cond-CC-FED-001-02",
            "field": "state_has_health_safety_standards",
            "operator": "==",
            "threshold": "true",
            "actual_value": "true",
            "result": "PASS",
            "deciding": false
          }
        ]
      }
    ]
  }$json$,
  NULL
);
