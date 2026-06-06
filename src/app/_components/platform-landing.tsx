"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, ClipboardCheck, Compass, Aperture, Languages, UserSearch,
  GraduationCap, BadgeCheck, BrainCircuit, Layers,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Lang = "en" | "ar";
type Tone = "blue" | "violet" | "teal" | "gold" | "rose" | "indigo" | "fuchsia" | "emerald";
type ServiceKey = "ac" | "ara" | "reflect" | "fluent" | "prehire" | "technical" | "psychometric" | "academy";
// The two solution families (the colleague's talent-lifecycle model). A service
// may belong to both — Psychometrics is a foundational measure used to select
// (acquisition) AND to spot potential (management), so it lists in each.
type Pillar = "acquire" | "manage";

const STORAGE_KEY = "vifm-landing-locale";

// Icon / hue / route / pillars are language-independent; copy comes from T[lang].services.
const SERVICES: ReadonlyArray<{ key: ServiceKey; href: string; icon: typeof Compass; tone: Tone; pillars: Pillar[] }> = [
  // ── Talent Acquisition ──
  { key: "prehire", href: "/admin/prehire", icon: UserSearch, tone: "rose", pillars: ["acquire"] },
  { key: "fluent", href: "/ac/fluent", icon: Languages, tone: "gold", pillars: ["acquire"] },
  { key: "technical", href: "/ac/tech-assessment", icon: BadgeCheck, tone: "indigo", pillars: ["acquire"] },
  { key: "psychometric", href: "/ac/psychometrics", icon: BrainCircuit, tone: "fuchsia", pillars: ["acquire", "manage"] },
  // ── Talent Management ──
  { key: "reflect", href: "/reflect", icon: Aperture, tone: "teal", pillars: ["manage"] },
  { key: "ara", href: "/ara", icon: Compass, tone: "violet", pillars: ["manage"] },
  { key: "ac", href: "/admin", icon: ClipboardCheck, tone: "blue", pillars: ["manage"] },
  { key: "academy", href: "/courses", icon: GraduationCap, tone: "emerald", pillars: ["manage"] },
];

