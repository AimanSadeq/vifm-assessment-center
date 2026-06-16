"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, ClipboardCheck, Compass, Aperture, Languages, UserSearch,
  GraduationCap, BadgeCheck, BrainCircuit, Layers, ShieldCheck, TrendingUp,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Lang = "en" | "ar";
type Tone = "blue" | "violet" | "teal" | "gold" | "rose" | "indigo" | "fuchsia" | "emerald" | "amber";
type ServiceKey = "ac" | "ara" | "reflect" | "fluent" | "prehire" | "technical" | "cognitive" | "persona" | "readiness" | "academy";
// The two solution families (the colleague's talent-lifecycle model).
type Pillar = "acquire" | "manage";

const STORAGE_KEY = "vifm-landing-locale";

// Icon / hue / route / pillars are language-independent; copy comes from T[lang].services.
// A service in BOTH pillars (ac / ara / technical) renders once per column with
// pillar-specific copy from VARIANTS below: Talent Acquisition = "for selection"
// (fit-score outcome), Talent Management = "for development" (course outcome).
const SERVICES: ReadonlyArray<{ key: ServiceKey; href: string; icon: typeof Compass; tone: Tone; pillars: Pillar[] }> = [
  // ── Dual-purpose diagnostics (lead both columns, same order on each side):
  //    each serves selection (Talent Acquisition) and development (Talent Management). ──
  { key: "ac", href: "/admin", icon: ClipboardCheck, tone: "blue", pillars: ["acquire", "manage"] },
  { key: "ara", href: "/ara", icon: Compass, tone: "violet", pillars: ["acquire", "manage"] },
  { key: "technical", href: "/admin/tech-sandbox", icon: BadgeCheck, tone: "indigo", pillars: ["acquire", "manage"] },
  // Cognitive (aptitude) + Persona (the 38-competency behavioural self-assessment,
  // the "self" view of readiness) - individual diagnostics, dual-purpose too.
  { key: "cognitive", href: "/ac/cognitive", icon: BrainCircuit, tone: "fuchsia", pillars: ["acquire", "manage"] },
  { key: "persona", href: "/ac/persona", icon: Layers, tone: "fuchsia", pillars: ["acquire", "manage"] },
  // ── Talent Acquisition only ──
  { key: "prehire", href: "/admin/prehire", icon: UserSearch, tone: "rose", pillars: ["acquire"] },
  { key: "fluent", href: "/ac/fluent", icon: Languages, tone: "gold", pillars: ["acquire"] },
  // ── Talent Management only ──
  { key: "reflect", href: "/reflect", icon: Aperture, tone: "teal", pillars: ["manage"] },
  // Succession Readiness fuses Persona (self) + a Reflect 360 (others) vs a role.
  { key: "readiness", href: "/admin/readiness", icon: TrendingUp, tone: "amber", pillars: ["manage"] },
  { key: "academy", href: "/courses", icon: GraduationCap, tone: "emerald", pillars: ["manage"] },
];

