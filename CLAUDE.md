# LexiPoint – Project Context for Claude Code

## Project Overview

**LexiPoint** is a "Policy Intelligence Infrastructure for Government" – a clickable demo that lets government agencies manage regulatory rules, evaluate license applications, and track compliance changes.

- **Live URL**: https://lexipoint-demo-8j38.vercel.app
- **GitHub repo**: kevin-s-potter/lexipoint-demo (auto-deploys to Vercel on push)
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
├── vercel.json         # Vercel config
├── database/
│   ├── 01_create_tables.sql    # Schema definition (11 tables)
│   ├── 02_seed_data.sql        # Ohio hospital licensing seed data
│   ├── 04_add_kentucky_tenant.sql  # Kentucky nursing home program
│   └── 05_add_snap_program.sql     # SNAP benefits (183 rules)
└── data/
    └── schema.json     # Reference data model (JSON)
```

## Multi-Tenant / Multi-Program Model

Every table has `tenant_id`. Programs live within tenants. Each HTML file has a `PROGRAM_CONFIG` object:

```javascript
const PROGRAM_CONFIG = {
  'hosp-licensing': { tenant: 'ohio-odh', abbr: 'ODH', name: 'Ohio Department of Health', programName: 'Hospital Licensing', userId: 'user-001', ruleCount: 23 },
  'snap':           { tenant: 'ohio-odh', abbr: 'ODH', name: 'Ohio Department of Health', programName: 'SNAP Benefits',      userId: 'user-001', ruleCount: 183 },
  'nursing-home':   { tenant: 'ky-chfs',  abbr: 'CHFS', name: 'Kentucky CHFS',            programName: 'Nursing Home Licensing', userId: 'user-101', ruleCount: 8 }
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

When adding a new program, ALL 4 HTML files need their PROGRAM_CONFIG and tenant-switcher dropdown updated.

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
- 2 tenants: `ohio-odh` (Ohio Dept of Health), `ky-chfs` (Kentucky CHFS)
- 3 programs: Hospital Licensing (23 rules), SNAP Benefits (183 rules), Nursing Home Licensing (8 rules)
- 214 total rules

### ID conventions
- `rule_id`: 2-3 letter prefix + number (OH-001, SNAP-001, NH-001)
- `condition_id`: cond-{rule_id}-{seq} (cond-OH-001-01)
- `dep_id`: dep-{rule_id}-{seq}
- `status` values: always **lowercase** – 'active', 'draft', 'review', 'sunset'
- User IDs: user-001 to user-003 (Ohio), user-101 to user-102 (Kentucky)
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

## Adding a New Program (checklist)

1. Create SQL file: `database/XX_add_<program>.sql` with INSERTs for programs, rules, rule_conditions, rule_dependencies, audit_log, notifications
2. Add PROGRAM_CONFIG entry to all 4 HTML files
3. Add tenant-switcher dropdown option to all 4 HTML files
4. Update USER_DISPLAY if new tenant needs new users
5. Test that program switcher loads data correctly on all pages
