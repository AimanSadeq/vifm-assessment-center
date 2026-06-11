/**
 * Evidence & Validity Map — research-anchor draft / dump / verify runner.
 *
 * One tool for Bucket 1 of docs/Evidence-Map-Path-to-Green.md. Anchors are
 * picked by Claude from each instrument's CLOSED, curated bibliography
 * (real, spot-checkable citations + a menu cross-check), so the AI task is
 * matching a construct to a real citation, not generating citations.
 *
 * Modes:
 *   --draft    Generate ai_proposed anchors for every un-anchored construct
 *              (idempotent: skips human-touched + already-proposed unless
 *              --refresh). API-cost step.
 *   --dump     Print drafted construct->anchor mappings grouped by construct,
 *              with confidence distribution + flagged (novel/empty) items, so
 *              a reviewer can judge match quality without clicking 350 panels.
 *   --verify   Flip SOUND ai_proposed anchors to review_status=verified with
 *              an honest AI-assisted audit stamp. NEVER verifies novel/empty
 *              anchors or items in scripts/.evidence-skip.json — those stay
 *              ai_proposed for a human.
 *
 * Filters: --instrument ac|arc|fluent|reflect|all (default all), --limit N.
 *
 *   npx tsx scripts/evidence-anchor-run.ts --draft
 *   npx tsx scripts/evidence-anchor-run.ts --dump
 *   npx tsx scripts/evidence-anchor-run.ts --verify
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and (for
 * --draft) ANTHROPIC_API_KEY in .env.local. override:true defeats the
 * empty-key the Claude Code harness injects into spawned subprocesses.
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local", override: true });

import { suggestCompetencyValidationEvidence } from "../src/lib/ai/ac-evidence-suggester";
import { suggestValidationEvidence } from "../src/lib/ai/validation-evidence-suggester";
import { suggestFluentValidationEvidence } from "../src/lib/ai/fluent-evidence-suggester";
import { suggestReflectValidationEvidence } from "../src/lib/ai/reflect-evidence-suggester";
import { ARA_PILLARS } from "../src/lib/constants/ara-pillars";
import { ARA_INDIVIDUAL_FACTOR_MAP } from "../src/lib/constants/ara-individual-factors";

// ── args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const MODE: "draft" | "dump" | "verify" = has("--verify")
  ? "verify"
  : has("--dump")
    ? "dump"
    : "draft";
const REFRESH = has("--refresh");
const LIMIT = valOf("--limit") ? parseInt(valOf("--limit")!, 10) : Infinity;
const ONLY = (valOf("--instrument") ?? "all").toLowerCase();

const AUDIT_REVIEWER = "AI-assisted (Claude) · asadeq@gmail.com";
const NOVEL_PLACEHOLDER = "No close anchor in curated menu";
const SKIP_FILE = join(__dirname, ".evidence-skip.json");
const SKIP_IDS: Set<string> = existsSync(SKIP_FILE)
  ? new Set(JSON.parse(readFileSync(SKIP_FILE, "utf8")) as string[])
  : new Set();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type EV = {
  anchor_instruments?: Array<{ name?: string; citation?: string; confidence?: string; rationale?: string }>;
  construct_summary?: string;
  review_status?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  ai_model?: string | null;
};
type Construct = {
  id: string;
  table: string;
  group: string; // construct it belongs to (domain / pillar / skill / framework)
  label: string;
  evidence: EV | null;
  suggest: () => Promise<EV | null>;
};

// ── loaders ───────────────────────────────────────────────────────────
async function loadAc(): Promise<Construct[]> {
  const { data, error } = await sb
    .from("competencies")
    .select("id, name, description, validation_evidence, competency_clusters(name, competency_domains(name))");
  if (error) throw error;
  return (data ?? []).map((c: any) => {
    const domain = c.competency_clusters?.competency_domains?.name ?? "";
    return {
      id: c.id, table: "competencies", group: domain || "(no domain)", label: c.name,
      evidence: c.validation_evidence,
      suggest: () => suggestCompetencyValidationEvidence({
        competency_name: c.name, competency_description: c.description ?? "", domain_name: domain,
      }) as Promise<EV | null>,
    };
  });
}

async function loadArc(): Promise<Construct[]> {
  // User chose ALL banks (no version filter) so the map's 243 denominator is anchored.
  const { data, error } = await sb
    .from("ara_questions")
    .select("id, question_text_en, pillar_id, individual_factor_id, validation_evidence");
  if (error) throw error;
  return (data ?? []).map((q: any) => {
    let constructId: string, constructName: string, constructDescription: string;
    if (q.individual_factor_id) {
      const f = ARA_INDIVIDUAL_FACTOR_MAP[q.individual_factor_id as keyof typeof ARA_INDIVIDUAL_FACTOR_MAP];
      constructId = (f as any)?.id ?? q.individual_factor_id;
      constructName = (f as any)?.name_en ?? q.individual_factor_id;
      constructDescription = (f as any)?.description_en ?? "";
    } else {
      const p = ARA_PILLARS.find((x) => x.id === q.pillar_id);
      constructId = q.pillar_id;
      constructName = p?.name_en ?? q.pillar_id;
      constructDescription = p?.description_en ?? "";
    }
    return {
      id: q.id, table: "ara_questions", group: constructName,
      label: String(q.question_text_en ?? "").slice(0, 60),
      evidence: q.validation_evidence,
      suggest: () => suggestValidationEvidence({
        question_text_en: q.question_text_en, construct_id: constructId,
        construct_name: constructName, construct_description: constructDescription,
      }) as Promise<EV | null>,
    };
  });
}

async function loadFluent(): Promise<Construct[]> {
  const { data, error } = await sb
    .from("eng_fluent_items")
    .select("id, skill, cefr_label, validation_evidence");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, table: "eng_fluent_items", group: r.skill || "(no skill)",
    label: `${r.skill ?? "?"} · CEFR ${r.cefr_label ?? "?"}`,
    evidence: r.validation_evidence,
    suggest: () => suggestFluentValidationEvidence({ skill: r.skill, cefr: r.cefr_label }) as Promise<EV | null>,
  }));
}

async function loadReflect(): Promise<Construct[]> {
  const { data, error } = await sb
    .from("reflect_competencies")
    .select("id, name_en, description_en, validation_evidence, reflect_frameworks(name_en)");
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const fw = r.reflect_frameworks?.name_en ?? "";
    return {
      id: r.id, table: "reflect_competencies", group: fw || "(no framework)", label: r.name_en,
      evidence: r.validation_evidence,
      suggest: () => suggestReflectValidationEvidence({
        competency_name: r.name_en, competency_description: r.description_en ?? "", framework_name: fw,
      }) as Promise<EV | null>,
    };
  });
}

const INSTRUMENTS: Record<string, { label: string; load: () => Promise<Construct[]> }> = {
  ac: { label: "AC competencies", load: loadAc },
  arc: { label: "ARC questions", load: loadArc },
  fluent: { label: "Fluent items", load: loadFluent },
  reflect: { label: "Reflect competencies", load: loadReflect },
};

// ── helpers ───────────────────────────────────────────────────────────
function realAnchors(ev: EV | null): Array<{ name?: string; confidence?: string }> {
  return (ev?.anchor_instruments ?? []).filter(
    (a) => a && a.name && a.name !== NOVEL_PLACEHOLDER
  );
}
/** A construct is "sound to verify" only if it has >=1 real menu anchor. */
function isSound(ev: EV | null): boolean {
  return realAnchors(ev).length > 0;
}
function shouldDraft(ev: EV | null): boolean {
  if (!ev) return true;
  if (ev.review_status === "ai_proposed") return REFRESH;
  return false; // verified / edited / rejected → leave human work alone
}

