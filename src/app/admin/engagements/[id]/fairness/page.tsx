import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Scale, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FOUR_FIFTHS, type DimensionResult } from "@/lib/prehire/adverse-impact";
import { computeAcFairness, AC_FAVOURABLE_LABELS, type AcFavourableOutcome } from "@/lib/ac/fairness";
import { acPurposeLabel } from "@/lib/constants/ac-purpose";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function DimensionTable({ dim }: { dim: DimensionResult }) {
  if (dim.groups.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{dim.label}</h3>
        <p className="text-sm text-muted-foreground">
          Nobody disclosed this, so there is nothing to compare.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{dim.label}</h3>
        <div className="flex items-center gap-2">
          {dim.anyAdverseImpact && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Below 4/5ths
            </Badge>
          )}
          {dim.underpowered && (
            <Badge variant="outline" className="text-muted-foreground">
              Too few people to be reliable
            </Badge>
          )}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead className="text-end">In pool</TableHead>
            <TableHead className="text-end">Favourable</TableHead>
            <TableHead className="text-end">Rate</TableHead>
            <TableHead className="text-end">Ratio to highest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dim.groups.map((g) => (
            <TableRow key={g.group} className={g.adverseImpact ? "bg-amber-50" : undefined}>
              <TableCell>
                {g.label}
                {g.isReference && <span className="ms-2 text-xs text-muted-foreground">reference</span>}
                {g.smallSample && <span className="ms-2 text-xs text-muted-foreground">small group</span>}
              </TableCell>
              <TableCell className="text-end tabular-nums">{g.n}</TableCell>
              <TableCell className="text-end tabular-nums">{g.selected}</TableCell>
              <TableCell className="text-end tabular-nums">{pct(g.selectionRate)}</TableCell>
              <TableCell className="text-end tabular-nums">
                {g.impactRatio == null ? "-" : g.impactRatio.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dim.notDisclosed > 0 && (
        <p className="text-xs text-muted-foreground">
          {dim.notDisclosed} participant{dim.notDisclosed === 1 ? "" : "s"} did not disclose this and {dim.notDisclosed === 1 ? "is" : "are"} in no
          group. Nothing is inferred about them.
        </p>
      )}
    </div>
  );
}

export default async function EngagementFairnessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { favourable?: string };
}) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const sb = createServiceClient();
  const { data: engagement } = await sb
    .from("engagements")
    .select("id, name, purpose, grouping_rationale, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!engagement) return notFound();

  const candidates = await fetchAllPages<Record<string, unknown>>((from, to) =>
    sb
      .from("candidates")
      .select("id, gender, age_band, nationality_group, demographics_submitted_at")
      .eq("engagement_id", params.id)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
  ).catch(() => [] as Record<string, unknown>[]);

  const oars = await fetchAllPages<Record<string, unknown>>((from, to) =>
    sb
      .from("overall_assessment_ratings")
      .select("candidate_id, recommendation")
      .eq("engagement_id", params.id)
      .order("candidate_id")
      .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
  ).catch(() => [] as Record<string, unknown>[]);
  const recById = new Map(oars.map((o) => [o.candidate_id as string, o.recommendation as string]));

  const favourable = (searchParams?.favourable === "ready_now_or_development"
    ? "ready_now_or_development"
    : "ready_now") as AcFavourableOutcome;

  const view = computeAcFairness(
    candidates.map((c) => ({
      gender: c.gender as string | null,
      age_band: c.age_band as string | null,
      nationality_group: c.nationality_group as string | null,
      demographics_submitted_at: c.demographics_submitted_at as string | null,
      recommendation: recById.get(c.id as string) ?? null,
    })),
    { purpose: engagement.purpose as string | null, favourable }
  );

  const org = engagement.organizations as unknown as { name?: string } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <BackLink href={`/admin/engagements/${params.id}`} label="Back to the engagement" />

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Fairness monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {engagement.name as string}
            {org?.name ? ` · ${org.name}` : ""} · {acPurposeLabel(engagement.purpose as string | null)} centre
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> What this is, and what it is not
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            For each demographic dimension this compares how often each group received a favourable outcome, takes
            the highest group as the reference, and flags any group falling below {pct(FOUR_FIFTHS)} of it - the
            four-fifths rule.
          </p>
          <p>
            A flag is a <strong className="text-foreground">reason to look</strong>, not a finding of
            discrimination. What it asks is whether the exercises and criteria are doing the job the role actually
            requires (4.22). Small numbers make these ratios unstable, which is said plainly where it applies.
          </p>
          <p>
            Demographics are volunteered by participants, never inferred, never used in scoring, never shown against
            an individual, and never exported.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">This centre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-2xl font-semibold">{view.participants}</div>
              <div className="text-xs text-muted-foreground">Participants</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{view.rated}</div>
              <div className="text-xs text-muted-foreground">With a finalised rating</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{view.disclosed}</div>
              <div className="text-xs text-muted-foreground">Gave any demographic detail</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">Count as favourable:</span>
            {(Object.keys(AC_FAVOURABLE_LABELS) as AcFavourableOutcome[]).map((k) => (
              <Link
                key={k}
                href={`/admin/engagements/${params.id}/fairness?favourable=${k}`}
                className={`rounded border px-2 py-1 text-xs ${
                  favourable === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {AC_FAVOURABLE_LABELS[k]}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The two readings can disagree, and that disagreement is itself informative: if one group is
            consistently rated &quot;ready with development&quot; where another is &quot;ready now&quot;, the strict
            reading shows it and the wider one hides it.
          </p>
        </CardContent>
      </Card>

      {view.report ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {view.report.dimensions.some((d) => d.anyAdverseImpact) ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Something to look at
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Nothing below the threshold
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {view.report.dimensions.map((d) => (
              <DimensionTable key={d.dimension} dim={d} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{view.reason}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Who was allocated here, and why</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {engagement.grouping_rationale ? (
            <p className="whitespace-pre-wrap">{engagement.grouping_rationale as string}</p>
          ) : (
            <p className="text-muted-foreground">
              Not recorded. The standard asks that the diversity of participants be taken into account when
              allocating them to centres and to groups within them, and that the reasoning be written down (5.37).
              It is recorded on the engagement.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