// Per-pillar copy overrides for the dual-purpose services. The base copy in
// T[lang].services is used for the (default) acquire side where no override
// exists; these refine name / tagline / outcome and add the selection vs
// development badge. Selection => fit-score report; Development => VIFM Academy courses.
type Variant = { name?: string; tagline?: string; description?: string; tooltip?: string; badge?: string };
const VARIANTS: Record<Lang, Partial<Record<ServiceKey, Partial<Record<Pillar, Variant>>>>> = {
  en: {
    ac: {
      acquire: {
        name: "Assessment Center", tagline: "Competency assessment · selection", badge: "For Selection",
        description: "Observe behaviour across exercises and reach scoring consensus - a competency fit-score for hiring and promotion decisions.",
        tooltip: "Selection use: a defensible competency fit-score for hiring and promotion.",
      },
      manage: {
        name: "Development Center", tagline: "Competency development · development", badge: "For Development",
        description: "The same framework run developmentally - strengths and gaps become a personal plan and matched VIFM Academy courses.",
        tooltip: "Development use: strengths, gaps and a course-mapped development plan.",
      },
    },
    ara: {
      acquire: {
        name: "AI Readiness", tagline: "AR Compass · selection", badge: "For Selection",
        description: "Screen people for AI readiness and get a fit-score report - how ready each person is to work with AI, for selection.",
        tooltip: "Selection use: an AI-readiness fit-score to rank and place people.",
      },
      manage: {
        name: "AI Readiness", tagline: "AR Compass · development", badge: "For Development",
        description: "Diagnose AI-readiness gaps and turn them into matched VIFM Academy courses that build the capability.",
        tooltip: "Development use: readiness gaps mapped to AI-capability courses.",
      },
    },
    technical: {
      acquire: {
        name: "Technical Assessment", tagline: "Technical proficiency · selection", badge: "For Selection",
        description: "Hands-on, function-specific tasks graded against master answers - a technical fit-score for shortlisting and selection.",
        tooltip: "Selection use: a hands-on technical fit-score for shortlisting.",
      },
      manage: {
        name: "Technical Assessment", tagline: "Technical proficiency · development", badge: "For Development",
        description: "The same hands-on tasks run developmentally - results map to VIFM Academy courses that close each skill gap.",
        tooltip: "Development use: skill gaps mapped to technical courses.",
      },
    },
    cognitive: {
      acquire: {
        tagline: "Cognitive ability · selection", badge: "For Selection",
        description: "Numerical, verbal, inductive and deductive reasoning - an aptitude fit signal to screen and shortlist candidates.",
        tooltip: "Selection use: a foundational aptitude signal for screening.",
      },
      manage: {
        tagline: "Cognitive ability · development", badge: "For Development",
        description: "Reasoning strengths and gaps that point each person toward the right stretch work and VIFM Academy courses.",
        tooltip: "Development use: a reasoning profile to guide growth and learning.",
      },
    },
    persona: {
      acquire: {
        tagline: "Behavioural self-assessment · selection", badge: "For Selection",
        description: "Self-ratings across the 38 competencies - a behavioural fit signal alongside the rest of the screen.",
        tooltip: "Selection use: a behavioural self-view to complement screening.",
      },
      manage: {
        tagline: "Behavioural self-assessment · development", badge: "For Development",
        description: "Self-insight across the 38 competencies - development areas become a plan and matched VIFM Academy courses.",
        tooltip: "Development use: self-insight feeding a development plan.",
      },
    },
  },
  ar: {
    ac: {
      acquire: {
        name: "مركز التقييم", tagline: "تقييم الكفاءات · للاختيار", badge: "للاختيار",
        description: "لاحِظ السلوك عبر التمارين وتوصّل إلى توافق في التقييم - درجة ملاءمة كفاءات لقرارات التوظيف والترقية.",
        tooltip: "للاختيار: درجة ملاءمة كفاءات موثوقة للتوظيف والترقية.",
      },
      manage: {
        name: "مركز التطوير", tagline: "تطوير الكفاءات · للتطوير", badge: "للتطوير",
        description: "الإطار نفسه بهدف التطوير - تتحوّل نقاط القوة والفجوات إلى خطة فردية ودورات من أكاديمية VIFM.",
        tooltip: "للتطوير: نقاط قوة وفجوات وخطة تطوير مرتبطة بالدورات.",
      },
    },
    ara: {
      acquire: {
        name: "الجاهزية للذكاء الاصطناعي", tagline: "بوصلة الجاهزية · للاختيار", badge: "للاختيار",
        description: "افحص جاهزية الأفراد للذكاء الاصطناعي واحصل على تقرير درجة ملاءمة - مدى جاهزية كل شخص للعمل مع الذكاء الاصطناعي، للاختيار.",
        tooltip: "للاختيار: درجة ملاءمة لجاهزية الذكاء الاصطناعي لترتيب الأفراد.",
      },
      manage: {
        name: "الجاهزية للذكاء الاصطناعي", tagline: "بوصلة الجاهزية · للتطوير", badge: "للتطوير",
        description: "شخّص فجوات الجاهزية للذكاء الاصطناعي وحوّلها إلى دورات من أكاديمية VIFM تبني القدرة.",
        tooltip: "للتطوير: فجوات مرتبطة بدورات بناء قدرات الذكاء الاصطناعي.",
      },
    },
    technical: {
      acquire: {
        name: "التقييم التقني", tagline: "الكفاءة التقنية · للاختيار", badge: "للاختيار",
        description: "مهام عملية خاصة بالوظيفة تُصحَّح وفق إجابات نموذجية - درجة ملاءمة تقنية للفرز والاختيار.",
        tooltip: "للاختيار: درجة ملاءمة تقنية عملية للفرز.",
      },
      manage: {
        name: "التقييم التقني", tagline: "الكفاءة التقنية · للتطوير", badge: "للتطوير",
        description: "المهام العملية نفسها بهدف التطوير - تُربط النتائج بدورات من أكاديمية VIFM تعالج كل فجوة مهارة.",
        tooltip: "للتطوير: فجوات المهارات مرتبطة بالدورات التقنية.",
      },
    },
    cognitive: {
      acquire: {
        tagline: "القدرة الذهنية · للاختيار", badge: "للاختيار",
        description: "الاستدلال العددي واللفظي والمجرّد - إشارة ملاءمة للقدرات لفرز المرشّحين وإعداد القائمة المختصرة.",
        tooltip: "للاختيار: إشارة قدرات تأسيسية للفرز.",
      },
      manage: {
        tagline: "القدرة الذهنية · للتطوير", badge: "للتطوير",
        description: "نقاط القوة والفجوات في الاستدلال توجّه كل شخص نحو المهام التطويرية المناسبة ودورات أكاديمية VIFM.",
        tooltip: "للتطوير: ملف استدلالي لتوجيه النمو والتعلّم.",
      },
    },
    persona: {
      acquire: {
        tagline: "تقييم سلوكي ذاتي · للاختيار", badge: "للاختيار",
        description: "تقييم ذاتي عبر الكفاءات الـ38 - إشارة ملاءمة سلوكية إلى جانب بقية الفرز.",
        tooltip: "للاختيار: رؤية ذاتية سلوكية تكمّل الفرز.",
      },
      manage: {
        tagline: "تقييم سلوكي ذاتي · للتطوير", badge: "للتطوير",
        description: "رؤية ذاتية عبر الكفاءات الـ38 - تتحوّل مجالات التطوير إلى خطة ودورات من أكاديمية VIFM.",
        tooltip: "للتطوير: رؤية ذاتية تغذّي خطة التطوير.",
      },
    },
  },
};

