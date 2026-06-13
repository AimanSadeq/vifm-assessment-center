# Technical Assessment Portal — Performance-Based Sandbox Model

> Status: **IN BUILD (2026-06-13)**. Replaces the MCQ technical module per the
> "Technical Assessment Portal Master Blueprint" SRS. Behavioural, ARA/ARC,
> Fluent, CBI, auth, vouchers and reporting shell are untouched — this swaps the
> **technical** module only.

## Decisions (locked 2026-06-13)

| # | Decision | Choice |
|---|---|---|
| 1 | Architecture | Inside Caliber; reuse `technical_*` tables, auth, RLS, reporting |
| 2 | Spreadsheet engine | Client-side grid (Univer), server-side re-validation vs master |
| 3 | Code sandboxes | Python deferred; typed engine registry scaffolds all types |
| 4 | Taxonomy | Domain -> Function -> Pillar -> Skill Block; 9 domains / 63 functions; FP&A 1.7 active, rest inactive (lazy-load) |
| 5 | Replace scope | Full replace; MCQ runner + AP framework (00076) retired from live flow |
| 6 | Scoring | Per-Skill-Block %, banded (Basic <60 / Intermediate 60-84 / Advanced >=85); Pillar roll-up only |
| 7 | JD engine | Keyword now, pluggable + vector-ready, per-function descriptors, admin-confirm shortlist |
| 8 | Access | Reuse invite + token flow; completion -> report -> PDF |
| 9 | Language | Bilingual prompts + report (EN/AR, RTL), language-neutral work surface |
| 10 | Timing | Timed (default 20 min/block) + countdown + autosave + auto-submit + single attempt |
| 11 | Grid library | Univer (Apache-2.0) |
| 12 | SQL block 3.1 | Built now — read-only restricted role, rolled-back tx, throwaway schema, statement timeout, hash-match. Python deferred |

## Data model (migration 00077)

```
technical_domains (existing)            9 blueprint domains upserted by key
  └─ technical_functions (existing)     + node_id, domain_key FK, node_status,
        │                                 keywords[], descriptor_en/ar
        └─ technical_pillars (NEW)       grouping; report roll-up, NOT banded
              └─ technical_skill_blocks (NEW)   THE assessed unit; banded
                    • engine_type  spreadsheet | advanced_spreadsheet | logic_input | sql | python
                    • prompt_en/ar, instructions_en/ar, framework_ref
                    • time_limit_seconds
                    • engine_config  jsonb  (grid seed / fields / sql schema)
                    • master_solution jsonb (expected cells / values / query)
                    • checkpoints    jsonb  (weighted validation checks)
```

Runner / results:

```
technical_sandbox_sessions (NEW)   one sitting = one function (all its active blocks)
   token-accessed (reuses the ARA-style flow), timed, single attempt
technical_sandbox_responses (NEW)  one row per (session, skill_block):
   work jsonb (autosaved), score_pct, band, checkpoint_results jsonb, timings
```

### Lazy-load / node index
`technical_functions.node_status` is `active` only for the seeded blueprint
functions (FP&A 1.7 now); everything else is `inactive` with no pillars/blocks —
a valid empty node ready for expansion. This is the blueprint's `database_seed`
pattern expressed relationally.

### Checkpoint kinds (validator contract)
- `cell_value` — `{ target:"Sheet!A1", expected:n, tolerance }` value match
- `is_array_formula` — `{ target }` cell must hold a real array/data-table formula, not a hardcoded number
- `logic_value` — `{ field, expected, tolerance }` for logic-input fields
- `sql_result_match` — candidate query result hash == master query result hash

Each checkpoint carries a `weight`; Skill-Block score = weighted pass-rate %.
Band via `proficiencyTier()`. Pillar shows "n of m blocks Advanced", no band.

## Build order
1. **00077 schema + 9 domains + 63-function node index + FP&A 1.7 seed** (this step)
2. JD keyword matcher (pluggable interface) + per-function descriptors
3. Univer spreadsheet runner + server validators (cell_value, is_array_formula)
4. Logic-input runner + validator
5. SQL runner (read-only sandboxed) + result-hash validator
6. Scoring/banding -> results -> bilingual report -> PDF
7. Admin: assign function / JD-derived set, issue token (reuse invite flow)
```
