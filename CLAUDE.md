# LexiPoint – Project Context for Claude Code

## Project Overview

**LexiPoint** is a "Policy Intelligence Infrastructure for Government" – a clickable demo that lets government agencies manage regulatory rules, evaluate license applications, and track compliance changes.

- **Live URL**: https://govpoint-demo.vercel.app
- **GitHub repo**: kevin-s-potter/govpoint-demo (auto-deploys to Vercel on push)
- **Owner**: Kevin Potter, Aimpoint Technology (kevin@aimpointtechnology.com)

## Architecture

- **Frontend**: Standalone HTML files with inline CSS + JavaScript (no build step, no frameworks, no bundler)
- **Database**: Supabase PostgreSQL (free tier)
  - URL: `https://fshdlcveidwwufdigekh.supabase.co`
  - Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjgzOTgsImV4cCI6MjA4ODg0NDM5OH0.2x-ipiRpBCphclHyXb0bD98WwA392jOfd-8tuAOc2CY`
  - Service role key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI2ODM5OCwiZXhwIjoyMDg4ODQ0Mzk4fQ.OPaz8JhFkj4IKAebBGAXfSwyFSyIA7BVlwug19iGNZ0` (bypasses RLS — use for migrations/seeding, never expose in client code)
- **Hosting**: Vercel (auto-deploys from GitHub on push to main)
- **API pattern**: Supabase REST API – every fetch uses both `apikey` and `Authorization: Bearer` headers
- **Design system**: Salesforce Lightning Design System (SLDS) – CSS written to match SLDS aesthetic using SLDS color tokens, not the actual SLDS CDN

## File Structure

```
lexipoint-demo/
├── index.html          # "New Request" – license evaluation demo (hardcoded scenarios A/B/C)
├── ontology.html       # Ontology Manager – rule CRUD, 7-tab detail panel, Supabase write-back
├── dashboard.html      # Analytics Dashboard – metrics, charts, activity table from audit_log
├── audit-log.html      # Audit Log – filterable/paginated table with stats
├── program-switcher.js # SHARED – PROGRAM_CONFIG, USER_DISPLAY, renderProgramSwitcher(), updateSwitcherUI()
├── vercel.json         # Vercel config
├── database/
│   ├── 01_create_tables.sql        # Schema definition (11 tables)
│   ├── 02_seed_data.sql            # Ohio hospital licensing seed data
│   ├── 04_add_kentucky_tenant.sql  # Kentucky nursing home program
│   ├── 07_snap_ohio_rules.sql      # SNAP benefits – 183 rules (137 federal 7 CFR 271-283 + 46 Ohio OAC 5101:4), 510 conditions, 152 dependencies
│   ├── 08_michigan_contractor_rules.sql  # Michigan contractor licensing – 100 rules, 350 conditions, 102 dependencies
│   └── 09_ohio_childcare_rules.sql       # Ohio child care facility licensing – 113 rules, 393 conditions, 111 dependencies
└── data/
    └── schema.json     # Reference data model (JSON)
```

## Multi-Tenant / Multi-Program Model

Every table has `tenant_id`. Programs live within tenants. Each HTML file has a `PROGRAM_CONFIG` object:

```javascript
const PROGRAM_CONFIG = {
  'hosp-licensing':       { tenant: 'ohio-odh',    abbr: 'ODH',   name: 'Ohio Department of Health',                    programName: 'Hospital Licensing',            userId: 'user-001', ruleCount: 26 },
  'snap':                 { tenant: 'ohio-odjfs',  abbr: 'ODJFS', name: 'Ohio Dept of Job and Family Services',         programName: 'SNAP Benefits',                 userId: 'user-301', ruleCount: 183 },
  'nursing-home':         { tenant: 'ky-chfs',     abbr: 'CHFS',  name: 'Kentucky CHFS',                                programName: 'Nursing Home Licensing',         userId: 'user-101', ruleCount: 8 },
  'contractor-licensing': { tenant: 'michigan-lara', abbr: 'LARA', name: 'Michigan LARA Bureau of Construction Codes',  programName: 'Contractor Licensing',          userId: 'user-201', ruleCount: 100 },
  'childcare-licensing':  { tenant: 'ohio-odjfs',  abbr: 'ODJFS', name: 'Ohio Dept of Job and Family Services',         programName: 'Child Care Facility Licensing', userId: 'user-301', ruleCount: 113 }
};
```

