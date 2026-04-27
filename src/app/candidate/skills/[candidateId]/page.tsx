export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { GapBadge } from "@/components/shared/gap-badge";
import { getCompetencyGap } from "@/lib/scoring/competency-gap";
import { Target, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";

type Props = { params: { candidateId: string } };

type RoleProfileCompetencyRow = {
  competency_id: string;
  weight: number | null;
  priority: "high" | "medium" | "low" | null;
  competencies: {
    id: string;
    name: string;
    description: string | null;
    cluster_id: string;
    competency_clusters: {
      id: string;
      name: string;
      sort_order: number;
      domain_id: string;
      competency_domains: {
        id: string;
        name: string;
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
    description: string | null;
    clusterName: string;
    target: number;
    score: number | null;
  }[];
};

export default async function CandidateSkillsPage({ params }: Props) {
  const supabase = await createClient();
  const { candidateId } = params;

  const { data: candidate, error: candErr } = await supabase
    .from("candidates")
    .select("id, full_name, engagement_id")
    .eq("id", candidateId)
    .single();

  if (candErr || !candidate) return notFound();

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

  // Empty state — no role profile assigned (matches Skillup's "No Position Assigned")
  if (!profile) {
    return (
      <div className="space-y-6">
        <BackLink href={`/candidate/welcome/${candidateId}`} label="Back to Welcome" />
        <div>
          <h1 className="mt-2 text-2xl font-bold">My Skills</h1>
          <p className="text-sm text-muted-foreground">
            Hello {candidate.full_name} — your skill map will appear here once a
            role profile has been assigned to you.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="font-medium">No Role Profile Assigned</p>
            <p className="text-sm text-muted-foreground max-w-md">
              An administrator hasn&apos;t linked you to a role profile yet, so
              there are no target proficiencies to compare your scores against.
              Check back after the assessment has been set up, or contact your
              VIFM facilitator if you think this is a mistake.
            </p>
            {migrationMissing && (
              <p className="text-[11px] text-muted-foreground max-w-md">
                Admin: run <code className="font-mono">npx supabase db push</code> to
                apply migration <code>00016</code> before binding candidates to role
                profiles.
              </p>
            )}
            <Link href={`/candidate/welcome/${candidateId}`} className="mt-2">
              <Button variant="outline" size="sm">
                Back to Welcome
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
        "competency_id, weight, priority, competencies(id, name, description, cluster_id, competency_clusters(id, name, sort_order, domain_id, competency_domains(id, name, sort_order)))"
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
      description: comp.description,
      clusterName: cluster.name,
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

  const profileLabel = profile.name_en;
  const profileSubLabel =
    profile.target_role && profile.target_role !== profile.name_en
      ? profile.target_role
      : null;

  return (
    <div className="space-y-6">
      <BackLink href={`/candidate/welcome/${candidateId}`} label="Back to Welcome" />

      <div>
        <h1 className="mt-2 text-2xl font-bold">My Skills</h1>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Skills" value={total} />
        <StatCard label="Assessed" value={assessed} sub={`of ${total}`} />
        <StatCard
          label="Skills with Gaps"
          value={withGaps}
          tone={withGaps > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Average Score"
          value={average !== null ? `${average}/5` : "—"}
          sub={average === null ? "Not yet assessed" : undefined}
        />
      </div>

      {/* Skill cards grouped by domain */}
      {domainGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This role profile has no competencies linked yet. Ask your administrator
            to populate the profile.
          </CardContent>
        </Card>
      ) : (
        domainGroups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="uppercase tracking-wide text-xs text-muted-foreground">
                  Domain
                </span>
                <span>{group.name}</span>
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
                            {comp.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {comp.clusterName}
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
                          Target: <span className="font-semibold text-foreground">Level {comp.target}</span>
                        </span>
                        <span>
                          Current:{" "}
                          <span className="font-semibold text-foreground">
                            {isAssessed ? `Level ${comp.score}` : "—"}
                          </span>
                        </span>
                      </div>

                      <div className="mt-auto">
                        {isAssessed && gap ? (
                          <GapBadge
                            score={comp.score ?? undefined}
                            target={comp.target}
                            variant="short"
                          />
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Not Assessed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
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
