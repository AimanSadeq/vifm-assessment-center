"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

type Result =
  | { ok: false; error: string }
  | { ok: true; respondentUrl: string; assessmentId: string; respondentId: string };

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
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [region, setRegion] = useState<"uae" | "saudi">("uae");
  const [issued, setIssued] = useState<{
    respondentUrl: string;
    name: string;
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
      });
      toast.success("Deep-dive issued - copy the link below");
    });
  };

  const fullUrl = issued
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${issued.respondentUrl}`
    : "";

  const copy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy - please select and copy manually");
    }
  };

  if (issued) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900">
              Deep-dive issued for {issued.name}
            </p>
          </div>
          <p className="text-xs text-emerald-900/80 mb-3">
            Send this magic link to the employee. They&apos;ll land directly
            in the respondent flow with the 48 individual-factor items.
            On completion, the system emails them the results URL + PDF.
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
              Copy
            </Button>
            <a
              href={issued.respondentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card hover:bg-muted/50 px-3 py-1.5 text-xs font-medium shrink-0"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Open
            </a>
          </div>
        </div>
        <Button type="button" variant="ghost" onClick={() => setIssued(null)}>
          Issue another deep-dive
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Employee name *</Label>
          <Input id="full_name" name="full_name" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Employee email *</Label>
          <Input id="email" name="email" type="email" required maxLength={200} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="organization_name">Client organisation name (optional)</Label>
          <Input
            id="organization_name"
            name="organization_name"
            maxLength={300}
            placeholder="e.g. ACME Bank - keeps deep-dives associated with the paying client"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <div className="flex gap-2">
            <Button type="button" variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")} className="flex-1">English</Button>
            <Button type="button" variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")} className="flex-1">العربية</Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <div className="flex gap-2">
            <Button type="button" variant={region === "uae" ? "default" : "outline"} size="sm" onClick={() => setRegion("uae")} className="flex-1">UAE</Button>
            <Button type="button" variant={region === "saudi" ? "default" : "outline"} size="sm" onClick={() => setRegion("saudi")} className="flex-1">Saudi</Button>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Issuing…" : "Issue deep-dive access link"}
      </Button>
    </form>
  );
}
