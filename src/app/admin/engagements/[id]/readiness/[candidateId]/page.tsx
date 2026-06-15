export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, Gauge, ShieldAlert, Eye, EyeOff, Clock, AlertTriangle, Users } from "lucide-react";
import { computeCandidateReadiness } from "@/lib/scoring/readiness-data";
import { READINESS_TIER_META, type SelfAwarenessFlag } from "@/lib/scoring/readiness";
import { GenerateIdpButton } from "./_components/generate-idp-button";

type Props = { params: { id: string; candidateId: string } };

const TIER_TONE: Record<string, { chip: string; ring: string }> = {
  emerald: { chip: "bg-emerald-100 text-emerald-800 border-emerald-300", ring: "border-emerald-300" },
  sky: { chip: "bg-sky-100 text-sky-800 border-sky-300", ring: "border-sky-300" },
  amber: { chip: "bg-amber-100 text-amber-800 border-amber-300", ring: "border-amber-300" },
  rose: { chip: "bg-rose-100 text-rose-800 border-rose-300", ring: "border-rose-300" },
  slate: { chip: "bg-slate-100 text-slate-700 border-slate-300", ring: "border-slate-300" },
};

const FLAG_TONE: Record<Exclude<SelfAwarenessFlag, null>, string> = {
  blind_spot: "bg-rose-100 text-rose-800",
  hidden_strength: "bg-emerald-100 text-emerald-800",
  over_rater: "bg-amber-100 text-amber-800",
  under_rater: "bg-sky-100 text-sky-800",
  aligned: "bg-slate-100 text-slate-600",
};