// ── modes ─────────────────────────────────────────────────────────────
async function runDraft(key: string, items: Construct[]) {
  let processed = 0, skipped = 0, failed = 0, n = 0;
  for (const it of items) {
    if (n >= LIMIT) break;
    if (!shouldDraft(it.evidence)) { skipped++; continue; }
    n++;
    const ev = await it.suggest();
    if (!ev) { failed++; await sleep(300); continue; }
    const { error } = await sb.from(it.table).update({ validation_evidence: ev }).eq("id", it.id);
    if (error) { failed++; console.log(`  ! save ${it.id}: ${error.message}`); }
    else { processed++; }
    if (processed % 20 === 0 && processed) console.log(`  …${key}: ${processed} drafted`);
    await sleep(400);
  }
  console.log(`${key.padEnd(8)} draft → ${processed} proposed, ${skipped} skipped, ${failed} failed`);
}

function runDump(key: string, items: Construct[]) {
  console.log(`\n=== ${INSTRUMENTS[key].label} (${items.length}) ===`);
  const byGroup = new Map<string, Construct[]>();
  for (const it of items) {
    if (!byGroup.has(it.group)) byGroup.set(it.group, []);
    byGroup.get(it.group)!.push(it);
  }
  for (const [group, list] of [...byGroup.entries()].sort()) {
    const conf = { direct_adaptation: 0, construct_aligned: 0, novel: 0 };
    const anchorCounts = new Map<string, number>();
    const flagged: string[] = [];
    let drafted = 0;
    for (const it of list) {
      const ev = it.evidence;
      if (!ev || !ev.review_status) continue;
      drafted++;
      const real = realAnchors(ev);
      if (real.length === 0) { flagged.push(`${it.id}  "${it.label}"  → ${ev.construct_summary ?? ""}`); conf.novel++; continue; }
      for (const a of real) {
        conf[(a.confidence as keyof typeof conf) in conf ? (a.confidence as keyof typeof conf) : "construct_aligned"]++;
        anchorCounts.set(a.name!, (anchorCounts.get(a.name!) ?? 0) + 1);
      }
    }
    console.log(`\n  ▸ ${group}  (${list.length} items, ${drafted} drafted)`);
    console.log(`     confidence: direct=${conf.direct_adaptation} aligned=${conf.construct_aligned} novel/none=${conf.novel}`);
    const top = [...anchorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [name, c] of top) console.log(`     · ${c.toString().padStart(3)}×  ${name}`);
    if (flagged.length) {
      console.log(`     ⚠ ${flagged.length} with NO real anchor (novel/empty) → will NOT be verified:`);
      for (const f of flagged) console.log(`         ${f}`);
    }
  }
}