const T = {
  en: {
    pickLang: "Language",
    catalogue: "Training catalogue",
    enter: "Enter",
    eyebrow: "VIFM Talent Intelligence Platform",
    h1a: "Build the talent the",
    h1b: "future demands.",
    sub: "VIFM is a finance & management institute for the GCC. Our platform spans the full talent lifecycle — Talent Acquisition to screen and select, Talent Management to develop and retain — with bilingual assessments, verifiable credentials, and learning mapped to the gaps our diagnostics reveal.",
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
    servicesSub: "Two solution families cover the full talent lifecycle — pick where to focus, and the platform takes it from diagnosis to development.",
    pillars: {
      acquire: { title: "Talent Acquisition Solutions", sub: "Assess the people you bring in — screen, place, and select with defensible, bilingual instruments." },
      manage: { title: "Talent Management Solutions", sub: "Grow the people you have — develop, benchmark, and certify across the organisation." },
    },
    footerOrg: "Virginia Institute of Finance and Management",
    footerConfidential: "Confidential - for VIFM and engaged clients only.",
    footerGcc: "Built for the GCC",
    services: {
      ac: { tagline: "Competency assessment", name: "Assessment Center", description: "Design assessment centers, run exercises and observations, reach scoring consensus in the live wash-up engine, and issue competency reports and learning plans.", tooltip: "Best for hiring and promotion decisions grounded in observed behaviour." },
      ara: { tagline: "AR Compass diagnostic", name: "AI Readiness", description: "An eight-pillar organisational AI-readiness diagnostic, calibrated to UAE and Saudi frameworks, with bilingual board-ready reports and a complimentary personal snapshot.", tooltip: "Best for sizing up your organisation's AI readiness before you invest." },
      reflect: { tagline: "Leadership feedback", name: "Reflect 360", description: "360-degree leadership feedback built from your own values and competencies, with a development plan per leader and an organisation-wide cohort culture view.", tooltip: "Best for developing leaders with candid, multi-rater feedback." },
      fluent: { tagline: "AI English placement", name: "Fluent", description: "A four-skill, CEFR-aligned English placement: AI-generated reading and listening, rubric-scored writing and speaking, with an indicative level and feedback in minutes.", tooltip: "Best for fast, defensible English placement at any scale." },
      technical: { tagline: "Technical proficiency", name: "Technical Assessment", description: "Assess technical proficiency across ten finance domains — from financial modelling to treasury, banking, analytics and AI. SME-reviewed items and documented cut-scores issue a verifiable proficiency credential; indicative banding while a domain's bank is still building.", tooltip: "Best for certifying functional finance skills, defensibly." },
      psychometric: { tagline: "Cognitive + personality", name: "Psychometrics", description: "Indicative cognitive-ability (numerical, verbal, abstract) and Big-Five personality measures — the foundational aptitude and work-style that predict behavioural competency. Server-scored, admin-run and bilingual.", tooltip: "Best for a foundational read on aptitude and work style." },
      prehire: { tagline: "Pre-employment screening", name: "Pre-Hire", description: "Screen and shortlist applicants before you hire: a configurable funnel of competency quiz, English placement and an AI behavioural interview, with a weighted composite, adverse-impact monitoring and an audit trail. The score is a signal — a person always decides.", tooltip: "Best for shortlisting applicants at scale, defensibly." },
      academy: { tagline: "Learning & delivery", name: "VIFM Academy", description: "Self-paced finance & management programmes that turn each diagnosis into action — AI knowledge-checks per lesson and a verifiable completion credential, in English or Arabic.", tooltip: "Best for closing development gaps with guided, credentialed learning." },
    },
  },
  ar: {
    pickLang: "اللغة",
    catalogue: "دليل البرامج التدريبية",
    enter: "الدخول",
    eyebrow: "منصّة VIFM لذكاء المواهب",
    h1a: "ابنِ المواهب التي",
    h1b: "يتطلّبها المستقبل.",
    sub: "VIFM معهد متخصّص في التمويل والإدارة لمنطقة الخليج. تغطّي منصّتنا دورة المواهب الكاملة — استقطاب المواهب للفرز والاختيار، وإدارة المواهب للتطوير والاستبقاء — مع تقييمات ثنائية اللغة، وشهادات قابلة للتحقّق، وتعلّم مرتبط بالفجوات التي تكشفها أدواتنا.",
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
    servicesSub: "عائلتا حلول تغطّيان دورة المواهب الكاملة — اختر أين تركّز، وتتولّى المنصّة الباقي من التشخيص إلى التطوير.",
    pillars: {
      acquire: { title: "حلول استقطاب المواهب", sub: "قيّم من تستقطبهم — فرز وتحديد مستوى واختيار بأدوات موثوقة وثنائية اللغة." },
      manage: { title: "حلول إدارة المواهب", sub: "طوّر من لديك — تطوير ومقارنة مرجعية واعتماد على مستوى المؤسسة." },
    },
    footerOrg: "معهد فرجينيا للتمويل والإدارة",
    footerConfidential: "سري - لـ VIFM والعملاء المتعاقدين فقط.",
    footerGcc: "مُصمّمة لمنطقة الخليج",
    services: {
      ac: { tagline: "تقييم الكفاءات", name: "مركز التقييم", description: "صمّم مراكز التقييم، ونفّذ التمارين والملاحظات، وتوصّل إلى توافق في التقييم عبر محرّك المراجعة المباشر، وأصدر تقارير الكفاءات وخطط التطوير.", tooltip: "الأنسب لقرارات التوظيف والترقية المبنية على سلوك مُلاحَظ." },
      ara: { tagline: "تشخيص بوصلة الجاهزية", name: "الجاهزية للذكاء الاصطناعي", description: "تشخيص لجاهزية المؤسسة للذكاء الاصطناعي عبر ثماني ركائز، مُعايَر وفق أُطُر الإمارات والسعودية، مع تقارير ثنائية اللغة جاهزة للعرض على مجلس الإدارة، ولمحة شخصية مجانية.", tooltip: "الأنسب لقياس جاهزية مؤسستك للذكاء الاصطناعي قبل الاستثمار." },
      reflect: { tagline: "تغذية راجعة قيادية", name: "ريفلكت 360", description: "تغذية راجعة قيادية بزاوية 360 درجة مبنية على قيمكم وكفاءاتكم، مع خطة تطوير لكل قائد وعرض شامل لثقافة المؤسسة بأكملها.", tooltip: "الأنسب لتطوير القادة عبر تغذية راجعة صريحة ومتعددة المصادر." },
      fluent: { tagline: "تحديد مستوى الإنجليزية بالذكاء الاصطناعي", name: "فلوينت", description: "اختبار لتحديد مستوى الإنجليزية عبر أربع مهارات وفق إطار CEFR: قراءة واستماع مُولّدان بالذكاء الاصطناعي، وكتابة وتحدّث يُقيّمان وفق معايير محدّدة، مع مستوى تقريبي وملاحظات خلال دقائق.", tooltip: "الأنسب لتحديد مستوى الإنجليزية بسرعة وموثوقية وعلى نطاق واسع." },
      technical: { tagline: "الكفاءة التقنية", name: "التقييم التقني", description: "قياس الكفاءة التقنية عبر عشرة مجالات مالية — من النمذجة المالية إلى الخزينة والمصارف والتحليلات والذكاء الاصطناعي. بنود مُراجَعة من الخبراء ودرجات قطع موثّقة تمنح اعتماد كفاءة قابلاً للتحقق، مع تصنيف استرشادي ريثما يكتمل بنك أسئلة المجال.", tooltip: "الأنسب لاعتماد المهارات المالية الوظيفية بموثوقية." },
      psychometric: { tagline: "القدرات + الشخصية", name: "القياس النفسي", description: "مقاييس استرشادية للقدرة الذهنية (عددية ولفظية ومجرّدة) وشخصية العوامل الخمسة — الأساس من القدرة وأسلوب العمل الذي يتنبّأ بالكفاءات السلوكية. تُصحَّح على الخادم، يُجريها المسؤول، وثنائية اللغة.", tooltip: "الأنسب لقراءة تأسيسية للقدرات وأسلوب العمل." },
      prehire: { tagline: "الفرز قبل التوظيف", name: "ما قبل التوظيف", description: "افرز المرشّحين وأعدّ القائمة المختصرة قبل التوظيف: مسار قابل للتخصيص يجمع اختبار الكفاءات وتحديد مستوى الإنجليزية ومقابلة سلوكية بالذكاء الاصطناعي، مع درجة مركّبة مرجّحة، ومراقبة الأثر التمييزي، وسجل تدقيق كامل. الدرجة إشارة استرشادية — والقرار النهائي لإنسان دائمًا.", tooltip: "الأنسب لإعداد القائمة المختصرة للمتقدّمين على نطاق واسع وبموثوقية." },
      academy: { tagline: "التعلّم والتقديم", name: "أكاديمية VIFM", description: "برامج ذاتية الوتيرة في التمويل والإدارة تُحوّل كل تشخيص إلى إجراء — اختبارات معرفية بالذكاء الاصطناعي لكل درس وشهادة إتمام قابلة للتحقّق، بالعربية أو الإنجليزية.", tooltip: "الأنسب لمعالجة فجوات التطوير عبر تعلّم موجّه وموثّق بشهادة." },
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
        <div className="mx-auto max-w-6xl px-6 pt-3 pb-6">
          {/* Top bar */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="sm" />
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
              <Layers className="h-3 w-3" /> {t.eyebrow}
            </span>
            <h1 className="ara-numeral mt-2 mb-3 text-2xl font-semibold leading-[1.1] text-white sm:text-3xl lg:text-4xl">
              {t.h1a} <span className="ara-accent-sweep">{t.h1b}</span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/75">{t.sub}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
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

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {/* ─── Solutions as two vertical columns, one per talent-lifecycle family ─── */}
        <section>
          <h2 className="text-lg font-semibold text-[#010131]">{t.servicesHeading}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.servicesSub}</p>

          <TooltipProvider delayDuration={200}>
            <div className="mt-6 grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
              {(["acquire", "manage"] as const).map((pillar) => (
                <div key={pillar}>
                  {/* Big pillar heading (the two solution families) */}
                  <div className="border-b-2 border-accent/30 pb-2.5">
                    <h3 className="ara-numeral whitespace-nowrap text-[1.45rem] font-extrabold uppercase leading-tight tracking-tight text-accent sm:text-[1.6rem]">
                      {t.pillars[pillar].title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t.pillars[pillar].sub}</p>
                  </div>

                  {/* Services stacked underneath */}
                  <div className="mt-4 space-y-3">
                    {SERVICES.filter((s) => s.pillars.includes(pillar))
                      .slice()
                      .sort((a, b) => a.pillars.length - b.pillars.length)
                      .map(({ key, href, icon: Icon, tone }) => {
                        const svc = t.services[key];
                        return (
                          <Tooltip key={`${pillar}-${key}`}>
                            <TooltipTrigger asChild>
                              <Link href={href} className="block">
                                <div className={`launcher-card tone-${tone} flex items-center gap-4 p-4`}>
                                  <div className="launcher-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                                    <Icon className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="ara-eyebrow">{svc.tagline}</div>
                                    <h4 className="text-base font-semibold text-primary">{svc.name}</h4>
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{svc.description}</p>
                                  </div>
                                  <div className="launcher-card-cta shrink-0 self-center">
                                    <Arrow className="h-5 w-5" />
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
                </div>
              ))}
            </div>
          </TooltipProvider>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-3 sm:flex-row sm:items-center">
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
