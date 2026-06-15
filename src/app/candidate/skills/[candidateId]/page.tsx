export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireCandidateAccess } from "@/lib/auth/candidate-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { GapBadge } from "@/components/shared/gap-badge";
import { getCompetencyGap } from "@/lib/scoring/competency-gap";
import { buildUnifiedProfile, signalToneClass, relationMeta, type CompetencySignal } from "@/lib/competencies/unified-profile";
import { Target, AlertTriangle, CheckCircle2, BookOpen, Route, Languages, Award, GraduationCap, Layers } from "lucide-react";
import { PersonalStatistics, type DomainRollup } from "./_components/personal-statistics";
import { StartQuizButton } from "./_components/start-quiz-button";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";

type Props = {
  params: { candidateId: string };
  searchParams?: { asAdmin?: string };
};

type RoleProfileCompetencyRow = {
  competency_id: string;
  weight: number | null;
  priority: "high" | "medium" | "low" | null;
  competencies: {
    id: string;
    name: string;
    name_ar: string | null;
    description: string | null;
    cluster_id: string;
    competency_clusters: {
      id: string;
      name: string;
      name_ar: string | null;
      sort_order: number;
      domain_id: string;
      competency_domains: {
        id: string;
        name: string;
        name_ar: string | null;
        sort_order: number;
      } | null;
    } | null;
  } | null;
};

type DomainGroup = {
  id: string;
  name: string;
  sort_order: number;
  competencies: {
    id: string;
    name: string;
    name_ar: string | null;
    description: string | null;
    clusterName: string;
    clusterName_ar: string | null;
    target: number;
    score: number | null;
  }[];
};

