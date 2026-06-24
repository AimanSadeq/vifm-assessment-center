"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemVoucherAction } from "../actions";

type Props = {
  initialCode?: string;
  initialCompany?: string;
  initialLang?: "en" | "ar";
};

export function RedeemForm({ initialCode = "", initialCompany = "", initialLang = "en" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "ar">(initialLang === "ar" ? "ar" : "en");
  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

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
            />
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
            <Input id="company" name="company" placeholder={tx("Your organisation", "مؤسستك")} defaultValue={initialCompany} required />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            {loading ? tx("Starting...", "جارٍ البدء...") : tx("Start assessment", "ابدأ التقييم")}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {tx(
              "This is a practice run for development purposes - not an official certified assessment.",
              "هذه نسخة تدريبية لأغراض التطوير - وليست تقييماً رسمياً معتمداً.",
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
