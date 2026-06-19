import Link from "next/link";
import { ArrowLeft, Users, BookOpen, Headphones, PenLine, Mic, Award, Sparkles, Flag, MailCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { CEFR_ORDER, type CefrLevel } from "@/lib/ai/fluent-english";
import { computeIntegritySignal, type IntegrityFlags, type IntegritySignal } from "@/lib/scoring/integrity";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fluent · Cohort report (prototype)",
};

type Row = {
  id: string;
  created_at: string;
  taker_name: string | null;
  taker_email: string | null;
  overall_cefr: string;
  reading_cefr: string | null;
  listening_cefr: string | null;
  listening_total: number;
  writing_cefr: string | null;
  speaking_attempted: boolean;
  speaking_cefr: string | null;
  ai_scored: boolean;
  integrity_flags?: (IntegrityFlags & { signal?: IntegritySignal }) | null;
  email_sent_at?: string | null;
  organization?: { name: string } | { name: string }[] | null;
};

/** Resolve the (possibly array-shaped) joined org name. */
function orgName(r: Row): string | null {
  const o = r.organization;
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.name ?? null : o.name ?? null;
}

const CEFR_TONE: Record<string, string> = {
  A1: "bg-rose-100 text-rose-800 border-rose-300",
  A2: "bg-amber-100 text-amber-800 border-amber-300",
  B1: "bg-sky-100 text-sky-800 border-sky-300",
  B2: "bg-blue-100 text-blue-800 border-blue-300",
  C1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  C2: "bg-emerald-200 text-emerald-900 border-emerald-400",
};

const cefrToNum = (c: string): number => Math.max(0, CEFR_ORDER.indexOf(c as CefrLevel)) + 1;
const numToCefr = (n: number): CefrLevel =>
  CEFR_ORDER[Math.min(5, Math.max(0, Math.round(n) - 1))];

function avgBand(values: Array<string | null | undefined>): { band: CefrLevel; n: number } | null {
  const nums = values.filter((v): v is string => !!v && CEFR_ORDER.includes(v as CefrLevel)).map(cefrToNum);
  if (nums.length === 0) return null;
  return { band: numToCefr(nums.reduce((a, b) => a + b, 0) / nums.length), n: nums.length };
}

type LoadResp = { data: Row[] | null; error: unknown };

async function loadRows(): Promise<Row[] | null> {
  try {
    const sb = createServiceClient();
    const base =
      "id, created_at, taker_name, taker_email, overall_cefr, reading_cefr, listening_cefr, listening_total, writing_cefr, speaking_attempted, speaking_cefr, ai_scored";
    const query = (cols: string) =>
      sb.from("eng_fluent_results").select(cols).order("created_at", { ascending: false }).limit(500);

    // Graceful degradation across migrations: try with the client-org join
    // (00104), then the depth columns (00043), then the base (00042-only).
    let res = (await query(base + ", integrity_flags, email_sent_at, organization:organizations(name)")) as unknown as LoadResp;
    if (res.error) res = (await query(base + ", integrity_flags, email_sent_at")) as unknown as LoadResp;
    if (res.error) res = (await query(base)) as unknown as LoadResp;
    if (res.error) return null;
    return res.data ?? [];
  } catch {
    return null;
  }
}

export default async function FluentCohortPage({ searchParams }: { searchParams?: { org?: string } }) {
  const t = await getServerT("en"); // Fluent stays English regardless of locale cookie
  const allRows = await loadRows();
  const orgFilter = searchParams?.org?.trim() || null;
  const rows = allRows && orgFilter ? allRows.filter((r) => orgName(r) === orgFilter) : allRows;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href="/ac/fluent"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> {t("acFluent.backToFluent")}
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">{t("acFluent.cohortTitle")}</h1>
            <span className="ml-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              {t("acFluent.prototypeBadge")}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("acFluent.cohortSubtitle")}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {rows === null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{t("acFluent.cohortNoStoreTitle")}</strong> {t("acFluent.cohortNoStoreBodyPrefix")}{" "}
            <code className="text-xs">00042_eng_fluent_results.sql</code> {t("acFluent.cohortNoStoreBodySuffix")}
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
            {t("acFluent.cohortEmptyPrefix")}{" "}
            <Link href="/ac/fluent" className="text-[#5391D5] underline">
              {t("acFluent.cohortEmptyLink")}
            </Link>{" "}
            {t("acFluent.cohortEmptySuffix")}
          </div>
        )}

        {/* Client filter chips - org-scoped results (each voucher-redeemed run
            carries its client org). */}
        {allRows && allRows.length > 0 && (() => {
          const clientsList = Array.from(new Set(allRows.map(orgName).filter((n): n is string => !!n))).sort();
          if (clientsList.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Client:</span>
              <Link href="/ac/fluent/cohort" className={`rounded-full border px-2.5 py-0.5 ${!orgFilter ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                All
              </Link>
              {clientsList.map((c) => (
                <Link key={c} href={`/ac/fluent/cohort?org=${encodeURIComponent(c)}`} className={`rounded-full border px-2.5 py-0.5 ${orgFilter === c ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                  {c}
                </Link>
              ))}
            </div>
          );
        })()}

        {rows !== null && rows.length > 0 && <CohortBody rows={rows} t={t} />}
      </main>
    </div>
  );
}

