/* eslint-disable no-console */
// Seed a Persona competency norm group from completed sittings (migration
// 00127). Computes a person-level mean per competency across all submitted
// behavioral sessions, then the cross-person mean / sd / n per competency, and
// upserts them under the 'gcc_all_2026' group. The group stays is_provisional
// until every competency reaches a meaningful n (target >= 100); below that the
// report labels the norm "provisional".
//
//   npx tsx scripts/seed-persona-norms.ts
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GROUP_CODE = "gcc_all_2026";
const N_TARGET = 100; // per-competency n below which the norm stays provisional

async function main() {
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Submitted sessions only.
  const { data: sessions, error: sErr } = await sb
    .from("behavioral_assessment_sessions")
    .select("id")
    .eq("status", "submitted");
  if (sErr) throw sErr;
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length === 0) {
    console.log("No submitted sessions - nothing to norm.");
    return;
  }

  // 2. All their responses. Page through in case of volume.
  type Resp = { session_id: string; competency_id: string; raw_score: number; is_reverse: boolean };
  const responses: Resp[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("behavioral_assessment_responses")
      .select("session_id, competency_id, raw_score, is_reverse")
      .in("session_id", sessionIds)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Resp[];
    responses.push(...rows);
    if (rows.length < PAGE) break;
  }
  if (responses.length === 0) {
    console.log("No responses found - nothing to norm.");
    return;
  }

  // 3. Person-level mean per (session, competency): each person contributes ONE
  //    value per competency, so a long test does not over-weight a person.
  const perSessionComp = new Map<string, number[]>(); // key `${session}|${comp}`
  for (const r of responses) {
    const eff = r.is_reverse ? 6 - Number(r.raw_score) : Number(r.raw_score);
    const k = `${r.session_id}|${r.competency_id}`;
    if (!perSessionComp.has(k)) perSessionComp.set(k, []);
    perSessionComp.get(k)!.push(eff);
  }
  const byComp = new Map<string, number[]>(); // competency_id -> person-level means
  for (const [k, vals] of perSessionComp) {
    const comp = k.split("|")[1];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (!byComp.has(comp)) byComp.set(comp, []);
    byComp.get(comp)!.push(mean);
  }

  // 4. Cross-person mean / sd / n per competency.
  type NormRow = { competency_id: string; mean: number; sd: number; n: number };
  const norms: NormRow[] = [];
  let minN = Infinity;
  for (const [comp, means] of byComp) {
    const n = means.length;
    const mean = means.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? means.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    const sd = Math.sqrt(variance);
    norms.push({
      competency_id: comp,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      n,
    });
    minN = Math.min(minN, n);
  }
  const isProvisional = minN < N_TARGET;

  // 5. Upsert the group, then the norms.
  const { data: group, error: gErr } = await sb
    .from("persona_norm_groups")
    .upsert(
      {
        code: GROUP_CODE,
        label_en: "GCC professionals 2026",
        label_ar: "محترفو دول الخليج 2026",
        is_provisional: isProvisional,
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  if (gErr || !group) throw gErr ?? new Error("group upsert failed");
  const groupId = group.id as string;

  const { error: nErr } = await sb
    .from("persona_competency_norms")
    .upsert(
      norms.map((r) => ({ norm_group_id: groupId, ...r })),
      { onConflict: "norm_group_id,competency_id" },
    );
  if (nErr) throw nErr;

  console.log(
    `Seeded '${GROUP_CODE}' (${groupId}) - ${norms.length} competencies, ` +
      `min n=${minN === Infinity ? 0 : minN}, provisional=${isProvisional}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
