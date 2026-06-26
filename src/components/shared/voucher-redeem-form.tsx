"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─────────────────────────────────────────────────────────────
// Shared voucher redeem form. One bilingual (EN/AR, RTL) form for every
// instrument's /redeem page - replaces the per-service copies that had drifted
// (only ARC + Persona had a language toggle before this). Each service supplies
// an onRedeem() that calls its own server action and returns where to go next,
// so the action layer stays untouched. Recipient identity is NEVER prefilled
// from the URL (phishing guard) - pass server-derived values via initial* props.
// ─────────────────────────────────────────────────────────────

export type VoucherRedeemValues = {
  code: string;
  name: string;
  email: string;
  company: string;
  language: "en" | "ar";
};

export type VoucherRedeemResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export type VoucherRedeemConfig = {
  initialCode?: string;
  initialName?: string;
  initialEmail?: string;
  initialCompany?: string;
  initialLang?: "en" | "ar";
  /** company field behaviour: required (ARC/Fluent), optional, or hidden. */
  companyField?: "required" | "optional" | "hidden";
  codePlaceholder?: string;
  submitLabel?: { en: string; ar: string };
  /** Small print under the button (e.g. a practice-run disclaimer). */
  footerNote?: { en: string; ar: string };
  onRedeem: (values: VoucherRedeemValues) => Promise<VoucherRedeemResult>;
};

export function VoucherRedeemForm(cfg: VoucherRedeemConfig) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">(cfg.initialLang === "ar" ? "ar" : "en");
  const [code, setCode] = useState(cfg.initialCode ?? "");
  const [name, setName] = useState(cfg.initialName ?? "");
  const [email, setEmail] = useState(cfg.initialEmail ?? "");
  const [company, setCompany] = useState(cfg.initialCompany ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);
  const companyMode = cfg.companyField ?? "required";

  const ready =
    code.trim().length > 0 &&
    name.trim().length > 1 &&
    email.trim().length > 0 &&
    (companyMode !== "required" || company.trim().length > 0);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const res = await cfg.onRedeem({
      code: code.trim(),
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      language: lang,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(res.redirectTo); // keep busy=true through navigation
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-4">
      <div className="flex justify-end gap-1">
        {(["en", "ar"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              lang === l ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {l === "en" ? "EN" : "ع"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vr-code">{tx("Voucher code", "رمز القسيمة")}</Label>
        <Input
          id="vr-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          placeholder={cfg.codePlaceholder ?? "VIFM-XXXX-XXXX"}
          autoComplete="off"
          autoCapitalize="characters"
          readOnly={!!cfg.initialCode}
          className="font-mono tracking-wide"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vr-name">{tx("Full name", "الاسم الكامل")}</Label>
          <Input id="vr-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vr-email">{tx("Email", "البريد الإلكتروني")}</Label>
          <Input id="vr-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      {companyMode !== "hidden" && (
        <div className="space-y-1.5">
          <Label htmlFor="vr-company">
            {tx("Company", "جهة العمل")}
            {companyMode === "optional" ? tx(" (optional)", " (اختياري)") : ""}
          </Label>
          <Input
            id="vr-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={tx("Your organisation", "مؤسستك")}
          />
        </div>
      )}

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Button onClick={submit} disabled={busy || !ready} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy
          ? tx("Starting...", "جارٍ البدء...")
          : cfg.submitLabel
            ? tx(cfg.submitLabel.en, cfg.submitLabel.ar)
            : tx("Start", "ابدأ")}
      </Button>

      {cfg.footerNote && (
        <p className="text-center text-[11px] text-muted-foreground">{tx(cfg.footerNote.en, cfg.footerNote.ar)}</p>
      )}
    </div>
  );
}