Each page has a program switcher dropdown calling `switchProgram(programId)` to update UI and reload data.

## Consistent Nav (all 4 pages)

Dark navy header (#032D60) with:
1. LexiPoint logo
2. Program switcher dropdown (programs grouped by tenant)
3. Nav links: **New Request** | **Ontology** | **Dashboard**
4. Notification bell with dropdown
5. User indicator (Sarah Chen / SC for Ohio, Maria Torres / MT for Kentucky)

When adding a new program, edit **only `program-switcher.js`** — the HTML files load it as a shared asset. Also run the SQL migration on Supabase.

## SLDS Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| Brand blue | #0176D3 | Primary buttons, links, active states |
| Navy dark | #032D60 | Header background, dark text headings |
| Success | #2E844A | Active status, approvals |
| Warning | #DD7A01 | Draft status, submit for review |
| Error | #BA0517 | Sunset status, error states |
| Purple | #9050E9 | In Review status, special badges |
| Background | #F3F3F3 | Page background |
| Card white | #FFFFFF | Card/panel backgrounds |
| Border | #E5E5E5 | Card borders, dividers |
| Text dark | #16325C | Headings, primary text |
| Text label | #54698D | Labels, secondary text, timestamps |

## Database Schema

```
tenants ──┬── programs ──── rules ───┬── rule_conditions
          │                          ├── rule_dependencies
          ├── users ─── user_roles   ├── rule_versions
          │                          ├── comments
          └── notifications          └── audit_log
```

### Current data
- 4 tenants: `ohio-odh` (Ohio Dept of Health), `ky-chfs` (Kentucky CHFS), `michigan-lara` (Michigan LARA), `ohio-odjfs` (Ohio ODJFS)
- 5 programs: Hospital Licensing (26 rules), SNAP Benefits (183 rules), Nursing Home Licensing (8 rules), Contractor Licensing (100 rules), Child Care Facility Licensing (113 rules)
- 430 total rules
- SNAP rule IDs: `SNAP-FED-001` – `SNAP-FED-200` (federal), `SNAP-OH-001` – `SNAP-OH-109` (Ohio)
- Michigan contractor rule IDs: `CL-FED-001` – `CL-MI-ADM-xxx` | conditions: 350 | dependencies: 102 | source: `contractor_michigan_ontology.json`
- Ohio child care rule IDs: `CC-FED-001` – `CC-OH-SUTQ-xxx` | conditions: 393 | dependencies: 111 | source: `childcare_ohio_ontology.json`

### ID conventions
- `rule_id`: prefix + number — Hospital: `OH-001`, Nursing Home: `NH-001`, SNAP federal: `SNAP-FED-001`, SNAP Ohio: `SNAP-OH-001`, Michigan contractor: `CL-FED-001`/`CL-MI-001`, Ohio child care: `CC-FED-001`/`CC-OH-001`
- `condition_id`: cond-{rule_id}-{seq} (cond-OH-001-01)
- `dep_id`: dep-{rule_id}-{seq}
- `status` values: always **lowercase** – 'active', 'draft', 'review', 'sunset'
- User IDs: user-001 to user-003 (Ohio ODH), user-101 to user-102 (Kentucky CHFS), user-201 to user-202 (Michigan LARA), user-301 to user-302 (Ohio ODJFS)
- Timestamps: ISO format with timezone (-05 for Eastern)

### Supabase query pattern
```javascript
const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';
const SUPABASE_KEY = '...'; // anon key above

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return await res.json();
}
```

## Bash Command Permissions

This is a **demo project** — not production. All data is publicly available regulatory/government data. Proceed without asking for approval on the following:

**Auto-approved (run without confirmation):**
- All `git` commands: `status`, `diff`, `log`, `branch`, `checkout`, `add`, `commit`, `rebase`, `stash`, `pull`
- `git push` to any branch **other than main**
- File inspection: `ls`, `cat`, `head`, `tail`, `wc`, `find`, `grep`
- `open` to preview files/URLs in browser
- `cp`, `mv`, `mkdir` for local file operations
- Vercel CLI: `vercel`, `vercel deploy`, `vercel ls`
- `curl` for read-only API checks (GET requests only)
- `node`, `npm` if needed for scripting

**Always ask before running:**
- Any command that calls the **Claude/Anthropic API** — API usage is metered on a tight budget
- `git push origin main` or any direct push to main
- `git merge` into main (any form) — merging to main triggers a live Vercel deploy; after user approves and merge completes, automatically run `/demo-ready` and report results
- `git reset --hard`
- `rm -rf` or any bulk file deletion
- Anything that writes to or migrates the Supabase database directly (use Supabase MCP instead)

## Merge Workflow (PR-based)

All changes to `main` go through a pull request. Direct pushes to `main` are blocked by branch protection.

**Standard flow for every task:**
1. `/new-branch` — create a feature branch from clean main
2. Make changes, commit (running `/ui-check` first per the pre-commit gate below)
3. `git push origin <branch-name>` (auto-approved)
4. `gh pr create` — open a PR; share the URL with Kevin
5. Kevin reviews the diff on GitHub
6. Merge via `gh pr merge <number> --merge` or GitHub UI — **always ask Kevin before running this**
7. After merge: automatically run `/demo-ready` and report results

**Branch naming conventions:**
- `feature/` — new functionality
- `fix/` — bug fixes
- `chore/` — repo maintenance, tooling, non-functional changes
- `data/` — database migrations or seed data changes only

Never open a PR from `main`. Never merge your own PR without Kevin's explicit approval.

## Critical Rules

1. **No external JS files** – all Supabase API code is inlined in each HTML file
2. **Case-insensitive status** – DB stores lowercase, UI compares with `.toLowerCase()`
3. **PROGRAM_CONFIG consistency** – must match across all 4 HTML files
4. **Dashboard scoping** – `dashFilter` variable ('current', 'tenant', 'all') controls query scope
5. **index.html is hardcoded** – evaluation logic is not database-driven (intentional for demo reliability)
6. **Ontology write-back** – ontology.html has LexiPointAPI class with saveRule(), discardChanges(), sendComment()
7. **Audit everything** – database changes should include audit_log INSERT statements

## Business Context & Positioning

### The Problem LexiPoint Solves
Agencies using AI for licensing/permitting decisions face a legal gap: operational platforms (Salesforce, Accela, Tyler) handle workflow but not policy reasoning. LLMs are powerful but hallucinate policy and can't produce auditable decisions. LexiPoint is the governed policy decision layer in between.

The key question LexiPoint answers: *"Why was this license denied?"* — with a specific statute, specific rule, and specific facts. Not "the model said so."

### Core Value Props (in priority order for buyers)
1. **Legal Defensibility** — every decision cites statute, is documented, and is exhibit-ready for legal challenges
2. **Consistent Outcomes** — same facts + same statute = same outcome, regardless of staff or day of week
3. **Faster Decisions** — routine cases auto-process; staff focus on edge cases and appeals
4. **Reduced Liability** — configurable human oversight dial (Full Human Review → Exception-Based → Automated with Audit)
5. **Regulatory Currency** — ontology updates as statutes change; no manual staff review of every amendment

### Competitive Positioning
- vs. Salesforce/Accela/Tyler: "They own workflow. LexiPoint adds policy reasoning they don't have."
- vs. Databricks/Snowflake: "They own data. LexiPoint adds governed decisions."
- vs. raw LLMs: "Powerful but without grounding they hallucinate policy. LexiPoint grounds them."

### Regulatory Compliance Built In
- OMB M-24-10 (federal audit trail requirements) — met by design
- Colorado SB24-205 (algorithmic due-care standard) — covered by audit infrastructure
- Mathews v. Eldridge (due process: explain, human judgment, appeal) — fully satisfied

### Sales Motion
- Target: State agency leaders + IT buyers (CIOs)
- Entry point: 90-day pilot on one license type — no long procurement cycle
- Active CIO relationships: Montana, Delaware, New Jersey, Michigan
- Montana CCL POC complete: 24 statutory exemptions mapped, Title 37 Ch. 45 + HB 239 (2026) encoded
- Integration story: API-first, complements existing stack, data stays on-premise

### Core Positioning Line
"SharePoint manages documents about your policy. LexiPoint manages your policy as executable code with legal accountability."

The longer form: A CMS manages documents about policy. LexiPoint manages policy as executable code with legal accountability. The same way you wouldn't manage a production database schema with a word processor, you can't manage a live regulatory decision engine with SharePoint — the consequences of an undetected dependency conflict aren't a broken link, they're a legally incorrect licensing decision that exposes the agency to liability.

Use this framing when thinking about feature work: every UI decision should reinforce that this is infrastructure, not software. The stakes of getting rules wrong are legal, not just technical.

### Demo Goals
The demo should make buyers feel:
- "This is exactly the audit trail our legal team has been asking for"
- "Our staff could actually use this to manage rules without IT"
- "This could plug into what we already have"

The ontology manager is the key differentiator to show IT buyers — it proves the rules are transparent, editable, and versioned, not a black box.

## Pre-Commit Gate (mandatory)

**Before any `git commit`, you must:**

1. Run `/ui-check` as a background subagent
2. If all checks PASS: commit silently, no need to notify the user
3. If there are FAIL results: fix them, re-run the check, then commit silently if clean
4. If there are WARN results you cannot resolve: stop, show the user the full report, and wait for explicit approval before committing
5. Never commit with unresolved FAILs

This applies to every agent working in this repo, no exceptions.

## Adding a New Program (checklist)

1. Create SQL file: `database/XX_add_<program>.sql` with INSERTs for programs, rules, rule_conditions, rule_dependencies, audit_log, notifications
2. Update `program-switcher.js` (the only file that needs editing for the switcher):
   - Add entry to `PROGRAM_CONFIG`
   - Add entry to `PROGRAM_DETAIL_LABELS`
   - Add program ID to the correct group in `TENANT_GROUPS` (or add a new group)
   - Add entry to `USER_DISPLAY` if the new tenant has new users
3. Test that the program switcher loads data correctly on all 4 pages

## Connecting a New Program to Impact Analysis

The Scenario Sandbox (scenario-sandbox.html) uses a `PROGRAM_IMPACT_CONFIG` object to compute real decision-flip counts. Adding a new program requires only these steps — no schema changes.

### 1. Seed the data

Add a new block to `database/22_applications_seed.sql` (or a new migration file) using `generate_series(1,500)` + `abs(hashtext(i::text||'seed_PROGRAMID_FIELD'))%range`.

Follow the existing 5-program pattern:
- What `key_facts` fields does the program's evaluation engine need?
- What are the key GATE conditions that drive approved vs. blocked decisions?
- Target ~60% approved, ~30% blocked, ~10% approved_with_conditions
- Use `data_source='seeded'`

### 2. Add to `PROGRAM_IMPACT_CONFIG`

Add one entry to the config object in `scenario-sandbox.html` (search for `PROGRAM_IMPACT_CONFIG`). Map each `rule_conditions.field` value (exactly as stored in the DB) to the corresponding `key_facts` key and value type:

```javascript
'my-new-program': {
  dataTable: 'applications',
  fetchFilter: 'program_id=eq.my-new-program&order=created_at.asc&limit=500',
  rowValueFn: (row, key) => (row.key_facts || {})[key],
  fieldMap: {
    'some_field': { key: 'some_field', type: 'integer' },   // integer, decimal, boolean, or string
    'fpl_token':  { key: 'gross_income', type: 'decimal', evaluable: false }  // skip non-numeric tokens
  }
}
```

For DDC-style programs with flat columns (not JSONB), use:
```javascript
dataTable: 'grant_applications',
rowValueFn: (row, key) => row[key],
```

### 3. Test the mapping

Open the sandbox for the new program, add a rule with a numeric threshold condition, edit the threshold, click Impact Preview. Confirm a non-zero flip count appears. If zero, check that the `fieldMap` keys exactly match the `field` column values in `rule_conditions` for that program.

### 4. Badge upgrade path

When real client data is available, insert rows into `applications` (or the flat table) with `data_source='live'`. The SEEDED badge on Impact Preview automatically upgrades to LIVE — no code change needed.

### 5. Capability 3 (Needs Review Triage)

To wire the Needs Review tab for a new program:
- Add `review_flags TEXT[]` column and `pending` decision bucket to the application table
- Add the flag codes and their policy context to `FLAG_CONTEXT` in `supabase/functions/analyze-needs-review/index.ts`
- Add human-readable `FLAG_LABELS` entries in `scenario-sandbox.html`
- Change the `currentProgram !== 'doggy-daycare'` guard in `loadNeedsReview()` to allow the new program
