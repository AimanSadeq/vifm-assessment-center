"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { copyToClipboard } from "@/lib/utils/clipboard";

type Result =
  | { ok: false; error: string }
  | { ok: true; respondentUrl: string; assessmentId: string; respondentId: string; emailed?: boolean };

type Props = {
  action: (fd: FormData) => Promise<Result>;
};

/**
 * Form for the consultant-side issuance of a deep-dive personal
 * assessment. On success, instead of navigating away, we render
 * the access URL inline so the consultant can copy it directly
 * to clipboard or follow it in a new tab.
 */
export function DeepDiveForm({ action }: Props) {
  const { t } = useTranslation();
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [region, setRegion] = useState<"uae" | "saudi">("uae");
  const [issued, setIssued] = useState<{
    respondentUrl: string;
    name: string;
    emailed: boolean;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("full_name") ?? "");
    fd.set("language", language);
    fd.set("region", region);
    start(async () => {
      const result = await action(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIssued({
        respondentUrl: result.respondentUrl,
        name,
        emailed: result.emailed === true,
      });
      toast.success(t("araAssessmentDetail.dd_toast_issued"));
    });
  };

  const fullUrl = issued
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${issued.respondentUrl}`
    : "";

  const copy = async () => {
    if (!fullUrl) return;
    try {
      await copyToClipboard(fullUrl);
      toast.success(t("araAssessmentDetail.dd_toast_copied"));
    } catch {
      toast.error(t("araAssessmentDetail.dd_toast_copy_failed"));
    }
  };

  if (issued) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900">
              {t("araAssessmentDetail.dd_issued_for", { name: issued.name })}
            </p>
          </div>
          <p className="text-xs text-emerald-900/80 mb-1">
            {t("araAssessmentDetail.dd_issued_help")}
          </p>
          <p className="text-xs font-medium mb-3" style={{ color: issued.emailed ? "#047857" : "#b45309" }}>
            {issued.emailed
              ? t("araAssessmentDetail.dd_emailed_yes")
              : t("araAssessmentDetail.dd_emailed_no")}
          </p>
          <div className="flex items-stretch gap-2">
            <Input
              readOnly
              value={fullUrl}
              className="font-mono text-xs flex-1 bg-white"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" onClick={copy} variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" />
              {t("araAssessmentDetail.dd_copy")}
            </Button>
            <a
              href={issued.respondentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card hover:bg-muted/50 px-3 py-1.5 text-xs font-medium shrink-0"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              {t("araAssessmentDetail.dd_open")}
            </a>
          </div>
        </div>
        <Button type="button" variant="ghost" onClick={() => setIssued(null)}>
          {t("araAssessmentDetail.dd_issue_another")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("araAssessmentDetail.dd_employee_name")}</Label>
          <Input id="full_name" name="full_name" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("araAssessmentDetail.dd_employee_email")}</Label>
          <Input id="email" name="email" type="email" required maxLength={200} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="organization_name">{t("araAssessmentDetail.dd_org_name")}</Label>
          <Input
            id="organization_name"
            name="organization_name"
            maxLength={300}
            placeholder={t("araAssessmentDetail.dd_org_name_placeholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("araAssessmentDetail.dd_language")}</Label>
          <div className="flex gap-2">
            <Button type="button" variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")} className="flex-1">English</Button>
            <Button type="button" variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")} className="flex-1">العربية</Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("araAssessmentDetail.dd_region")}</Label>
          <div className="flex gap-2">
            <Button type="button" variant={region === "uae" ? "default" : "outline"} size="sm" onClick={() => setRegion("uae")} className="flex-1">{t("araAssessmentDetail.region_uae")}</Button>
            <Button type="button" variant={region === "saudi" ? "default" : "outline"} size="sm" onClick={() => setRegion("saudi")} className="flex-1">{t("araAssessmentDetail.region_saudi")}</Button>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? t("araAssessmentDetail.dd_issuing") : t("araAssessmentDetail.dd_issue_link")}
      </Button>
    </form>
  );
}