const T = {
  en: {
    pickLang: "Language",
    catalogue: "Training catalogue",
    admin: "Admin",
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
      technical: { tagline: "Technical proficiency", name: "Technical Assessment", description: "Performance-based, function-specific assessment: candidates do real work in live sandboxes (build a 3-statement model, a variance breakdown, write SQL) graded against master answers and banded Basic / Intermediate / Advanced per competency. Issue a direct link per delegate, or hand a client voucher codes to self-distribute.", tooltip: "Best for screening and developing functional skills with hands-on tasks." },
      cognitive: { tagline: "Cognitive ability", name: "Cognitive", description: "Indicative numerical, verbal, inductive and deductive reasoning - a foundational read on aptitude. Server-scored, admin-run and bilingual.", tooltip: "Best for a foundational read on reasoning and aptitude." },
      persona: { tagline: "Behavioural self-assessment", name: "Persona", description: "Self-ratings across the 38 competencies - the same framework as the 360. The 'self' view that feeds Succession Readiness.", tooltip: "Best for fast behavioural self-insight on the 38 competencies." },
      readiness: { tagline: "Self + 360 vs the role", name: "Succession Readiness", description: "Combines Persona (self) and a Reflect 360 (others) against a target role to produce a readiness tier, gaps, blind spots and a development plan.", tooltip: "Best for judging whether someone is ready for a target role." },
      prehire: { tagline: "Pre-employment screening", name: "Pre-Hire", description: "Screen and shortlist applicants before you hire: a configurable funnel of competency quiz, English placement and an AI behavioural interview, with a weighted composite, adverse-impact monitoring and an audit trail. The score is a signal — a person always decides.", tooltip: "Best for shortlisting applicants at scale, defensibly." },
      academy: { tagline: "Learning & delivery", name: "VIFM Academy", description: "Self-paced finance & management programmes that turn each diagnosis into action — AI knowledge-checks per lesson and a verifiable completion credential, in English or Arabic.", tooltip: "Best for closing development gaps with guided, credentialed learning." },
    },
  },
  ar: {
    pickLang: "اللغة",
    catalogue: "دليل البرامج التدريبية",
    admin: "الإدارة",
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
      cognitive: { tagline: "القدرة الذهنية", name: "القدرات الذهنية", description: "مقاييس استرشادية للاستدلال العددي واللفظي والمجرّد - قراءة تأسيسية للقدرات. تُصحَّح على الخادم، يُجريها المسؤول، وثنائية اللغة.", tooltip: "الأنسب لقراءة تأسيسية للاستدلال والقدرات." },
      persona: { tagline: "تقييم سلوكي ذاتي", name: "بيرسونا", description: "تقييم ذاتي عبر الكفاءات الـ38 - الإطار نفسه المستخدم في تقييم 360. تمثّل رؤية «الذات» التي تغذّي جاهزية التعاقب.", tooltip: "الأنسب لرؤية ذاتية سلوكية سريعة عبر الكفاءات الـ38." },
      readiness: { tagline: "الذات + 360 مقابل الدور", name: "جاهزية التعاقب", description: "تجمع بيرسونا (الذات) وتقييم ريفلكت 360 (الآخرون) مقابل دور مستهدف لإنتاج مستوى جاهزية وفجوات ونقاط عمياء وخطة تطوير.", tooltip: "الأنسب للحكم على جاهزية الشخص لدور مستهدف." },
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

  // One launcher card. Shared by the flat tiles and the Psychometrics cluster.
  // `pillar` lets a dual-purpose service show selection vs development copy.
  const renderCard = (svc: (typeof SERVICES)[number], pillar: Pillar) => {
    const Icon = svc.icon;
    const variant = VARIANTS[lang]?.[svc.key]?.[pillar];
    const copy = { ...t.services[svc.key], ...variant };
    const badge = variant?.badge;
    // Icon / card accent colour is keyed to the PILLAR, not the service, so the
    // two solution families read as two colours at a glance: blue = Talent
    // Acquisition (selection), emerald = Talent Management (development). Matches
    // the For Selection / For Development badges.
    const tone = pillar === "acquire" ? "blue" : "emerald";
    const badgeClass =
      pillar === "acquire"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-emerald-300/60 bg-emerald-50 text-emerald-700";
    return (
      <Tooltip key={svc.key}>
        <TooltipTrigger asChild>
          <Link href={svc.href} className="block">
            <div className={`launcher-card tone-${tone} flex items-center gap-4 p-4`}>
              <div className="launcher-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="ara-eyebrow">{copy.tagline}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-primary">{copy.name}</h4>
                  {badge && (
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                      {badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{copy.description}</p>
              </div>
              <div className="launcher-card-cta shrink-0 self-center">
                <Arrow className="h-5 w-5" />
              </div>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center leading-snug">
          {copy.tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

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
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {t.admin}
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
            {/* Two-row subgrid: both pillar headers share row 1 (so they equalise
                height regardless of how the sub-text wraps) and both tile stacks
                share row 2 - keeping the columns aligned. Each column still nests
                its own header + tiles, so it stacks correctly on mobile. */}
            <div className="mt-6 grid gap-x-8 gap-y-10 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-y-0">
              {(["acquire", "manage"] as const).map((pillar) => (
                <div key={pillar} className="lg:row-span-2 lg:grid lg:grid-rows-subgrid">
                  {/* Big pillar heading (the two solution families) */}
                  <div className="border-b-2 border-accent/30 pb-2.5">
                    <h3 className="ara-numeral whitespace-nowrap text-[1.45rem] font-extrabold uppercase leading-tight tracking-tight text-accent sm:text-[1.6rem]">
                      {t.pillars[pillar].title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t.pillars[pillar].sub}</p>
                  </div>

                  {/* Services stacked underneath - each instrument its own card. */}
                  <div className="mt-4 space-y-3">
                    {SERVICES.filter((s) => s.pillars.includes(pillar)).map((svc) => renderCard(svc, pillar))}
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
