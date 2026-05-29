"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, ClipboardCheck, Compass, Aperture, Languages, UserSearch,
  GraduationCap, Sparkles, BookOpen, Award, Target,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Lang = "en" | "ar";
type Tone = "blue" | "violet" | "teal" | "gold" | "rose";
type ServiceKey = "ac" | "ara" | "reflect" | "fluent" | "prehire";

const STORAGE_KEY = "vifm-landing-locale";

// Icon / hue / route are language-independent; copy comes from T[lang].services.
const SERVICES: ReadonlyArray<{ key: ServiceKey; href: string; icon: typeof Compass; tone: Tone }> = [
  { key: "prehire", href: "/admin/prehire", icon: UserSearch, tone: "rose" },
  { key: "fluent", href: "/ac/fluent", icon: Languages, tone: "gold" },
  { key: "ac", href: "/admin", icon: ClipboardCheck, tone: "blue" },
  { key: "reflect", href: "/reflect", icon: Aperture, tone: "teal" },
  { key: "ara", href: "/ara", icon: Compass, tone: "violet" },
];

// Academy value cards (the four pillars of the learning experience).
const FEATURES: ReadonlyArray<{ key: "catalogue" | "checks" | "credentials" | "mapped"; icon: typeof BookOpen; iconClass: string }> = [
  { key: "catalogue", icon: BookOpen, iconClass: "ara-icon-blue" },
  { key: "checks", icon: Sparkles, iconClass: "ara-icon-violet" },
  { key: "credentials", icon: Award, iconClass: "ara-icon-gold" },
  { key: "mapped", icon: Target, iconClass: "ara-icon-teal" },
];

