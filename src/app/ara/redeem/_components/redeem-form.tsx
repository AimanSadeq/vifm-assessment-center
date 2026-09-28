"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkVoucherCodeAction, redeemVoucherAction, type VoucherCodeCheck } from "../actions";

type Props = {
  initialCode?: string;
  initialCompany?: string;
  initialLang?: "en" | "ar";
  /** True only for a genuine practice/sandbox voucher; false = a real run. */
  isPractice?: boolean;
};

export function RedeemForm({ initialCode = "", initialCompany = "", initialLang = "en", isPractice = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "ar">(initialLang === "ar" ? "ar" : "en");
  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);
  const [codeState, setCodeState] = useState<VoucherCodeCheck["state"] | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  // VOUCHER-12: flag a mistyped, spent or expired code as soon as the delegate
  // leaves the field, and show the code as the platform reads it (pasted email
  // link text stripped). Advisory - submit is still the real check.
  async function checkCode() {
    const el = codeRef.current;
    if (!el || initialCode) return;
    const raw = el.value;
    if (!raw.trim()) {
      setCodeState(null);
      return;
    }
    const r = await checkVoucherCodeAction(raw);
    if (codeRef.current && r.code && r.code !== raw) codeRef.current.value = r.code;
    if (r.company && companyRef.current && !companyRef.current.value.trim()) companyRef.current.value = r.company;
    setCodeState(r.state);
  }
  const codeMessage: Record<Exclude<VoucherCodeCheck["state"], "ok">, [string, string]> = {
    unknown: [
      "We can't find this code. Please check it against your invitation email.",
      "لم نعثر على هذا الرمز. يرجى التحقق منه في رسالة الدعوة.",
    ],
    disabled: [
      "This code has been deactivated. Please contact the organisation that invited you.",
      "تم إيقاف هذا الرمز. يرجى التواصل مع الجهة التي دعتك.",
    ],
    expired: [
      "This code has expired. Please contact the organisation that invited you.",
      "انتهت صلاحية هذا الرمز. يرجى التواصل مع الجهة التي دعتك.",
    ],
    used_up: [
      "All places on this code have been taken. Please contact the organisation that invited you.",
      "تم استخدام جميع المقاعد المتاحة لهذا الرمز. يرجى التواصل مع الجهة التي دعتك.",
    ],
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await redeemVoucherAction(new FormData(e.currentTarget));
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push(res.redirectTo);
  }

  return (
    <Card dir={ar ? "rtl" : "ltr"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Compass className="h-5 w-5 text-[#5391D5]" /> {tx("AI Readiness Compass®", "بوصلة الجاهزية للذكاء الاصطناعي®")}
            </CardTitle>
            <CardDescription>{tx("Confirm your details to start your assessment.", "أكّد بياناتك لبدء التقييم.")}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {(["en", "ar"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${lang === l ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                {l === "en" ? "EN" : "ع"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Pre-start description - a trial respondent noted the redeem page told
            them nothing about the assessment before asking them to sign up. */}
        <div className="mb-5 rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">
            {tx("What to expect", "ما الذي تتوقعه")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {tx(
              "A short, self-paced assessment of how ready you and your work are for AI. Most people finish in about 10-15 minutes. You'll answer a mix of self-ratings (1-5), multiple-choice and short scenarios - there are no trick questions and no pass or fail.",
              "تقييم قصير ذاتي الإيقاع لمدى جاهزيتك وجاهزية عملك للذكاء الاصطناعي. ينهيه معظم الناس في نحو 10-15 دقيقة. ستجيب عن مزيج من التقييمات الذاتية (1-5)، والاختيار من متعدد، وسيناريوهات قصيرة - دون أسئلة خادعة ودون نجاح أو رسوب.",
            )}
          </p>
          <p className="mt-2 text-muted-foreground">
            {tx(
              "Your answers save automatically as you go. You can close the page and return via the same link to pick up where you left off.",
              "تُحفظ إجاباتك تلقائياً أثناء التقدم. يمكنك إغلاق الصفحة والعودة عبر الرابط نفسه لمتابعة ما توقفت عنده.",
            )}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">{tx("Voucher code", "رمز القسيمة")}</Label>
            <Input
              id="code"
              name="code"
              placeholder="VIFM-ARC-XXXX-XXXX"
              autoComplete="off"
              dir="ltr"
              defaultValue={initialCode}
              readOnly={!!initialCode}
              required
              ref={codeRef}
              onBlur={checkCode}
              onChange={() => codeState && setCodeState(null)}
              aria-invalid={codeState != null && codeState !== "ok"}
              aria-describedby={codeState && codeState !== "ok" ? "code-status" : undefined}
            />
            {codeState && codeState !== "ok" && (
              <p id="code-status" role="status" className="text-xs text-destructive">
                {tx(codeMessage[codeState][0], codeMessage[codeState][1])}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{tx("Full name", "الاسم الكامل")}</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{tx("Email", "البريد الإلكتروني")}</Label>
            <Input id="email" name="email" type="email" dir="ltr" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">{tx("Company", "جهة العمل")}</Label>
            <Input id="company" name="company" ref={companyRef} placeholder={tx("Your organisation", "مؤسستك")} defaultValue={initialCompany} required />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            {loading ? tx("Starting...", "جارٍ البدء...") : tx("Start assessment", "ابدأ التقييم")}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {isPractice
              ? tx(
                  "This is a practice run for development purposes - not an official certified assessment.",
                  "هذه نسخة تدريبية لأغراض التطوير - وليست تقييماً رسمياً معتمداً.",
                )
              : tx(
                  "Your responses are shared with the organisation that invited you, who will follow up on next steps.",
                  "تُشارَك إجاباتك مع الجهة التي دعتك، وستتابع معك الخطوات التالية.",
                )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
