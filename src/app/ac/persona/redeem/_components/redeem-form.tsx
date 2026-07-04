"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { redeemPersonaVoucherAction } from "../actions";

export function RedeemForm({
  initialCode = "",
  initialEmail = "",
  initialName = "",
  initialCompany = "",
  initialLang = "en",
}: {
  initialCode?: string;
  initialEmail?: string;
  initialName?: string;
  initialCompany?: string;
  initialLang?: "en" | "ar";
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [company, setCompany] = useState(initialCompany);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">(initialLang === "ar" ? "ar" : "en");
  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  const ready = code.trim() && name.trim() && email.trim() && company.trim();

  // The redeem server action returns English error strings; localise the known
  // ones for an Arabic delegate (fall back to the raw message for anything new).
  const AR_ERRORS: Record<string, string> = {
    "Enter a voucher code.": "أدخل رمز القسيمة.",
    "This code is invalid, expired, or fully used.": "هذا الرمز غير صالح أو منتهي الصلاحية أو استُخدم بالكامل.",
    "Could not redeem this code. Please check it and try again.": "تعذّر استخدام هذا الرمز. يرجى التحقق منه والمحاولة مرة أخرى.",
    "Could not start your assessment. Please try again.": "تعذّر بدء تقييمك. يرجى المحاولة مرة أخرى.",
  };
  const localizeError = (msg: string) => (ar ? AR_ERRORS[msg] ?? msg : msg);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const res = await redeemPersonaVoucherAction({ code, name, email, company });
    if (!res.ok) {
      setBusy(false);
      toast.error(localizeError(res.error));
      return;
    }
    router.push(`/ac/persona/take/${res.redemptionToken}`);
  };

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center justify-end gap-1">
        {(["en", "ar"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${lang === l ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            {l === "en" ? "English" : "العربية"}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">{tx("Voucher code", "رمز القسيمة")}</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="VIFM-PER-XXXX-XXXX"
          autoCapitalize="characters"
          dir="ltr"
          className="font-mono tracking-wide"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{tx("Full name", "الاسم الكامل")}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{tx("Email", "البريد الإلكتروني")}</Label>
          <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">{tx("Company", "جهة العمل")}</Label>
        <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={busy || !ready} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {tx("Start my Persona® assessment", "ابدأ تقييم بيرسونا®")}
      </Button>
    </div>
  );
}
