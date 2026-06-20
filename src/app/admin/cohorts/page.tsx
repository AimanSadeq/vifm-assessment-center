import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Layers, BrainCircuit, FileText } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { personaBand, personaBandLabel, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project cohorts" };

// Shared per-project cohort view (CAL-PER-406 / CAL-TM-303). Groups the two
// self-served instruments - Persona (behavioural self-report) and Cognitive
// (ability) - by the project/cohort label set on the voucher batch (migration
// 00137), and matches takers across the two instruments by email so one cohort
// reads as a single roster. Tolerant of 00137 not being applied: when the
// column is missing the project lists come back empty and the page explains it.

type PersonaRow = { name: string | null; email: string | null; overall: number | null; sessionId: string };
type CognitiveRow = { name: string | null; email: string | null; g: number | null; resultId: string };

function isMissingColumnError(err: { code?: string } | null | undefined): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

/** Distinct, non-null project labels across both instruments (newest activity first-ish). */
async function loadProjects(): Promise<{ labels: string[]; migrated: boolean }> {
  const sb = createServiceClient();
  const labels = new Set<string>();
  let migrated = true;
  const persona = await sb
    .from("behavioral_assessment_sessions")
    .select("project_label")
    .not("project_label", "is", null)
    .limit(2000);
  if (persona.error) {
    if (isMissingColumnError(persona.error)) migrated = false;
  } else {
    for (const r of persona.data ?? []) if (r.project_label) labels.add(r.project_label as string);
  }
  const cog = await sb
    .from("psy_results")
    .select("project_label")
    .eq("kind", "cognitive")
    .not("project_label", "is", null)
    .limit(2000);
  if (cog.error) {
    if (isMissingColumnError(cog.error)) migrated = false;
  } else {
    for (const r of cog.data ?? []) if (r.project_label) labels.add(r.project_label as string);
  }
  return { labels: Array.from(labels).sort((a, b) => a.localeCompare(b)), migrated };
}

async function loadPersona(project: string): Promise<PersonaRow[]> {
  const sb = createServiceClient();
  const res = await sb
    .from("behavioral_assessment_sessions")
    .select("id, taker_name, taker_email, status")
    .eq("project_label", project)
    .eq("status", "submitted")
    .order("created_at", { ascending: false })
    .limit(500);
  if (res.error || !res.data) return [];
  const sessions = res.data as { id: string; taker_name: string | null; taker_email: string | null }[];
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const { data: responses } = await sb
    .from("behavioral_assessment_responses")
    .select("session_id, raw_score, is_reverse")
    .in("session_id", ids);
  const bySession = new Map<string, number[]>();
  for (const r of responses ?? []) {
    const raw = Number(r.raw_score);
    const v = r.is_reverse ? 6 - raw : raw;
    const sid = r.session_id as string;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(v);
  }
  return sessions.map((s) => {
    const vals = bySession.get(s.id) ?? [];
    const overall = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
    return { name: s.taker_name, email: s.taker_email, overall, sessionId: s.id };
  });
}

async function loadCognitive(project: string): Promise<CognitiveRow[]> {
  const sb = createServiceClient();
  const res = await sb
    .from("psy_results")
    .select("id, taker_name, taker_email, overall, scales")
    .eq("kind", "cognitive")
    .eq("project_label", project)
    .order("created_at", { ascending: false })
    .limit(500);
  if (res.error || !res.data) return [];
  type R = {
    id: string; taker_name: string | null; taker_email: string | null;
    overall: { normalized?: number } | null;
    scales: { normalized?: number }[] | null;
  };
  return (res.data as R[]).map((r) => {
    let g: number | null = null;
    if (r.overall && typeof r.overall.normalized === "number") g = r.overall.normalized;
    else if (r.scales && r.scales.length) {
      g = Math.round(r.scales.reduce((a, s) => a + (s.normalized ?? 0), 0) / r.scales.length);
    }
    return { name: r.taker_name, email: r.taker_email, g, resultId: r.id };
  });
}

function gBandTone(g: number): string {
  if (g >= 80) return "bg-emerald-200 text-emerald-900";
  if (g >= 65) return "bg-emerald-100 text-emerald-800";
  if (g >= 45) return "bg-sky-100 text-sky-800";
  if (g >= 30) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default async function ProjectCohortsPage({ searchParams }: { searchParams?: { project?: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const { labels, migrated } = await loadProjects();
  const selected = searchParams?.project?.trim() || null;
  const persona = selected ? await loadPersona(selected) : [];
  const cognitive = selected ? await loadCognitive(selected) : [];

  // Combined roster matched by lowercased email; rows without an email are kept
  // as their own entries (cannot be cross-matched across instruments).
  type Combined = { key: string; name: string | null; email: string | null; persona: PersonaRow | null; cognitive: CognitiveRow | null };
  const byKey = new Map<string, Combined>();
  const keyFor = (email: string | null, fallback: string) =>
    email ? `e:${email.trim().toLowerCase()}` : `x:${fallback}`;
  for (const p of persona) {
    const k = keyFor(p.email, `p:${p.sessionId}`);
    byKey.set(k, { key: k, name: p.name, email: p.email, persona: p, cognitive: null });
  }
  for (const c of cognitive) {
    const k = keyFor(c.email, `c:${c.resultId}`);
    const ex = byKey.get(k);
    if (ex) {
      ex.cognitive = c;
      ex.name = ex.name ?? c.name;
    } else {
      byKey.set(k, { key: k, name: c.name, email: c.email, persona: null, cognitive: c });
    }
  }
  const combined = Array.from(byKey.values());

  const personaAvg = (() => {
    const v = persona.map((p) => p.overall).filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
  })();
  const cogAvg = (() => {
    const v = cognitive.map((c) => c.g).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  })();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <BackLink href="/admin" label="Admin" history />
      <header>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#5391D5]" />
          <h1 className="text-2xl font-semibold text-[#010131]">Project cohorts</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Persona (behavioural self-report) and Mentium (ability) results for one cohort, grouped by
          the project label set when the voucher batch was issued and matched across instruments by email.
        </p>
      </header>

      {!migrated && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Project labels not enabled yet.</strong> Apply migration{" "}
          <code className="text-xs">00137_project_cohort_label.sql</code>, then issue Persona / Mentium
          voucher batches with a project name to populate this view.
        </div>
      )}

      {migrated && labels.length === 0 && (
        <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No project cohorts yet. Set a <strong>Project / cohort</strong> name when issuing a Persona or
          Mentium voucher batch to group those runs here.
        </div>
      )}

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Project:</span>
          {labels.map((l) => (
            <Link
              key={l}
              href={`/admin/cohorts?project=${encodeURIComponent(l)}`}
              className={`rounded-full border px-2.5 py-0.5 ${selected === l ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="People in cohort" value={String(combined.length)} />
            <StatCard label="Persona taken" value={String(persona.length)} />
            <StatCard label="Mentium taken" value={String(cognitive.length)} />
            <StatCard
              label="Both instruments"
              value={String(combined.filter((c) => c.persona && c.cognitive).length)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <Layers className="h-3.5 w-3.5 text-[#5391D5]" /> Persona avg self-rating
              </p>
              <p className="mt-1 text-2xl font-bold text-[#010131]">
                {personaAvg != null ? personaAvg.toFixed(2) : <span className="text-slate-300">-</span>}
                {personaAvg != null && (
                  <span className={`ml-2 rounded px-1.5 py-0.5 align-middle text-xs font-medium ${PERSONA_BAND_TW[personaBand(personaAvg).key]}`}>
                    {personaBandLabel(personaAvg, false)}
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <BrainCircuit className="h-3.5 w-3.5 text-[#5391D5]" /> Mentium avg (g)
              </p>
              <p className="mt-1 text-2xl font-bold text-[#010131]">
                {cogAvg != null ? `${cogAvg}%` : <span className="text-slate-300">-</span>}
              </p>
            </div>
          </div>

          <section className="rounded-xl border bg-white shadow-sm">
            <h2 className="border-b px-6 py-4 text-sm font-semibold text-[#010131]">Cohort roster</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-3 py-2.5 text-center font-medium">Persona</th>
                    <th className="px-3 py-2.5 text-center font-medium">Mentium (g)</th>
                    <th className="px-4 py-2.5 font-medium">Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map((row) => (
                    <tr key={row.key} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-[#111232]">{row.name || <span className="text-slate-400">Anonymous</span>}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.email || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 text-center">
                        {row.persona?.overall != null ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${PERSONA_BAND_TW[personaBand(row.persona.overall).key]}`}>
                            {row.persona.overall.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.cognitive?.g != null ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${gBandTone(row.cognitive.g)}`}>
                            {row.cognitive.g}%
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {row.persona && (
                            <a
                              href={`/api/ac/persona/${row.persona.sessionId}/report`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" /> Persona
                            </a>
                          )}
                          {row.cognitive && (
                            <a
                              href={`/api/ac/cognitive/${row.cognitive.resultId}/report`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" /> Mentium
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">
            These are indicative self-served instruments. Persona is a behavioural self-report; Mentium
            Tier 1 bands are raw-score based, not local norms. Pair with Reflect 360 (others) and a target
            role for a readiness verdict.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#010131]">{value}</p>
    </div>
  );
}
