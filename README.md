# LexiPoint Demo

**Policy Intelligence Infrastructure for Government**

A clickable prototype demonstrating LexiPoint's deterministic rule evaluation engine applied to the Ohio Department of Health Hospital Capacity Change process (HEA 3614).

## What This Demonstrates

- **Intake Form**: Mirrors the actual ODH Hospital Capacity Change Form (HEA 3614, 6/2025) with all 14 hospital bed categories, 4 LTC categories, and obstetric/neonatal levels I-IV
- **Rule Evaluation**: Animated walkthrough of 40 rules across 9 regulatory domains (federal CMS, NFPA 101, EMTALA, ADA, Ohio ORC/OAC)
- **Decision Report**: Compliance checklist with pass/flag/block statuses and required actions timeline
- **Audit Trail**: Full reasoning chain for every rule evaluated — condition logic, input facts, plain-English reasoning, and dependency edges
- **Ontology Manager**: Business-user interface for browsing, editing, and publishing the regulatory rules that drive decision-making — includes structured condition builder, dependency visualization, version history, and impact simulation

## Deploy

```bash
npx vercel --prod
```

## Prototype Disclaimer

This is a product concept by Aimpoint Technology. Not affiliated with or endorsed by the Ohio Department of Health.

---

© 2026 Aimpoint Technology