export default async function ReadinessReportPage({ params }: Props) {
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";
  const sb = createServiceClient();

  const { data: cand } = await sb
    .from("candidates")
    .select("id, full_name, engagement_id, engagements(name)")
    .eq("id", params.candidateId)
    .maybeSingle();
  if (!cand || cand.engagement_id !== params.id) return notFound();
  const engName = Array.isArray(cand.engagements)
    ? cand.engagements[0]?.name ?? ""
    : (cand.engagements as { name: string } | null)?.name ?? "";

  const r = await computeCandidateReadiness(params.id, params.candidateId);
  const meta = READINESS_TIER_META[r.status];
  const tone = TIER_TONE[meta.tone];

  const flagLabel = (f: SelfAwarenessFlag) => (f ? t(`readinessReport.flag.${f}`) : "");
  const num = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));

  const blindSpots = r.competencies.filter((c) => c.selfFlag === "blind_spot");
  const hiddenStrengths = r.competencies.filter((c) => c.selfFlag === "hidden_strength");

  return (
    <div className="space-y-6" dir={rtl ? "rtl" : "ltr"}>
      <BackLink href={`/admin/engagements/${params.id}/talent-map`} label={t("readinessReport.back")} />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] p-5 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <TrendingUp className="h-8 w-8 shrink-0 text-[#5391D5]" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">{t("readinessReport.title")}</p>
            <h1 className="text-2xl font-bold leading-tight">{cand.full_name}</h1>
            <p className="mt-0.5 text-sm text-white/80">{engName}</p>
          </div>
        </div>
      </div>

      {/* Headline tier */}
      <Card className={`border ${tone.ring}`}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${tone.chip}`}>{meta.label}</span>
            {r.yearLabel && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {t("readinessReport.horizon")}: {r.yearLabel}
              </span>
            )}
            {r.borderline && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                title={r.borderlineNote ?? undefined}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {t("readinessReport.borderline")}
              </span>
            )}
          </div>
          <p className="pt-2 text-sm text-muted-foreground">{meta.blurb}</p>
          {r.borderline && r.borderlineNote && (
            <p className="text-[11px] text-amber-700">{t("readinessReport.borderlineHint")} - {r.borderlineNote}.</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Gauge className="h-4 w-4" />} label={t("readinessReport.weightedOthers")} value={num(r.weightedOthers)} />
            <Stat icon={<Target className="h-4 w-4" />} label={t("readinessReport.target")} value={num(r.weightedTarget)} />
            <Stat
              icon={<TrendingUp className="h-4 w-4" />}
              label={t("readinessReport.gap")}
              value={r.overallGap == null ? "—" : (r.overallGap >= 0 ? "+" : "") + r.overallGap.toFixed(2)}
            />
            <Stat
              icon={<Eye className="h-4 w-4" />}
              label={t("readinessReport.coverage")}
              value={`${(r.coveragePct * 100).toFixed(0)}% (${r.coveredCount}/${r.totalCount})`}
            />
          </div>
          {r.knockoutApplied && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-800">
              <ShieldAlert className="h-3.5 w-3.5" /> {t("readinessReport.knockoutCapped")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Self-awareness callouts */}
      {(blindSpots.length > 0 || hiddenStrengths.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <Callout
            icon={<EyeOff className="h-4 w-4 text-rose-600" />}
            title={t("readinessReport.blindSpotsTitle")}
            hint={t("readinessReport.blindSpotsHint")}
            names={blindSpots.map((c) => c.name)}
            empty={t("readinessReport.none")}
          />
          <Callout
            icon={<Eye className="h-4 w-4 text-emerald-600" />}
            title={t("readinessReport.hiddenStrengthsTitle")}
            hint={t("readinessReport.hiddenStrengthsHint")}
            names={hiddenStrengths.map((c) => c.name)}
            empty={t("readinessReport.none")}
          />
        </div>
      )}

      {/* Per-competency detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("readinessReport.detailTitle")}</CardTitle>
          {r.lowAgreementCount > 0 && (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <Users className="h-3.5 w-3.5" />
              {t("readinessReport.lowAgreementSummary", { count: r.lowAgreementCount })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 py-2 text-start">{t("readinessReport.colCompetency")}</th>
                  <th className="px-2 py-2 text-start">{t("readinessReport.colPriority")}</th>
                  <th className="px-2 py-2 text-end">{t("readinessReport.colOthers")}</th>
                  <th className="px-2 py-2 text-end">{t("readinessReport.colTarget")}</th>
                  <th className="px-2 py-2 text-end">{t("readinessReport.colGap")}</th>
                  <th className="px-2 py-2 text-end">{t("readinessReport.colSelf")}</th>
                  <th className="px-2 py-2 text-start">{t("readinessReport.colFlag")}</th>
                </tr>
              </thead>
              <tbody>
                {r.competencies.map((c) => (
                  <tr key={c.competencyId} className={`border-b last:border-0 ${!c.covered ? "opacity-60" : ""}`}>
                    <td className="px-2 py-2 font-medium text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {c.name}
                        {c.lowAgreement && (
                          <Users className="h-3.5 w-3.5 text-amber-600" aria-label={t("readinessReport.lowAgreement")}>
                            <title>{t("readinessReport.lowAgreement")}</title>
                          </Users>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{t(`readinessReport.priority.${c.priority}`)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{num(c.othersMean)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{c.target.toFixed(1)}</td>
                    <td
                      className={`px-2 py-2 text-end tabular-nums ${
                        c.gap == null ? "" : c.gap >= 0 ? "text-emerald-700" : c.gap <= -1 ? "text-rose-700" : "text-amber-700"
                      }`}
                    >
                      {c.gap == null ? "—" : (c.gap >= 0 ? "+" : "") + c.gap.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted-foreground">{num(c.selfMean)}</td>
                    <td className="px-2 py-2">
                      {c.knockoutTriggered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                          <ShieldAlert className="h-3 w-3" /> {t("readinessReport.flag.knockout")}
                        </span>
                      ) : c.selfFlag ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FLAG_TONE[c.selfFlag]}`}>
                          {flagLabel(c.selfFlag)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.status === "insufficient_data" && (
            <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {t("readinessReport.insufficientNote")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Slice 5 — readiness → IDP */}
      {r.status !== "insufficient_data" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("readinessReport.idpTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("readinessReport.idpDesc")}</p>
          </CardHeader>
          <CardContent>
            <GenerateIdpButton
              engagementId={params.id}
              candidateId={params.candidateId}
              labels={{
                generate: t("readinessReport.idpGenerate"),
                generating: t("readinessReport.idpGenerating"),
                open: t("readinessReport.idpOpen"),
                noParticipant: t("readinessReport.idpNoParticipant"),
                error: t("readinessReport.idpError"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-[#5391D5]">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-[#010131]">{value}</p>
    </div>
  );
}

function Callout({
  icon,
  title,
  hint,
  names,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  names: string[];
  empty: string;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      <ul className="mt-2 space-y-0.5">
        {names.length > 0 ? (
          names.map((n) => (
            <li key={n} className="text-xs text-foreground/90">
              {n}
            </li>
          ))
        ) : (
          <li className="text-xs text-muted-foreground">{empty}</li>
        )}
      </ul>
    </div>
  );
}