const T = {
  en: {
    pickLang: "Language",
    catalogue: "Training catalogue",
    enter: "Enter",
    eyebrow: "VIFM Academy",
    h1a: "Build the capabilities",
    h1b: "your work demands.",
    sub: "VIFM is a finance & management training institute for the GCC. The Academy turns assessment insight into self-paced programmes — AI knowledge-checks, verifiable credentials, and a curriculum mapped to the gaps our diagnostics reveal.",
    ctaBrowse: "Browse the catalogue",
    ctaLearning: "My learning",
    trust: ["Bilingual English / Arabic", "Verifiable credentials", "AI-supported learning"],
    features: {
      catalogue: {
        title: "Self-paced programmes",
        body: "A catalogue spanning finance, investment, leadership, analytics and AI — learn at your own pace, in English or Arabic.",
      },
      checks: {
        title: "AI knowledge-checks",
        body: "Every lesson ends with an AI-generated check that reinforces what matters and flags what to revisit.",
      },
      credentials: {
        title: "Verifiable credentials",
        body: "Finish a programme and earn a credential anyone can verify by its code — no account required.",
      },
      mapped: {
        title: "Mapped to your gaps",
        body: "Our diagnostics recommend the exact programmes that close each person's development gaps.",
      },
    },
    servicesHeading: "Start with a diagnosis",
    servicesSub: "Five bilingual assessment services pinpoint where to focus — then the Academy delivers the learning.",
    footerOrg: "Virginia Institute of Finance and Management",
    footerConfidential: "Confidential - for VIFM and engaged clients only.",
    footerGcc: "Built for the GCC",
    services: {
      ac: { tagline: "Competency assessment", name: "Assessment Center", description: "Design assessment centers, run exercises and observations, reach scoring consensus in the live wash-up engine, and issue competency reports and learning plans.", tooltip: "Best for hiring and promotion decisions grounded in observed behaviour." },
      ara: { tagline: "AR Compass diagnostic", name: "AI Readiness", description: "An eight-pillar organisational AI-readiness diagnostic, calibrated to UAE and Saudi frameworks, with bilingual board-ready reports and a complimentary personal snapshot.", tooltip: "Best for sizing up your organisation's AI readiness before you invest." },
      reflect: { tagline: "Leadership feedback", name: "Reflect 360", description: "360-degree leadership feedback built from your own values and competencies, with a development plan per leader and an organisation-wide cohort culture view.", tooltip: "Best for developing leaders with candid, multi-rater feedback." },
      fluent: { tagline: "AI English placement", name: "Fluent", description: "A four-skill, CEFR-aligned English placement: AI-generated reading and listening, rubric-scored writing and speaking, with an indicative level and feedback in minutes.", tooltip: "Best for fast, defensible English placement at any scale." },
      prehire: { tagline: "Pre-employment screening", name: "Pre-Hire", description: "Screen and shortlist applicants before you hire: a configurable funnel of competency quiz, English placement and an AI behavioural interview, with a weighted composite, adverse-impact monitoring and an audit trail. The score is a signal — a person always decides.", tooltip: "Best for shortlisting applicants at scale, defensibly." },
    },
  },
  ar: {
    pickLang: "اللغة",
    catalogue: "دليل البرامج التدريبية",
    enter: "الدخول",
    eyebrow: "أكاديمية VIFM",
    h1a: "ابنِ القدرات",
    h1b: "التي يتطلّبها عملك.",
    sub: "VIFM معهد متخصّص في التدريب على التمويل والإدارة لمنطقة الخليج. تحوّل الأكاديمية رؤى التقييم إلى برامج تعليمية ذاتية — مع اختبارات معرفية بالذكاء الاصطناعي، وشهادات قابلة للتحقّق، ومنهج مرتبط بالفجوات التي تكشفها أدواتنا التشخيصية.",
    ctaBrowse: "تصفّح دليل البرامج",
    ctaLearning: "مساحة التعلّم",
    trust: ["ثنائية اللغة: الإنجليزية / العربية", "شهادات قابلة للتحقّق", "تعلّم مدعوم بالذكاء الاصطناعي"],
    features: {
      catalogue: {
        title: "برامج ذاتية الوتيرة",
        body: "دليل يغطّي التمويل والاستثمار والقيادة والتحليلات والذكاء الاصطناعي — تعلّم بالوتيرة التي تناسبك، بالعربية أو الإنجليزية.",
      },
      checks: {
        title: "اختبارات معرفية بالذكاء الاصطناعي",
        body: "ينتهي كل درس باختبار مُولّد بالذكاء الاصطناعي يعزّز المهم ويبرز ما يحتاج إلى مراجعة.",
      },
      credentials: {
        title: "شهادات قابلة للتحقّق",
        body: "أكمل برنامجًا واحصل على شهادة يمكن لأي شخص التحقّق منها برمزها — دون حساب.",
      },
      mapped: {
        title: "مرتبطة بفجواتك",
        body: "توصي أدواتنا التشخيصية بالبرامج الدقيقة التي تعالج فجوات التطوير لكل فرد.",
      },
    },
    servicesHeading: "ابدأ بالتشخيص",
    servicesSub: "خمس خدمات تقييم ثنائية اللغة تحدّد أين تركّز — ثم تتولّى الأكاديمية تقديم التعلّم.",
    footerOrg: "معهد فرجينيا للتمويل والإدارة",
    footerConfidential: "سري - لـ VIFM والعملاء المتعاقدين فقط.",
    footerGcc: "مُصمّمة لمنطقة الخليج",
    services: {
      ac: { tagline: "تقييم الكفاءات", name: "مركز التقييم", description: "صمّم مراكز التقييم، ونفّذ التمارين والملاحظات، وتوصّل إلى توافق في التقييم عبر محرّك المراجعة المباشر، وأصدر تقارير الكفاءات وخطط التطوير.", tooltip: "الأنسب لقرارات التوظيف والترقية المبنية على سلوك مُلاحَظ." },
      ara: { tagline: "تشخيص بوصلة الجاهزية", name: "الجاهزية للذكاء الاصطناعي", description: "تشخيص لجاهزية المؤسسة للذكاء الاصطناعي عبر ثماني ركائز، مُعايَر وفق أُطُر الإمارات والسعودية، مع تقارير ثنائية اللغة جاهزة للعرض على مجلس الإدارة، ولمحة شخصية مجانية.", tooltip: "الأنسب لقياس جاهزية مؤسستك للذكاء الاصطناعي قبل الاستثمار." },
      reflect: { tagline: "تغذية راجعة قيادية", name: "ريفلكت 360", description: "تغذية راجعة قيادية بزاوية 360 درجة مبنية على قيمكم وكفاءاتكم، مع خطة تطوير لكل قائد وعرض شامل لثقافة المؤسسة بأكملها.", tooltip: "الأنسب لتطوير القادة عبر تغذية راجعة صريحة ومتعددة المصادر." },
      fluent: { tagline: "تحديد مستوى الإنجليزية بالذكاء الاصطناعي", name: "فلوينت", description: "اختبار لتحديد مستوى الإنجليزية عبر أربع مهارات وفق إطار CEFR: قراءة واستماع مُولّدان بالذكاء الاصطناعي، وكتابة وتحدّث يُقيّمان وفق معايير محدّدة، مع مستوى تقريبي وملاحظات خلال دقائق.", tooltip: "الأنسب لتحديد مستوى الإنجليزية بسرعة وموثوقية وعلى نطاق واسع." },
      prehire: { tagline: "الفرز قبل التوظيف", name: "ما قبل التوظيف", description: "افرز المرشّحين وأعدّ القائمة المختصرة قبل التوظيف: مسار قابل للتخصيص يجمع اختبار الكفاءات وتحديد مستوى الإنجليزية ومقابلة سلوكية بالذكاء الاصطناعي، مع درجة مركّبة مرجّحة، ومراقبة الأثر التمييزي، وسجل تدقيق كامل. الدرجة إشارة استرشادية — والقرار النهائي لإنسان دائمًا.", tooltip: "الأنسب لإعداد القائمة المختصرة للمتقدّمين على نطاق واسع وبموثوقية." },
    },
  },
} as const;

