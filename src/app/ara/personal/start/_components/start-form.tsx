"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Sparkles, Compass } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";

type StartActionResult =
  | { ok: false; error: string }
  | { ok: true; redirectTo: string };

type Props = {
  action: (fd: FormData) => Promise<StartActionResult>;
};

const COPY = {
  en: {
    h1: "Personal AI Readiness Snapshot",
    subtitle:
      "A short self-assessment — about 5-7 minutes — that gives you a clear read on how AI-ready you personally are across four VIFM factors. Complimentary. No account required.",
    whatYoullGet: "What you'll get",
    startYourSnapshot: "Start your snapshot",
    privacyNote:
      "Your answers are private. Email is used only to send your personal results link — we don't market to you.",
    nameLabel: "Your name *",
    namePlaceholder: "e.g. Sara Al Hashimi",
    emailLabel: "Email *",
    emailPlaceholder: "you@example.com",
    languageLabel: "Language",
    regionLabel: "Region",
    uae: "UAE",
    saudi: "Saudi Arabia",
    submit: "Start the snapshot",
    submitting: "Starting…",
    footnote:
      "The Personal Snapshot is one of three diagnostic tiers in the VIFM AI Readiness Compass. The org-level tiers (Department, Division, Enterprise) are consultant-led and run separately.",
  },
  ar: {
    h1: "لقطة الجاهزية الشخصية للذكاء الاصطناعي",
    subtitle:
      "تقييم ذاتي قصير — يستغرق نحو 5-7 دقائق — يمنحك قراءة واضحة لمدى جاهزيتك الشخصية للذكاء الاصطناعي عبر أربعة عوامل من VIFM. مجاني، ولا يتطلب إنشاء حساب.",
    whatYoullGet: "ماذا ستحصل عليه",
    startYourSnapshot: "ابدأ لقطتك",
    privacyNote:
      "إجاباتك خاصة. نستخدم بريدك الإلكتروني فقط لإرسال رابط نتائجك الشخصية — لا نستخدمه للتسويق.",
    nameLabel: "اسمك *",
    namePlaceholder: "مثال: سارة الهاشمي",
    emailLabel: "البريد الإلكتروني *",
    emailPlaceholder: "you@example.com",
    languageLabel: "اللغة",
    regionLabel: "المنطقة",
    uae: "الإمارات",
    saudi: "السعودية",
    submit: "ابدأ اللقطة",
    submitting: "جارٍ البدء…",
    footnote:
      "اللقطة الشخصية واحدة من ثلاثة مستويات تشخيصية ضمن بوصلة VIFM للاستعداد للذكاء الاصطناعي. تُدار المستويات على مستوى المؤسسة (إدارة، شعبة، مؤسسة) من قِبل المستشارين بشكل منفصل.",
  },
} as const;

/**
 * Personal Snapshot start page — full client surface so the language
 * toggle inside the form drives the entire page's strings reactively.
 * (Previously the toggle only set the respondent's preferred language
 * for the downstream respond form, leaving the start page stuck in
 * English regardless of selection.)
 *
 * Page chrome that lives outside this component is intentionally
 * empty: the header, factor preview cards, form, and footnote all
 * render from here so the locale state flows everywhere.
 */
export function StartForm({ action }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [region, setRegion] = useState<"uae" | "saudi">("uae");
  const isAr = language === "ar";
  const t = COPY[language];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("language", language);
    fd.set("region", region);
    start(async () => {
      const result = await action(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.redirectTo);
    });
  };

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex justify-center">
        <VifmLogo variant="color" size="md" />
      </div>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <Compass className="h-7 w-7 text-accent" />
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t.h1}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
          {t.subtitle}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.whatYoullGet}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {ARA_INDIVIDUAL_FACTORS.map((f) => (
            <div key={f.id} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: f.color }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {f.domain}
                </span>
              </div>
              <p className="text-sm font-semibold">{isAr ? f.name_ar : f.name_en}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                {isAr ? f.description_ar : f.description_en}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.startYourSnapshot}</CardTitle>
          <CardDescription>{t.privacyNote}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">{t.nameLabel}</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder={t.namePlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t.emailLabel}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={200}
                  placeholder={t.emailPlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.languageLabel}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={language === "en" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("en")}
                    className="flex-1"
                  >
                    English
                  </Button>
                  <Button
                    type="button"
                    variant={language === "ar" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("ar")}
                    className="flex-1"
                  >
                    العربية
                  </Button>
                </div>
              </div>
              {/* Region pill intentionally omitted from the personal flow:
                   regulatory frameworks (the org pillar use of region)
                   don't apply to a self-served personal snapshot, so the
                   selection had no observable effect. The action defaults
                   region to 'uae' on the server side. Restore the pill
                   only when region-specific norm-group copy ships. */}
            </div>

            <Button type="submit" disabled={pending} className="w-full gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {pending ? t.submitting : t.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        {t.footnote}
      </p>
    </div>
  );
}
