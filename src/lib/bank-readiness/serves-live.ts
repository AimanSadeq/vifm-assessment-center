// Per-bank "still minting live-AI" predicates for the four gated banks
// (Logica / Techno / Pre-Hire / Fluent). While a bank serves live-AI at sitting
// time (its vetted pool isn't promoted yet), its results are provisional. These
// mirror the readiness dashboard's servesLive logic but as cheap standalone
// checks for the result/report surfaces. Tolerant: on any error they return
// false (don't flag), so a legacy/un-migrated environment is never spuriously
// flagged.

import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTESTS } from "@/lib/psychometrics/framework";
import { TECH_DOMAINS } from "@/lib/competencies/technical-framework";

const COGNITIVE_MIN = 8; // approved items per subtest before the bank serves
const TECH_MIN = 8; // approved items per domain before it certifies
const PREHIRE_MIN = 8; // approved items per competency
const FLUENT_RAMP: Record<string, number> = { A1: 2, A2: 2, B1: 2, B2: 2, C1: 1, C2: 1 };
const PREHIRE_TOTAL_COMPS = 41;

/** Logica (cognitive): serves live-AI until every subtest has enough approved. */
export async function logicaServesLive(): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const [{ data: scales }, { data: items }] = await Promise.all([
      svc.from("psy_scales").select("id, key"),
      svc.from("psy_items").select("scale_id, status").eq("status", "approved"),
    ]);
    const idToKey = new Map((scales ?? []).map((s) => [String((s as { id: string }).id), String((s as { key: string }).key)]));
    const cog = new Set(COGNITIVE_SUBTESTS.map((s) => s.key));
    const per = new Map<string, number>();
    for (const r of items ?? []) {
      const k = idToKey.get(String((r as { scale_id: string }).scale_id));
      if (k && cog.has(k)) per.set(k, (per.get(k) ?? 0) + 1);
    }
    return !COGNITIVE_SUBTESTS.every((s) => (per.get(s.key) ?? 0) >= COGNITIVE_MIN);
  } catch {
    return false;
  }
}

/** Techno: serves indicative live-AI until every domain has enough approved. */
export async function technoServesLive(): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data } = await svc.from("tech_assessment_items").select("domain_key, status").eq("status", "approved");
    const per = new Map<string, number>();
    for (const r of data ?? []) {
      const k = String((r as { domain_key: string }).domain_key);
      per.set(k, (per.get(k) ?? 0) + 1);
    }
    return !TECH_DOMAINS.every((d) => (per.get(d.key) ?? 0) >= TECH_MIN);
  } catch {
    return false;
  }
}

/** Pre-Hire: serves live-AI until every competency has an approved pool. */
export async function prehireServesLive(): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data } = await svc.from("competency_quiz_items").select("competency_id, status").eq("status", "approved");
    const per = new Map<string, number>();
    for (const r of data ?? []) {
      const k = String((r as { competency_id: string }).competency_id);
      per.set(k, (per.get(k) ?? 0) + 1);
    }
    const ready = Array.from(per.values()).filter((n) => n >= PREHIRE_MIN).length;
    return ready < PREHIRE_TOTAL_COMPS;
  } catch {
    return false;
  }
}

/** Fluent: serves live-AI until reading + listening each have a full live ramp. */
export async function fluentServesLive(): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data } = await svc.from("eng_fluent_items").select("skill, cefr_label, status").eq("status", "live");
    const per = new Map<string, number>(); // `${skill}:${cefr}` -> live count
    for (const r of data ?? []) {
      const row = r as { skill: string; cefr_label: string | null };
      per.set(`${row.skill}:${row.cefr_label}`, (per.get(`${row.skill}:${row.cefr_label}`) ?? 0) + 1);
    }
    const servable = (skill: string) =>
      Object.entries(FLUENT_RAMP).every(([cefr, need]) => (per.get(`${skill}:${cefr}`) ?? 0) >= need);
    return !(servable("reading") && servable("listening"));
  } catch {
    return false;
  }
}
