import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, ShieldCheck, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeComposite, rankByComposite } from "@/lib/prehire/scoring";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";
import { AddCandidateForm } from "./_components/add-candidate-form";
import { InviteLink } from "./_components/invite-link";
import { ClientReportCell } from "./_components/client-report-cell";
import { ClientReportControls } from "./_components/client-report-controls";

export const dynamic = "force-dynamic";

type StageResult = {
  kind: PrehireStageKind;
  status: string;
  normalized_score: number | null;
  passed: boolean | null;
};
type CandidateRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  access_token: string;
  prehire_stage_results: StageResult[];
};

const RECO_TONE: Record<string, string> = {
  advance: "bg-green-100 text-green-800 border-green-200",
  review: "bg-amber-100 text-amber-800 border-amber-200",
  hold: "bg-rose-100 text-rose-800 border-rose-200",
  incomplete: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function RequisitionDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const t = await getServerT();
  const locale = await getServerLocale();
  const statusLabel = (s: string) => {
    const v = t(`prehire.status.${s}`);
    return v.startsWith("prehire.status.") ? s : v;
  };

  const { data: req, error } = await supabase
    .from("prehire_requisitions")
    .select("id, title, level, status, english_required, stage_config, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <BackLink href="/admin/prehire" label={t("prehire.backToReqs")} />
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{t("prehire.loadErrorOne", { msg: error.message })}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {t("prehire.applyMigrationA")} <code>00050</code> {t("prehire.applyMigrationWith")} <code className="font-mono">npx supabase db push</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!req) notFound();

  const plan = (req.stage_config ?? []) as PrehireStagePlanEntry[];
  const orgName = (req.organizations as unknown as { name: string } | null)?.name ?? null;

  const { data: candData } = await supabase
    .from("prehire_candidates")
    .select("id, full_name, email, status, access_token, prehire_stage_results(kind, status, normalized_score, passed)")
    .eq("requisition_id", params.id);

  const candidates = (candData ?? []) as unknown as CandidateRow[];

  // Custom fields (00061) — separate best-effort read so a pre-migration DB
  // (no custom_fields column) can't error the select and empty the shortlist.
  const customById = new Map<string, Record<string, string>>();
  const { data: customData } = await supabase
    .from("prehire_candidates")
    .select("id, custom_fields")
    .eq("requisition_id", params.id);
  for (const r of (customData ?? []) as { id: string; custom_fields: Record<string, string> | null }[]) {
    if (r.custom_fields && typeof r.custom_fields === "object") customById.set(r.id, r.custom_fields);
  }

  // Report delivery (00063) — separate best-effort reads (tolerant pre-migration,
  // like custom_fields) so a missing column can't break the page or shortlist.
  const reportSentById = new Map<string, string>();
  const { data: sentData } = await supabase
    .from("prehire_candidates")
    .select("id, report_sent_at")
    .eq("requisition_id", params.id);
  for (const r of (sentData ?? []) as { id: string; report_sent_at: string | null }[]) {
    if (r.report_sent_at) reportSentById.set(r.id, r.report_sent_at);
  }
  let clientEmail: string | null = null;
  const { data: reqEmail } = await supabase
    .from("prehire_requisitions")
    .select("client_recipient_email")
    .eq("id", params.id)
    .maybeSingle();
  clientEmail = (reqEmail?.client_recipient_email as string | null) ?? null;

  const scored = candidates.map((c) => {
    const result = computeComposite(plan, c.prehire_stage_results ?? []);
    return { ...c, composite: result.composite, recommendation: result.recommendation, perStage: result.perStage };
  });
  const ranked = rankByComposite(scored);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <BackLink href="/admin/prehire" label={t("prehire.backToReqs")} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{req.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {orgName && <Badge variant="outline">{orgName}</Badge>}
            {req.level && <Badge variant="outline">{req.level}</Badge>}
            <Badge variant="outline">{statusLabel(req.status)}</Badge>
            {req.english_required && <Badge variant="secondary">{t("prehire.englishBadge")}</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("prehire.stagesPrefix")} {plan.map((s) => t(`prehire.stageLabels.${s.kind}`)).join(" · ") || t("prehire.stagesNone")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/prehire/${req.id}/fairness`}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            title={t("prehire.ttFairness")}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> {t("prehire.fairnessAudit")}
          </Link>
          <a
            href={`/api/admin/prehire/${req.id}/export?format=csv`}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            title={t("prehire.ttCsv")}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href={`/api/admin/prehire/${req.id}/export?format=json`}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            title={t("prehire.ttJson")}
          >
            <Download className="h-3.5 w-3.5" /> JSON
          </a>
        </div>
      </div>

      <AddCandidateForm requisitionId={req.id as string} />

      <ClientReportControls
        requisitionId={req.id as string}
        currentEmail={clientEmail}
        lang={locale === "ar" ? "ar" : "en"}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("prehire.shortlist", { n: ranked.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              {t("prehire.noCandidates")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("prehire.thCandidate")}</TableHead>
                  {plan.map((s) => (
                    <TableHead key={s.kind} className="text-center">
                      {t(`prehire.stageLabels.${s.kind}`)}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">{t("prehire.thComposite")}</TableHead>
                  <TableHead>{t("prehire.thAiSignal")}</TableHead>
                  <TableHead>{t("prehire.thClientReport")}</TableHead>
                  <TableHead className="text-end">{t("prehire.thActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                      {customById.get(c.id)?.employee_id && (
                        <div className="text-xs text-muted-foreground">
                          {t("prehire.employeeIdLabel")}: {customById.get(c.id)?.employee_id}
                        </div>
                      )}
                    </TableCell>
                    {plan.map((s) => {
                      const st = c.perStage.find((p) => p.kind === s.kind);
                      return (
                        <TableCell key={s.kind} className="text-center text-sm">
                          {st?.normalized == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={st.passed ? "text-green-700" : "text-rose-700"}>
                              {Math.round(st.normalized)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-semibold">
                      {c.composite == null ? "—" : c.composite}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          RECO_TONE[c.recommendation] ?? RECO_TONE.incomplete
                        }`}
                      >
                        {t(`prehire.reco.${c.recommendation}`)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ClientReportCell
                        candidateId={c.id}
                        sentAt={reportSentById.get(c.id) ?? null}
                        recipientSet={!!clientEmail}
                        lang={locale === "ar" ? "ar" : "en"}
                      />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`/api/admin/prehire/${req.id}/candidate/${c.id}/report?lang=${locale}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                          title={t("prehire.ttReport")}
                        >
                          <FileText className="h-3.5 w-3.5" /> {t("prehire.report")}
                        </a>
                        <InviteLink token={c.access_token} candidateId={c.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {t("prehire.signalNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
