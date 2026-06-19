"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Copy, ArrowRight, CheckCircle2, Sparkles, Mail,
} from "lucide-react";
import { copyToClipboard } from "@/lib/utils/clipboard";

type Result =
  | { ok: false; error: string }
  | { ok: true; respondentUrl: string; assessmentId: string; respondentId: string; emailed?: boolean };

type Props = {
  /** Reuses the consultant deep-dive issuance action (60-item, tier=deep_dive). */
  action: (fd: FormData) => Promise<Result>;
};

/**
 * Talent-Acquisition issuance + live-demo form.
 *
 * One submit creates the full Personal AI Readiness deep-dive and hands back a
 * secure link. What happens next is the issuer's call:
 *   - Email the candidate the link to complete later (the default), OR
 *   - Keep it private - run it yourself, or hold the link/results without
 *     notifying the candidate (a hiring manager keeping it to themselves), OR
 *   - Open it on the spot to walk through it live.
 *
 * Deliberately minimal - name + email + language. Region defaults to UAE (the
 * personal-factor items are region-neutral) and the organisation is fixed to a
 * Talent-Acquisition bucket so selection runs don't clutter the org list. The
 * lens is pinned to "acquisition" so the result/PDF use the hiring framing.
 */
export function SelectionIssueForm({ action }: Props) {
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [demoMode, setDemoMode] = useState(false);
  // Whether to email the candidate their link. Default on (issuing is the
  // headline action); uncheck to keep the link private to the issuer.
  const [emailCandidate, setEmailCandidate] = useState(true);
  const [issued, setIssued] = useState<{
    respondentUrl: string; name: string; emailed: boolean; notified: boolean; demo: boolean;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("full_name") ?? "");
    fd.set("language", language);
    fd.set("region", "uae");
    fd.set("organization_name", "AI Readiness - Talent Acquisition");
    fd.set("lens", "acquisition");
    // Demo runs are flagged sandbox so they carry the Test badge, stay
    // purgeable, and unlock the "Simulate answers" shortcut on the assessment.
    if (demoMode) fd.set("is_sandbox", "true");
    // Keep-it-private: only set skip_email when the issuer opts out of emailing.
    if (!emailCandidate) fd.set("skip_email", "true");
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
        notified: emailCandidate,
        demo: demoMode,
      });
      toast.success(demoMode ? "Demo assessment ready" : "Assessment link created");
    });
  };

  const fullUrl = issued
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${issued.respondentUrl}`
    : "";

  const copy = async () => {
    if (!fullUrl) return;
    try {
      await copyToClipboard(fullUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  if (issued) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900">Issued for {issued.name}</p>
          </div>
          <p
            className="text-xs font-medium flex items-center gap-1.5 mb-3"
            style={{ color: !issued.notified ? "#475569" : issued.emailed ? "#047857" : "#b45309" }}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {!issued.notified
              ? "Kept private - the candidate was not emailed. The link is yours to keep, share, or open."
              : issued.emailed
              ? "We emailed them a secure link to complete it later."
              : "We tried to email them but it didn't send - share the link below instead."}
          </p>

          {/* Live-demo CTA - the prominent action, so the admin can start the
              assessment in front of a client right away. */}
          <a
            href={issued.respondentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            Start the assessment now <ArrowRight className="h-4 w-4" />
          </a>

          {issued.demo && (
            <p className="mt-2 text-[11px] text-amber-700 leading-relaxed">
              Demo run - on the assessment you can click <span className="font-semibold">Simulate answers</span> to
              fill all questions and jump straight to the report.
            </p>
          )}

          <div className="flex items-stretch gap-2 mt-2">
            <Input
              readOnly
              value={fullUrl}
              className="font-mono text-xs flex-1 bg-white"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" onClick={copy} variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </div>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setIssued(null)}>
          Assess another candidate
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Candidate name</Label>
        <Input id="full_name" name="full_name" required minLength={2} maxLength={200} placeholder="e.g. Sara Al Mansoori" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Candidate email</Label>
        <Input id="email" name="email" type="email" required maxLength={200} placeholder="name@company.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Assessment language</Label>
        <div className="flex gap-2">
          <Button type="button" variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")} className="flex-1">
            English
          </Button>
          <Button type="button" variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")} className="flex-1">
            العربية
          </Button>
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-md border border-input bg-muted/30 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input mt-0.5"
          checked={emailCandidate}
          onChange={(e) => setEmailCandidate(e.target.checked)}
        />
        <span className="text-xs leading-relaxed">
          <span className="font-semibold text-foreground">Email the candidate a secure link</span>
          <span className="text-muted-foreground"> - leave unchecked to keep the link to yourself and run it privately. Either way you get the link to copy or open now.</span>
        </span>
      </label>

      <label className="flex items-start gap-2.5 rounded-md border border-input bg-muted/30 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input mt-0.5"
          checked={demoMode}
          onChange={(e) => setDemoMode(e.target.checked)}
        />
        <span className="text-xs leading-relaxed">
          <span className="font-semibold text-foreground">Demo mode</span>
          <span className="text-muted-foreground"> - mark this as a test run so you can simulate all answers and jump straight to the report when presenting to a client.</span>
        </span>
      </label>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Creating..." : (demoMode ? "Start a demo" : "Create the secure link")}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Full 60-question Personal AI Readiness deep-dive · bilingual · about 15 minutes
      </p>
    </form>
  );
}
