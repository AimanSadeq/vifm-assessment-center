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
import { ARA_RETENTION_YEARS } from "@/lib/constants/ara-retention";
import { getServerT, type ServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// GOV-05: 2-year max per CLAUDE.md / PDPL (was 3). Shared single source of truth.
const RETENTION_YEARS = ARA_RETENTION_YEARS;

export default async function AraRetentionPage() {
  const sb = createServiceClient();
  const t = await getServerT();

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
          <ArrowLeft className="h-3 w-3" /> {t("araAdminData.back_to_ara_admin")}
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <FileClock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold text-primary">{t("araAdminData.ret_title")}</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          {t("araAdminData.ret_subtitle", { years: RETENTION_YEARS })}
        </p>

        {/* Cron status banner - surfaces whether the daily auto-purge is
            actually wired up. The cron route at /api/ara/admin/retention/cron
            returns 503 unless CRON_SECRET is set in the runtime env, so the
            check below mirrors that gate. Without the env var the manual
            purge form below still works; it's only the automated daily
            execution that's gated. */}
        <CronStatusBanner cronSecretConfigured={!!process.env.CRON_SECRET} t={t} />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("araAdminData.ret_expired_title")}</CardTitle>
            <CardDescription>
              {t(list.length === 1 ? "araAdminData.ret_expired_desc_one" : "araAdminData.ret_expired_desc_other", { count: list.length, years: RETENTION_YEARS })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAdminData.ret_nothing_to_purge")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAdminData.ret_col_organization")}</TableHead>
                    <TableHead>{t("araAdminData.ret_col_year")}</TableHead>
                    <TableHead>{t("araAdminData.ret_col_region")}</TableHead>
                    <TableHead>{t("araAdminData.ret_col_archived")}</TableHead>
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
            <CardTitle className="text-base">{t("araAdminData.ret_coming_up_title")}</CardTitle>
            <CardDescription>
              {t("araAdminData.ret_coming_up_desc", { years: RETENTION_YEARS })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dueSoonList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAdminData.ret_none")}</p>
            ) : (
              <ul className="text-sm space-y-1">
                {dueSoonList.map((d) => {
                  const archived = new Date(d.archived_at);
                  const purgeAt = new Date(archived);
                  purgeAt.setFullYear(purgeAt.getFullYear() + RETENTION_YEARS);
                  return (
                    <li key={d.id} className="text-xs text-muted-foreground">
                      {t("araAdminData.ret_due_line", {
                        name: d.organization?.name ?? "-",
                        archived: archived.toLocaleDateString(),
                        purgeAt: purgeAt.toLocaleDateString(),
                      })}
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
              <AlertTriangle className="h-4 w-4" /> {t("araAdminData.ret_purge_title")}
            </CardTitle>
            <CardDescription>
              {t(list.length === 1 ? "araAdminData.ret_purge_desc_one" : "araAdminData.ret_purge_desc_other", { count: list.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={purgeAction} className="flex items-end gap-3">
              <div className="space-y-1 flex-1 max-w-md">
                <Label htmlFor="confirmation" className="text-xs">
                  {t("araAdminData.ret_confirm_label_prefix")} <code>PURGE EXPIRED DATA</code> {t("araAdminData.ret_confirm_label_suffix")}
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
                {t("araAdminData.ret_purge_button", { count: list.length })}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cron status banner - non-destructive UI affordance that surfaces
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
// locally - same as production-without-it. The amber state shows
// in both. That's intentional: the banner is a checklist item.
// ─────────────────────────────────────────────────────────────
function CronStatusBanner({ cronSecretConfigured, t }: { cronSecretConfigured: boolean; t: ServerT }) {
  if (cronSecretConfigured) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-950">
            {t("araAdminData.ret_cron_active_title")}
          </p>
          <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
            {t("araAdminData.ret_cron_active_body_prefix")}{" "}
            <code className="font-mono">.github/workflows/ara-retention-purge.yml</code>{" "}
            {t("araAdminData.ret_cron_active_body_mid")}{" "}
            <code className="font-mono">/api/ara/admin/retention/cron</code> {t("araAdminData.ret_cron_active_body_with")}{" "}
            <code className="font-mono">CRON_SECRET</code>{t("araAdminData.ret_cron_active_body_suffix")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-700 font-semibold shrink-0">
          <Clock className="h-3 w-3" /> {t("araAdminData.ret_cron_active_badge")}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-950">
          {t("araAdminData.ret_cron_disabled_title")}
        </p>
        <p className="text-xs text-amber-900 mt-1 leading-relaxed">
          {t("araAdminData.ret_cron_disabled_body")}
        </p>
        <details className="mt-2 text-xs text-amber-900">
          <summary className="cursor-pointer font-medium">{t("araAdminData.ret_cron_how_to")}</summary>
          <ol className="mt-2 list-decimal ms-5 space-y-1">
            <li>
              {t("araAdminData.ret_cron_step1")}{" "}
              <code className="font-mono">openssl rand -hex 32</code>
            </li>
            <li>
              {t("araAdminData.ret_cron_step2")}{" "}
              <code className="font-mono">CRON_SECRET</code> {t("araAdminData.ret_cron_step2_suffix")}
            </li>
            <li>
              {t("araAdminData.ret_cron_step3")}{" "}
              <code className="font-mono">CRON_SECRET</code> {t("araAdminData.ret_cron_step3_suffix")}
            </li>
            <li>
              {t("araAdminData.ret_cron_step4")}{" "}
              <code className="font-mono">ARA · retention purge</code> {t("araAdminData.ret_cron_step4_suffix")}
            </li>
          </ol>
          <p className="mt-2">
            {t("araAdminData.ret_cron_closing")}
          </p>
        </details>
      </div>
    </div>
  );
}