export function PlatformLanding() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const cookie = document.cookie.match(/(?:^|;\s*)vifm-locale=(ar|en)/)?.[1];
      const saved = cookie ?? localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLang(saved);
    } catch {
      /* localStorage unavailable - stay on English */
    }
  }, []);
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `vifm-locale=${l}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    } catch {
      /* ignore persistence failure */
    }
  };

  const t = T[lang];
  const rtl = lang === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-full flex-col bg-background">
      {/* ─── Academy hero ─── */}
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-4 pb-24">
          {/* Top bar */}
          <div className="mb-10 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="md" />
            <div className="flex items-center gap-2">
              <Link
                href="/courses"
                className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15 sm:inline-flex"
              >
                <GraduationCap className="h-3.5 w-3.5" /> {t.catalogue}
              </Link>
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-0.5 backdrop-blur">
                {(["en", "ar"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => choose(l)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      lang === l ? "bg-white text-[#010131]" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-3xl">
            <span className="ara-eyebrow text-accent">
              <GraduationCap className="h-3 w-3" /> {t.eyebrow}
            </span>
            <h1 className="ara-numeral mt-3 mb-4 text-3xl font-semibold leading-[1.08] text-white sm:text-4xl lg:text-5xl">
              {t.h1a} <span className="ara-accent-sweep">{t.h1b}</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/75">{t.sub}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/courses"
                className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
              >
                {t.ctaBrowse} <Arrow className="h-4 w-4" />
              </Link>
              <Link
                href="/candidate/academy"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                {t.ctaLearning}
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
              {t.trust.map((item, i) => (
                <span key={item} className="inline-flex items-center gap-4">
                  {i > 0 && <span className="h-3 w-px bg-white/20" />}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* ─── Academy value cards (overlap the hero) ─── */}
        <section className="-mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon, iconClass }) => {
            const f = t.features[key];
            return (
              <div key={key} className="rounded-2xl border bg-card p-5 shadow-[0_16px_48px_-12px_rgba(1,1,49,0.12)]">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#010131]">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>

        {/* ─── Diagnostic services (secondary) ─── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-[#010131]">{t.servicesHeading}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.servicesSub}</p>

          <TooltipProvider delayDuration={200}>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(({ key, href, icon: Icon, tone }) => {
                const svc = t.services[key];
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Link href={href} className="block h-full">
                        <div className={`launcher-card tone-${tone} h-full p-4`}>
                          <Icon className="launcher-card-glyph h-16 w-16" strokeWidth={1} aria-hidden />
                          <div className="relative z-10 flex h-full flex-col">
                            <div className="launcher-card-icon mb-2 flex h-10 w-10 items-center justify-center rounded-xl">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="ara-eyebrow mb-1">{svc.tagline}</div>
                            <h3 className="text-lg font-semibold text-primary">{svc.name}</h3>
                            <p className="mt-1 flex-1 text-xs leading-snug text-muted-foreground">{svc.description}</p>
                            <div className="launcher-card-cta mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                              {t.enter} <Arrow className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-center leading-snug">
                      {svc.tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-16 border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center">
          <div className="text-xs text-muted-foreground">
            <div className="mb-0.5 font-medium text-foreground">{t.footerOrg}</div>
            {t.footerConfidential}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground">{t.catalogue}</Link>
            <span className="h-3 w-px bg-border" />
            <span>{t.footerGcc}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