function CohortBody({ rows, t }: { rows: Row[]; t: ServerT }) {
  const total = rows.length;
  const aiScored = rows.filter((r) => r.ai_scored).length;
  const speaking = rows.filter((r) => r.speaking_attempted).length;

  const overallAvg = avgBand(rows.map((r) => r.overall_cefr));
  const dist = CEFR_ORDER.map((c) => ({ cefr: c, n: rows.filter((r) => r.overall_cefr === c).length }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));

  const skillAverages = [
    { label: t("acFluent.skillReading"), icon: BookOpen, band: avgBand(rows.map((r) => r.reading_cefr)) },
    { label: t("acFluent.skillListening"), icon: Headphones, band: avgBand(rows.filter((r) => r.listening_total > 0).map((r) => r.listening_cefr)) },
    { label: t("acFluent.skillWriting"), icon: PenLine, band: avgBand(rows.map((r) => r.writing_cefr)) },
    { label: t("acFluent.skillSpeaking"), icon: Mic, band: avgBand(rows.filter((r) => r.speaking_attempted).map((r) => r.speaking_cefr)) },
  ];

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("acFluent.statTestsTaken")} value={String(total)} />
        <StatCard label={t("acFluent.statAverageLevel")} value={overallAvg ? overallAvg.band : "-"} tone={overallAvg?.band} />
        <StatCard label={t("acFluent.statAiScored")} value={`${aiScored}/${total}`} />
        <StatCard label={t("acFluent.statSpoke")} value={`${speaking}/${total}`} />
      </div>

      {/* CEFR distribution */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#010131]">
          <Sparkles className="h-4 w-4 text-[#5391D5]" /> {t("acFluent.cohortDistributionTitle")}
        </h2>
        <div className="space-y-2">
          {dist.map((d) => (
            <div key={d.cefr} className="flex items-center gap-3 text-xs">
              <span className={`w-9 shrink-0 rounded border px-1.5 py-0.5 text-center font-bold ${CEFR_TONE[d.cefr]}`}>
                {d.cefr}
              </span>
              <div className="flex-1 rounded-full bg-slate-100">
                <div
                  className="h-4 rounded-full bg-[#5391D5]"
                  style={{ width: `${(d.n / maxN) * 100}%`, minWidth: d.n > 0 ? "1.25rem" : "0" }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{d.n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Per-skill averages */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-[#010131]">{t("acFluent.cohortAverageBySkill")}</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {skillAverages.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 p-4 text-center">
              <s.icon className="mx-auto h-4 w-4 text-[#5391D5]" />
              <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className={`mt-1 inline-block rounded-md border px-2 text-xl font-bold ${s.band ? CEFR_TONE[s.band.band] : "text-slate-400"}`}>
                {s.band ? s.band.band : "-"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">{s.band ? t("acFluent.cohortAssessedCount", { count: s.band.n }) : t("acFluent.cohortNoData")}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent results */}
      <section className="rounded-xl border bg-white shadow-sm">
        <h2 className="border-b px-6 py-4 text-sm font-semibold text-[#010131]">{t("acFluent.cohortIndividualResults")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">{t("acFluent.colDate")}</th>
                <th className="px-4 py-2.5 font-medium">{t("acFluent.colName")}</th>
                <th className="px-4 py-2.5 font-medium">{t("acFluent.colEmail")}</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colOverall")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colReadingShort")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colListeningShort")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colWritingShort")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colSpeakingShort")}</th>
                <th className="px-3 py-2.5 text-center font-medium">{t("acFluent.colIntegrity")}</th>
                <th className="px-4 py-2.5 font-medium">{t("acFluent.colCertificate")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#111232]">{r.taker_name || <span className="text-slate-400">{t("acFluent.anonymous")}</span>}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      {r.taker_email || "-"}
                      {r.email_sent_at && <MailCheck className="h-3 w-3 text-emerald-600" />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{orgName(r) ?? <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-bold ${CEFR_TONE[r.overall_cefr] ?? ""}`}>{r.overall_cefr}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.reading_cefr ?? "-"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.listening_total > 0 ? r.listening_cefr ?? "-" : "-"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.writing_cefr ?? "-"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.speaking_attempted ? r.speaking_cefr ?? "-" : "-"}</td>
                  <td className="px-3 py-2.5 text-center">
                    {(() => {
                      // CAL-FLU-601: prefer the persisted advisory signal; recompute
                      // from raw flags for rows written before the signal was stored.
                      const flags = r.integrity_flags;
                      if (!flags) return <span className="text-slate-300">-</span>;
                      const sig = flags.signal ?? computeIntegritySignal(flags);
                      if (sig.tier === "clean" && sig.score === 0) return <span className="text-slate-300">-</span>;
                      const tone =
                        sig.tier === "elevated"
                          ? "bg-rose-50 text-rose-700"
                          : sig.tier === "minor"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700";
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
                          title={sig.reasons.join(" · ")}
                        >
                          <Flag className="h-3 w-3" />
                          {sig.score}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <a
                        href={`/api/ac/fluent/${r.id}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#010131] hover:underline"
                      >
                        <Award className="h-3.5 w-3.5" /> Full report
                      </a>
                      <a
                        href={`/api/ac/fluent/${r.id}/certificate`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                      >
                        {t("acFluent.openCertificate")}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ? `inline-block rounded-md border px-2 ${CEFR_TONE[tone]}` : "text-[#010131]"}`}>
        {value}
      </p>
    </div>
  );
}
