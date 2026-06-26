# Voucher Consolidation Plan

> Status: **Proposed** (scoping). Unify the 7 per-service voucher engines on the ARC
> reference model behind a shared core, keeping every service's table for data
> continuity. Grounded in the voucher-consistency audit (2026-06-26).

## 1. Goal & non-goals

**Goal.** One voucher *engine* and one *redeem experience* across all services,
matching the ARC reference: bilingual redeem, safe (server-side) prefill, atomic
claim **and** release, identical hardening - so the next fix is written once, not
seven times.

**Non-goals (explicitly out of scope).**
- **Do not merge the 7 tables.** Each `*_vouchers` / `*_voucher_redemptions` table
  stays (data continuity, per-service columns, FK shapes differ). We unify the
  *logic and UI over* those tables, not the tables themselves.
- **Do not touch the allocation/issuance layer** - it is *already* shared
  (`src/lib/clients/voucher-issue.ts` + `allocations.ts` + `claim_allocation_seats`).
- **Do not change provisioning semantics** (what each redeem creates: an
  `ara_assessment`, a `prehire_candidate`, a `behavioral_assessment_session`, etc.).
  That stays a per-service callback.

## 2. Current state

### What is already shared
- **Issuance/distribution** for the client portal (Fluent, Logica, Persona, Techno,
  ARC-individual): `voucher-issue.ts` draws from the allocation ledger -> generates ->
  emails -> unwinds on failure. No duplication.
- **Code generation** helper (`randomBlock` / `CODE_ALPHABET`) is copied but identical.

### What is duplicated 7x (the drift surface)
Each service owns a table, a claim RPC, a (usually) release RPC, a `vouchers.ts`,
a redeem page, and an admin issuance UI:

| Service | Table | Claim RPC | Release RPC | Redeem path | Lib | Code prefix |
|---|---|---|---|---|---|---|
| **ARC (ref)** | `ara_vouchers` | `ara_voucher_claim` | `ara_voucher_release_seat` | `/ara/redeem` | `ara/vouchers.ts` | `VIFM-ARC-` |
| Persona | `persona_vouchers` | `persona_voucher_claim` | `persona_voucher_release_seat` | `/ac/persona/redeem` | `persona/vouchers.ts` | `VIFM-PER-` |
| Logica | `cognitive_vouchers` | `cognitive_voucher_claim` | `cognitive_voucher_release_seat` | `/ac/cognitive/redeem` | `cognitive/vouchers.ts` | shared block |
| Role Readiness | `rr_vouchers` | `rr_claim_voucher_seat` | `rr_release_voucher_seat` | `/role-readiness/redeem` | `role-readiness/vouchers.ts` | 16-char, no prefix |
| Fluent | `eng_fluent_vouchers` | `eng_fluent_voucher_claim` | **MISSING** | `/ac/fluent/redeem` | `fluent/vouchers.ts` | `VIFM-ENG-` |
| Pre-Hire | `prehire_vouchers` | `prehire_voucher_claim` | `prehire_voucher_release` | `/prehire/redeem` | `prehire/vouchers.ts` | `VIFM-HIRE-` |
| Techno | `technical_sandbox_vouchers` | `technical_sandbox_voucher_claim` | `technical_sandbox_voucher_release` | `/tech-sandbox/redeem` | `technical-sandbox/vouchers.ts` | prefixed |

### Divergence buckets
- **Risk-class (fix regardless of consolidation):**
  - Fluent has **no release RPC** -> a failed/abandoned redemption permanently burns a seat.
  - Role Readiness + Fluent **prefill name/email from URL params** - the phishing vector
    ARC/Logica/Persona/Pre-Hire reject. (Techno prefills server-side from the voucher row = safe.)
- **Feature/UX:** only ARC + Persona have a real **bilingual EN/AR redeem toggle**; the
  other five are English-only at redeem.
- **Cosmetic:** inconsistent code prefixes; inconsistent RPC names
  (`*_voucher_claim` vs `rr_claim_voucher_seat`, `*_release_seat` vs `*_release`);
  delivery emphasis (ARC code-first, Techno link-first, Pre-Hire link-only).

## 3. Target architecture

Introduce `src/lib/vouchers/` (shared core) without merging tables:

- **`descriptor.ts` - service registry.** One entry per service:
  ```
  { key, table, redemptionsTable, claimRpc, releaseRpc, redeemPath,
    codePrefix, scopeColumns, provision(claimed, redeemer) -> { token, ... } }
  ```
- **`core.ts` - engine.** `generateBatch(descriptor, opts)` and
  `redeem(descriptor, code, redeemer)`: claim via `descriptor.claimRpc` ->
  `descriptor.provision(...)` -> insert redemption row -> on failure call
  `descriptor.releaseRpc`. All the duplicated try/claim/record/release logic lives here once.
