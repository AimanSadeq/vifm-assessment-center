"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, ClipboardCheck, Compass, Aperture, Languages, GraduationCap, Sparkles,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

type Lang = "en" | "ar";
type Tone = "blue" | "violet" | "teal" | "gold";
type ServiceKey = "ac" | "ara" | "reflect" | "fluent";

const STORAGE_KEY = "vifm-landing-locale";

// Icon / hue / route are language-independent; copy comes from T[lang].services.
const SERVICES: ReadonlyArray<{ key: ServiceKey; href: string; icon: typeof Compass; tone: Tone }> = [
  { key: "ac", href: "/admin", icon: ClipboardCheck, tone: "blue" },
  { key: "ara", href: "/ara", icon: Compass, tone: "violet" },
  { key: "reflect", href: "/reflect", icon: Aperture, tone: "teal" },
  { key: "fluent", href: "/ac/fluent", icon: Languages, tone: "gold" },
];

const T = {
  en: {
    eyebrow: "VIFM Talent & Readiness Platform",
    h1a: "Measure capability.",
    h1b: "Build readiness.",
    sub: "Four bilingual services for the GCC, in one place: competency assessment centers, organisational AI readiness, 360 leadership feedback, and AI English placement. Choose where to begin.",
    trust: [
      "Bilingual English / Arabic",
      "Calibrated for UAE & Saudi Arabia",
      "AI-assisted, human-aligned scoring",
    ],
    catalogue: "Training catalogue",
    enter: "Enter",
    footerOrg: "Virginia Institute of Finance and Management",
    footerConfidential: "Confidential - for VIFM and engaged clients only.",
    footerGcc: "Built for the GCC",
    services: {
      ac: {
        tagline: "Competency assessment",
        name: "Assessment Center",
        description:
          "Design assessment centers, run exercises and observations, reach scoring consensus in the live wash-up engine, and issue competency reports and learning plans.",
      },
      ara: {
        tagline: "AR Compass diagnostic",
        name: "AI Readiness",
        description:
          "An eight-pillar organisational AI-readiness diagnostic, calibrated to UAE and Saudi frameworks, with bilingual board-ready reports and a complimentary personal snapshot.",
      },
      reflect: {
        tagline: "Leadership feedback",
        name: "Reflect 360",
        description:
          "360-degree leadership feedback built from your own values and competencies, with a development plan per leader and an organisation-wide cohort culture view.",
      },
      fluent: {
        tagline: "AI English placement",
        name: "Fluent",
        description:
          "A four-skill, CEFR-aligned English placement: AI-generated reading and listening, rubric-scored writing and speaking, with an indicative level and feedback in minutes.",
      },
    },
  },
  ar: {
    eyebrow: "منصة VIFM للكفاءات والجاهزية",
    h1a: "قِس القدرات.",
    h1b: "ابنِ الجاهزية.",
    sub: "أربع خدمات ثنائية اللغة لمنطقة الخليج في مكان واحد: مراكز تقييم الكفاءات، وجاهزية المؤسسات للذكاء الاصطناعي، والتغذية الراجعة القيادية بزاوية 360 درجة، وتحديد مستوى اللغة الإنجليزية بالذكاء الاصطناعي. اختر من أين تبدأ.",
    trust: [
      "ثنائية اللغة: الإنجليزية / العربية",
      "مُعايَرة للإمارات والسعودية",
      "تقييم مدعوم بالذكاء الاصطناعي ومتوافق مع المُقيّمين",
    ],
    catalogue: "دليل البرامج التدريبية",
    enter: "الدخول",
    footerOrg: "معهد فرجينيا للتمويل والإدارة",
    footerConfidential: "سري - لـ VIFM والعملاء المتعاقدين فقط.",
    footerGcc: "مُصمّمة لمنطقة الخليج",
    services: {
      ac: {
        tagline: "تقييم الكفاءات",
        name: "مركز التقييم",
        description:
          "صمّم مراكز التقييم، ونفّذ التمارين والملاحظات، وتوصّل إلى توافق في التقييم عبر محرّك المراجعة المباشر، وأصدر تقارير الكفاءات وخطط التطوير.",
      },
      ara: {
        tagline: "تشخيص بوصلة الجاهزية",
        name: "الجاهزية للذكاء الاصطناعي",
        description:
          "تشخيص لجاهزية المؤسسة للذكاء الاصطناعي عبر ثماني ركائز، مُعايَر وفق أُطُر الإمارات والسعودية، مع تقارير ثنائية اللغة جاهزة للعرض على مجلس الإدارة، ولمحة شخصية مجانية.",
      },
      reflect: {
        tagline: "تغذية راجعة قيادية",
        name: "ريفلكت 360",
        description:
          "تغذية راجعة قيادية بزاوية 360 درجة مبنية على قيمكم وكفاءاتكم، مع خطة تطوير لكل قائد وعرض شامل لثقافة المؤسسة بأكملها.",
      },
      fluent: {
        tagline: "تحديد مستوى الإنجليزية بالذكاء الاصطناعي",
        name: "فلوينت",
        description:
          "اختبار لتحديد مستوى الإنجليزية عبر أربع مهارات وفق إطار CEFR: قراءة واستماع مُولّدان بالذكاء الاصطناعي، وكتابة وتحدّث يُقيّمان وفق معايير محدّدة، مع مستوى تقريبي وملاحظات خلال دقائق.",
      },
    },
  },
} as const;

export function PlatformLanding() {
  // Default to English so SSR and first client render match (no hydration
  // mismatch); adopt a remembered choice on mount.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLang(saved);
    } catch {
      /* localStorage unavailable - stay on English */
    }
  }, []);
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore persistence failure */
    }
  };

  const t = T[lang];
  const rtl = lang === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-background">
      {/* ─── Platform hero ─── */}
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-28">
          {/* Top bar */}
          <div className="mb-16 flex items-center justify-between gap-4">
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
              <Sparkles className="h-3 w-3" /> {t.eyebrow}
            </span>
            <h1 className="ara-numeral mt-4 mb-5 text-4xl font-semibold leading-[1.12] text-white sm:text-5xl lg:text-6xl">
              {t.h1a} <span className="ara-accent-sweep">{t.h1b}</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-white/75">{t.sub}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
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

      {/* ─── Service launcher (overlaps the hero) ─── */}
      <main className="relative z-10 mx-auto -mt-16 max-w-6xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {SERVICES.map(({ key, href, icon: Icon, tone }) => {
            const svc = t.services[key];
            return (
              <Link key={key} href={href} className="block h-full">
                <div className={`launcher-card tone-${tone} h-full p-7`}>
                  <Icon className="launcher-card-glyph h-28 w-28" strokeWidth={1} aria-hidden />
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="launcher-card-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="ara-eyebrow mb-1.5">{svc.tagline}</div>
                    <h2 className="text-2xl font-semibold text-primary">{svc.name}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {svc.description}
                    </p>
                    <div className="launcher-card-cta mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
                      {t.enter} <Arrow className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
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
