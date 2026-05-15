import Link from "next/link";
import { ArrowLeft, FileClock, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { purgeAraExpiredAssessments } from "@/lib/ara/admin-actions";

export const dynamic = "force-dynamic";

const RETENTION_YEARS = 3;

export default async function AraRetentionPage() {
  const sb = createServiceClient();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const cutoffIso = cutoff.toISOString();

  const { data: expired } = await sb
    .from("ara_assessments")
    .select("id, archived_at, region, sector, assessment_year, organization:ara_organizations(name)")
    .eq("status", "archived")
    .lt("archived_at", cutoffIso)
    .order("archived_at", { ascending: true });

  const { data: dueSoon } = await sb
    .from("ara_assessments")
    .select("id, archived_at, organization:ara_organizations(name)")
    .eq("status", "archived")
    .gte("archived_at", cutoffIso);

  const list = (expired ?? []) as unknown as Array<{
    id: string;
    archived_at: string;
    region: string;
    sector: string;
    assessment_year: number;
    organization: { name: string } | null;
  }>;

  const dueSoonList = (dueSoon ?? []) as unknown as Array<{
    id: string;
    archived_at: string;
    organization: { name: string } | null;
  }>;

  const purgeAction = async (fd: FormData) => {
    "use server";
    await purgeAraExpiredAssessments(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA Admin
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <FileClock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold text-primary">Data retention</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Assessments archived more than {RETENTION_YEARS} years ago are due for
          deletion per UAE PDPL / Saudi PDPL / GDPR retention rules. Generated
          reports are retained as VIFM business records.
        </p>

        {/* Cron status banner — surfaces whether the daily auto-purge is
            actually wired up. The cron route at /api/ara/admin/retention/cron
            returns 503 unless CRON_SECRET is set in the runtime env, so the
            check below mirrors that gate. Without the env var the manual
            purge form below still works; it's only the automated daily
            execution that's gated. */}
        <CronStatusBanner cronSecretConfigured={!!process.env.CRON_SECRET} />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Expired - ready to purge</CardTitle>
            <CardDescription>
              {list.length} archived assessment{list.length === 1 ? "" : "s"} older than {RETENTION_YEARS} years.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to purge.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Archived</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.organization?.name ?? "-"}</TableCell>
                      <TableCell>{e.assessment_year}</TableCell>
                      <TableCell className="uppercase">{e.region}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.archived_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Coming up for retention review</CardTitle>
            <CardDescription>
              Archived but still within the {RETENTION_YEARS}-year window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dueSoonList.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {dueSoonList.map((d) => {
                  const archived = new Date(d.archived_at);
                  const purgeAt = new Date(archived);
                  purgeAt.setFullYear(purgeAt.getFullYear() + RETENTION_YEARS);
                  return (
                    <li key={d.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{d.organization?.name ?? "-"}</span>
                      {" - archived "}{archived.toLocaleDateString()}
                      {", purges after "}{purgeAt.toLocaleDateString()}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Purge expired assessments
            </CardTitle>
            <CardDescription>
              Hard-deletes the {list.length} expired assessment{list.length === 1 ? "" : "s"} above
              and cascades to all children. Generated reports detach first (retained
              as business records). Action is logged in <code>ara_data_management_log</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={purgeAction} className="flex items-end gap-3">
              <div className="space-y-1 flex-1 max-w-md">
                <Label htmlFor="confirmation" className="text-xs">
                  Type <code>PURGE EXPIRED DATA</code> to confirm
                </Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  required
                  placeholder="PURGE EXPIRED DATA"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="destructive" disabled={list.length === 0}>
                Purge {list.length}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cron status banner — non-destructive UI affordance that surfaces
// whether the daily auto-purge is actually wired up. Two states:
//
//   CRON_SECRET set  → green banner "Daily auto-purge is active.
//                       Next run 03:00 UTC."
//   CRON_SECRET not  → amber banner with the one-line ops
//                       instruction (set the env var in Vercel),
//                       so this doesn't get forgotten between
//                       project hand-off and production launch.
//
// Inert in dev because process.env.CRON_SECRET will not be set
// locally — same as production-without-it. The amber state shows
// in both. That's intentional: the banner is a checklist item.
// ─────────────────────────────────────────────────────────────
function CronStatusBanner({ cronSecretConfigured }: { cronSecretConfigured: boolean }) {
  if (cronSecretConfigured) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-950">
            Daily auto-purge is active
          </p>
          <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
            GitHub Actions fires{" "}
            <code className="font-mono">.github/workflows/ara-retention-purge.yml</code>{" "}
            daily at 03:00 UTC, which hits{" "}
            <code className="font-mono">/api/ara/admin/retention/cron</code> with the
            configured <code className="font-mono">CRON_SECRET</code>. The manual{" "}
            <em>Purge</em> form below remains available as an override.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-700 font-semibold shrink-0">
          <Clock className="h-3 w-3" /> 03:00 UTC daily
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-950">
          Daily auto-purge is currently disabled
        </p>
        <p className="text-xs text-amber-900 mt-1 leading-relaxed">
          The retention-purge cron at{" "}
          <code className="font-mono">/api/ara/admin/retention/cron</code> is gated by
          a <code className="font-mono">CRON_SECRET</code> bearer header, and that env
          var is not set in the current runtime. Until it is, the cron route returns
          503 (intentional kill-switch — prevents accidental purges from a stray
          browser fetch). The manual <em>Purge</em> form below still works.
        </p>
        <details className="mt-2 text-xs text-amber-900">
          <summary className="cursor-pointer font-medium">How to enable in production</summary>
          <ol className="mt-2 list-decimal ms-5 space-y-1">
            <li>
              Generate a long random string (32+ chars), e.g.{" "}
              <code className="font-mono">openssl rand -hex 32</code>
            </li>
            <li>
              Render dashboard → vifm-assessment-center → Environment → add{" "}
              <code className="font-mono">CRON_SECRET</code> with that value, then
              trigger a deploy so the route can verify the bearer.
            </li>
            <li>
              GitHub repo → Settings → Secrets and variables → Actions → add{" "}
              <code className="font-mono">CRON_SECRET</code> with the SAME value.
            </li>
            <li>
              Optional: Actions tab →{" "}
              <code className="font-mono">ARA · retention purge</code> → Run workflow,
              to verify end-to-end before waiting for the next 03:00 UTC fire.
            </li>
          </ol>
          <p className="mt-2">
            Once both env vars are set, the GitHub Actions workflow attaches the bearer
            header on every scheduled invocation; this banner flips green on the next
            page load.
          </p>
        </details>
      </div>
    </div>
  );
}