- **`codegen.ts`** - the single code generator (prefix from descriptor).
- **`<VoucherRedeemForm>`** (shared client component) - the ARC pattern: EN/AR toggle,
  code-only from URL, **server-side** company/scope prefill from the voucher row, no
  name/email URL prefill. Each `/*/redeem/page.tsx` becomes a thin wrapper passing its descriptor.
- **Canonical claim/release SQL template** + a small generator, so all 7 RPC pairs are
  byte-identical (SECURITY DEFINER, `search_path=public`, EXECUTE service_role only).
  Future hardening = regenerate, one migration.

Each service keeps only: its table, its `provision()` callback, and its descriptor entry.

## 4. Phased plan

### Phase 0 - Risk fixes (ship now, independent) - ~0.5-1 day
- Add `eng_fluent_voucher_release_seat` RPC (new migration, mirrors `ara_voucher_release_seat`)
  + wire it into `fluent/vouchers.ts` redeem-failure path.
- Remove URL name/email prefill from `/role-readiness/redeem` and `/ac/fluent/redeem`
  (match ARC's code-only prefill; keep server-side company/scope).
- **Ships value alone; de-risks before any refactor.**

### Phase 1 - Shared core + types + codegen (no behavior change) - ~2-3 days
- Create `src/lib/vouchers/{descriptor,core,codegen,types}.ts`.
- Port **one** service (Logica - the simplest clone) onto it as the proof; leave the other six untouched.
- Add a redeem smoke test for Logica (claim -> provision -> redemption row -> token works; failure -> seat released).

### Phase 2 - Shared redeem component (biggest UX win) - ~3-4 days
- Build `<VoucherRedeemForm>` (bilingual + safe prefill).
- Cut each `/*/redeem/page.tsx` over to it, **one at a time**, behind the existing
  redeem actions. Closes the bilingual gap on the five English-only services and
  normalizes prefill posture everywhere.

### Phase 3 - Canonical claim/release RPC template - ~2-3 days
- Author the SQL template + generator; regenerate all 7 claim/release RPC pairs to be
  identical (consistent names too: `<table>_claim` / `<table>_release`). One migration,
  applied per the standard process. Add Fluent's release here if not already from Phase 0.

### Phase 4 - Migrate remaining services onto the core - ~3-5 days
- Move Fluent, Persona, Techno, Pre-Hire, Role Readiness, ARC to `core.redeem()` /
  `core.generateBatch()`, leaving only `provision()` + descriptor per service. Delete the
  duplicated redeem/claim orchestration. One service per PR, each verified end-to-end.

### Phase 5 - Cosmetic normalization + cleanup - ~1-2 days
- Decide code-prefix policy (recommend: **keep** per-service prefixes - they aid support
  triage - but standardize the format `VIFM-XXX-####-####`; give RR a prefix).
- Normalize delivery UX: link + code everywhere, link-first, with a copy button for each.
- Share the issuance table/copy-button UI where the per-service admin pages allow.

## 5. Per-service cutover checklist (repeat for each)
1. Add descriptor entry (table, RPCs, redeem path, prefix, `provision`).
2. Swap `vouchers.ts` redeem/generate to call `core.*`.
3. Swap redeem page to `<VoucherRedeemForm descriptor=...>`.
4. Regenerate claim/release RPC from the template (migration).
5. End-to-end test: issue -> redeem (EN + AR) -> token works; forced-failure -> seat released; expired/disabled -> rejected.
6. Verify on staging, then prod.

## 6. Risks & mitigations
- **Every service is demo-critical.** Mitigate: one service per PR, old path stays until
  the new one is verified; descriptor pattern localizes any bug to one entry.
- **RLS/RPC changes need migrations** (applied via the standard Chrome-SQL process). Each
  migration is additive (new/replaced functions), reversible by restoring the prior body.
- **Schema differences** (RR single-use vs ARC tiers, Techno custom_config) are absorbed by
  `scopeColumns` + `provision()`; the core never assumes a uniform schema.
- **Tolerance:** keep the progressive-column read/insert pattern the services already use,
  so a not-yet-applied migration degrades gracefully.

## 7. Testing
- A shared `vouchers` test harness driving each descriptor through: issue, redeem (EN/AR),
  double-redeem past `max_uses` (rejected), expired (rejected), provision-failure
  (seat released), URL with `?code=` (code prefilled) and with `?email=`/`?name=` (ignored).
- Run per service after each cutover; gate prod deploy on it.

## 8. Effort & sequencing
- **Total:** ~2.5-4 weeks, one engineer. Phase 0 is hours.
- **Recommended order:** Phase 0 immediately (value + de-risk) -> Phase 2 next (bilingual
  everywhere is the most visible win, and the redeem component can land before the deeper
  engine refactor) -> Phases 1/3/4 (engine + RPC template) -> Phase 5 (polish).
- **Definition of done:** all 7 redeem pages render from one component; all 7 claim/release
  RPCs are template-generated and identical; `core.redeem`/`core.generateBatch` is the only
  redeem/generate path; the next hardening change is a single diff.