async function runVerify(key: string, items: Construct[]) {
  let verified = 0, skippedHuman = 0, skippedNovel = 0, skippedList = 0, failed = 0;
  const now = new Date().toISOString();
  for (const it of items) {
    const ev = it.evidence;
    if (!ev || ev.review_status !== "ai_proposed") { skippedHuman++; continue; }
    if (SKIP_IDS.has(it.id)) { skippedList++; continue; }
    if (!isSound(ev)) { skippedNovel++; continue; }
    const stamped: EV = { ...ev, review_status: "verified", reviewed_by: AUDIT_REVIEWER, reviewed_at: now };
    const { error } = await sb.from(it.table).update({ validation_evidence: stamped }).eq("id", it.id);
    if (error) { failed++; console.log(`  ! ${it.id}: ${error.message}`); }
    else verified++;
  }
  console.log(
    `${key.padEnd(8)} verify → ${verified} verified, ${skippedNovel} novel/empty left ai_proposed, ` +
      `${skippedList} skip-listed, ${skippedHuman} already-human/none, ${failed} failed`
  );
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  if (MODE === "draft" && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY missing in .env.local — cannot draft."); process.exit(1);
  }
  const keys = ONLY === "all" ? Object.keys(INSTRUMENTS) : [ONLY];
  console.log(`evidence-anchor-run — mode=${MODE} instruments=${keys.join(",")}${REFRESH ? " refresh" : ""}${LIMIT !== Infinity ? ` limit=${LIMIT}` : ""}`);
  if (MODE === "verify") console.log(`reviewer stamp: "${AUDIT_REVIEWER}"  ·  skip-list: ${SKIP_IDS.size} id(s)`);

  for (const key of keys) {
    const inst = INSTRUMENTS[key];
    if (!inst) { console.log(`(unknown instrument ${key})`); continue; }
    const items = await inst.load();
    if (MODE === "draft") await runDraft(key, items);
    else if (MODE === "dump") runDump(key, items);
    else await runVerify(key, items);
  }
}

main().catch((e) => { console.error("run crashed:", e); process.exit(1); });