export default async function CandidateSkillsPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";
  const { candidateId } = params;
  const asAdmin = searchParams?.asAdmin === "1";

  await requireCandidateAccess(candidateId);

  const { data: candidate, error: candErr } = await supabase
    .from("candidates")
    .select("id, full_name, email, engagement_id")
    .eq("id", candidateId)
    .single();

  if (candErr || !candidate) return notFound();

  // Fluent English placement bound to this candidate (migration 00044).
  // Read via the service client - eng_fluent_results RLS is admin-only, and
  // the candidate context is already established above. Tolerant: stays null
  // if the table/columns aren't migrated or no placement exists.
  type FluentLite = { id: string; overall_cefr: string; candidate_id: string | null; created_at: string };
  let latestFluent: FluentLite | null = null;
  try {
    const svc = createServiceClient();
    const fres = (await svc
      .from("eng_fluent_results")
      .select("id, overall_cefr, candidate_id, created_at")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1)) as unknown as { data: FluentLite[] | null; error: unknown };
    if (!fres.error && Array.isArray(fres.data)) {
      latestFluent = fres.data[0] ?? null;
    }
  } catch {
    /* table/columns absent - ignore */
  }

  // Unified competency profile: Fluent's Language Skills framework + the
  // "enables" bridge onto behavioural competencies (Reflect/ARA/Pre-Hire next).
  const unified = await buildUnifiedProfile({ candidateId, email: candidate.email });

  // Role profile is fetched separately so the page still renders if migration
  // 00016 hasn't been pushed (the join would otherwise 500). Falls through to
  // the "No Position Assigned" empty state when the column or row is missing.
  type RoleProfileRow = {
    id: string;
    name_en: string;
    name_ar: string | null;
    target_role: string | null;
    default_target_proficiency: number | null;
  };
  let profile: RoleProfileRow | null = null;
  let migrationMissing = false;
  const candWithProfile = await supabase
    .from("candidates")
    .select(
      "role_profile_id, role_profiles(id, name_en, name_ar, target_role, default_target_proficiency)"
    )
    .eq("id", candidateId)
    .single();
  if (candWithProfile.error) {
    // 42703 = undefined_column; tolerate so dev can run before db push.
    if (candWithProfile.error.code === "42703") migrationMissing = true;
    else console.error("[candidate/skills] role profile fetch failed:", candWithProfile.error);
  } else {
    profile = (candWithProfile.data?.role_profiles as unknown as RoleProfileRow | null) ?? null;
  }

  // Empty state - no role profile assigned
  if (!profile) {
    return (
      <div className="space-y-6">
        {asAdmin && (
          <ImpersonationBanner
            candidateName={candidate.full_name}
            candidateEmail={candidate.email}
            exitHref={`/admin/engagements/${candidate.engagement_id}`}
          />
        )}
        <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label={t("candidateSkills.backToWelcome")} />
        <div>
          <h1 className="mt-2 text-2xl font-bold">{t("candidateSkills.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("candidateSkills.rolePlaceholder", { name: candidate.full_name })}
          </p>
        </div>
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="font-medium">{t("candidateSkills.noProfileTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("candidateSkills.noProfileBody")}
            </p>
            {migrationMissing && (
              <p className="text-[11px] text-muted-foreground max-w-md">
                {t("candidateSkills.migrationMissing")}
              </p>
            )}
            <Link href={`/candidate/welcome/${candidateId}`} className="mt-2">
              <Button variant="outline" size="sm">
                {t("candidateSkills.backToWelcome")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const target = profile.default_target_proficiency ?? 3;

  const [profileCompsResult, consensusResult] = await Promise.all([
    supabase
      .from("role_profile_competencies")
      .select(
        "competency_id, weight, priority, competencies(id, name, name_ar, description, cluster_id, competency_clusters(id, name, name_ar, sort_order, domain_id, competency_domains(id, name, name_ar, sort_order)))"
      )
      .eq("role_profile_id", profile.id),
    supabase
      .from("consensus_ratings")
      .select("competency_id, final_score")
      .eq("candidate_id", candidateId),
  ]);

  const profileComps = (profileCompsResult.data ?? []) as unknown as RoleProfileCompetencyRow[];
  const consensus = consensusResult.data ?? [];
  const scoreById = new Map(
    consensus.map((r) => [r.competency_id as string, r.final_score as number])
  );

  // Roll up by domain
  const domainMap = new Map<string, DomainGroup>();
  for (const row of profileComps) {
    const comp = row.competencies;
    if (!comp) continue;
    const cluster = comp.competency_clusters;
    const domain = cluster?.competency_domains;
    if (!cluster || !domain) continue;

    let group = domainMap.get(domain.id);
    if (!group) {
      group = {
        id: domain.id,
        name: domain.name,
        sort_order: domain.sort_order,
        competencies: [],
      };
      domainMap.set(domain.id, group);
    }
    group.competencies.push({
      id: comp.id,
      name: comp.name,
      name_ar: comp.name_ar,
      description: comp.description,
      clusterName: cluster.name,
      clusterName_ar: cluster.name_ar,
      target,
      score: scoreById.get(comp.id) ?? null,
    });
  }

  const domainGroups = Array.from(domainMap.values()).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  // Stats
  const total = profileComps.length;
  const assessedScores = profileComps
    .map((r) => (r.competencies ? scoreById.get(r.competencies.id) : undefined))
    .filter((s): s is number => typeof s === "number");
  const assessed = assessedScores.length;
  const withGaps = assessedScores.filter((s) => s < target).length;
  const average =
    assessed > 0
      ? Math.round((assessedScores.reduce((a, b) => a + b, 0) / assessed) * 10) /
        10
      : null;

  // Per-domain rollup for the H2 personal-statistics charts.
  // Iterating domainGroups instead of recomputing keeps the order consistent
  // with the cards rendered above (THINKING -> RESULTS -> PEOPLE -> SELF).
  const byDomain: DomainRollup[] = domainGroups.map((g) => {
    const scores = g.competencies
      .map((c) => c.score)
      .filter((s): s is number => typeof s === "number");
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
    return { name: g.name, count: g.competencies.length, avgScore };
  });

  const profileLabel = profile.name_en;
  const profileSubLabel =
    profile.target_role && profile.target_role !== profile.name_en
      ? profile.target_role
      : null;

  return (
    <div className="space-y-6">
      {asAdmin && (
        <ImpersonationBanner
          candidateName={candidate.full_name}
          candidateEmail={candidate.email}
          exitHref={`/admin/engagements/${candidate.engagement_id}`}
        />
      )}
      <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label={t("candidateSkills.backToWelcome")} />

      <div>
        <h1 className="mt-2 text-2xl font-bold">{t("candidateSkills.title")}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          <span className="font-medium">{profileLabel}</span>
          {profileSubLabel && <span>· {profileSubLabel}</span>}
          {profile.name_ar && (
            <span dir="rtl" className="text-xs">
              · {profile.name_ar}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/candidate/pathway/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}
          className="inline-flex items-center gap-2 rounded-md bg-[#5391D5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4380c4]"
        >
          <Route className="h-4 w-4" /> {t("candidateSkills.buildPathway")}
        </Link>
        <Link
          href={`/candidate/academy?candidateId=${candidateId}${asAdmin ? "&asAdmin=1" : ""}`}
          className="inline-flex items-center gap-2 rounded-md border border-[#5391D5] px-4 py-2 text-sm font-medium text-[#010131] hover:bg-[#5391D5]/10"
        >
          <GraduationCap className="h-4 w-4 text-[#5391D5]" /> {t("candidateSkills.myLearning")}
        </Link>
        <Link
          href={`/candidate/behavioral/${candidateId}`}
          className="inline-flex items-center gap-2 rounded-md border border-[#5391D5] px-4 py-2 text-sm font-medium text-[#010131] hover:bg-[#5391D5]/10"
        >
          <Layers className="h-4 w-4 text-[#5391D5]" /> {t("candidateSkills.selfAssessment")}
        </Link>
      </div>

      {/* Language Skills (Fluent) — a framework of its own; each skill enables
          specific behavioural competencies (shown as ↳ chips on the cards below). */}
      {(latestFluent || unified.languageSkills.length > 0) && (
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 text-[#5391D5]" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("candidateSkills.englishPlacement")}
              </p>
              {latestFluent && <p className="text-lg font-bold">{latestFluent.overall_cefr}</p>}
            </div>
            {latestFluent && (
              <a
                href={`/api/ac/fluent/${latestFluent.id}/certificate?format=pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
              >
                <Award className="h-3.5 w-3.5" /> {t("candidateSkills.certificate")}
              </a>
            )}
          </div>
          {unified.languageSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {unified.languageSkills.map((s) => (
                <span
                  key={s.key}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${signalToneClass("language")}`}
                >
                  {s.label} · {s.cefr}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Technical Capabilities — the third framework (assessment + Academy evidence) */}
      {unified.technical.length > 0 && (
        <div className="space-y-2 rounded-md border bg-card p-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#5391D5]" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Technical capabilities</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unified.technical.map((tech) => (
              <span
                key={tech.domainKey}
                title={tech.source === "assessment" ? "Technical assessment" : "Academy completion (evidence)"}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800"
              >
                {tech.domainName} · {tech.display}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Indicative technical proficiency — measured by the technical assessment, with Academy completions as evidence.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t("candidateSkills.totalSkills")} value={total} />
        <StatCard
          label={t("candidateSkills.assessed")}
          value={assessed}
          sub={t("candidateSkills.assessedOf", { total })}
        />
        <StatCard
          label={t("candidateSkills.skillsWithGaps")}
          value={withGaps}
          tone={withGaps > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label={t("candidateSkills.averageScore")}
          value={average !== null ? `${average}/5` : "-"}
          sub={average === null ? t("candidateSkills.notYetAssessed") : undefined}
        />
      </div>

      {/* Skill cards grouped by domain */}
      {domainGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("candidateSkills.noCompetencies")}
          </CardContent>
        </Card>
      ) : (
        domainGroups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="uppercase tracking-wide text-xs text-muted-foreground">
                  {t("candidateSkills.domainEyebrow")}
                </span>
                <span>{t(`domainNames.${group.name}`)}</span>
                <Badge variant="secondary" className="ms-auto">
                  {group.competencies.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.competencies.map((comp) => {
                  const gap = getCompetencyGap(comp.score ?? undefined, comp.target);
                  const isAssessed = comp.score !== null;
                  return (
                    <div
                      key={comp.id}
                      className="rounded-md border p-3 flex flex-col gap-2 bg-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm leading-tight">
                            {localizedName(comp, rtl)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {localizedName({ name: comp.clusterName, name_ar: comp.clusterName_ar }, rtl)}
                          </p>
                        </div>
                        {isAssessed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          {t("candidateSkills.targetLabel")}{" "}
                          <span className="font-semibold text-foreground">
                            {t("candidateSkills.level", { n: comp.target })}
                          </span>
                        </span>
                        <span>
                          {t("candidateSkills.currentLabel")}{" "}
                          <span className="font-semibold text-foreground">
                            {isAssessed && comp.score !== null
                              ? t("candidateSkills.level", { n: comp.score })
                              : "-"}
                          </span>
                        </span>
                      </div>

                      {/* Unified signals — behavioural rating (AC, ●) + cross-framework
                          enablers (↳ enables) + foundation predictors (⤳ predicts). */}
                      {(comp.score != null || (unified.competencySignals.get(comp.name.toLowerCase())?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {comp.score != null && (
                            <span
                              title="Assessment Center (behavioural)"
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${signalToneClass("behavioural")}`}
                            >
                              AC · {comp.score}/5
                            </span>
                          )}
                          {(unified.competencySignals.get(comp.name.toLowerCase()) ?? []).map((s: CompetencySignal, i: number) => {
                            const rel = relationMeta(s.relation);
                            return (
                              <span
                                key={i}
                                title={`${s.sourceLabel} — ${rel.label} this competency${rel.predicted ? " (predicted, not measured)" : ""}`}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${signalToneClass(s.kind)}`}
                              >
                                {rel.glyph} {s.sourceLabel} · {s.display}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-auto">
                        {isAssessed && gap ? (
                          <GapBadge
                            score={comp.score ?? undefined}
                            target={comp.target}
                            variant="short"
                          />
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {t("candidateSkills.notAssessedBadge")}
                          </span>
                        )}
                      </div>

                      <StartQuizButton candidateId={candidateId} competencyId={comp.id} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* H2: personal statistics charts */}
      {domainGroups.length > 0 && (
        <PersonalStatistics
          assessed={assessed}
          notAssessed={total - assessed}
          byDomain={byDomain}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "warning";
}) {
  const toneClasses =
    tone === "warning"
      ? "bg-amber-50 border-amber-200"
      : "bg-card";
  return (
    <div className={`rounded-md border p-4 ${toneClasses}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
