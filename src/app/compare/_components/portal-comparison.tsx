"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ClipboardCheck, Compass, Aperture, Languages, UserSearch,
  GraduationCap, BadgeCheck, BrainCircuit, Layers, TrendingUp, Layout,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { COMPETENCY_COUNT } from "@/lib/competencies/framework-meta";

type Lang = "en" | "ar";
type Cell = { en: string; ar: string };
const tx = (c: Cell, l: Lang) => (l === "ar" ? c.ar : c.en);

// One lens (Talent Acquisition or Talent Management) of a portal, or a
// not-applicable marker with the reason a single-purpose portal lacks that lens.
type Lens = { measures: Cell; method: Cell; who: Cell; reporting: Cell; credential: Cell };
type Side = Lens | { na: Cell };
const isNa = (s: Side): s is { na: Cell } => "na" in s;

type Portal = {
  key: string;
  icon: typeof Compass;
  name: Cell;
  tagline: Cell;
  acquire: Side;
  manage: Side;
};

const STORAGE_KEY = "vifm-landing-locale";

const UI = {
  en: {
    back: "Back to platform",
    eyebrow: "Platform comparison",
    title: "Talent Acquisition vs Talent Development",
    sub: "Every VIFM portal, side by side - what each one measures and how, and the reporting it produces, in its selection (Talent Acquisition) and development (Talent Management) use.",
    colPortal: "Portal",
    colLens: "Lens",
    colMeasures: "What it measures",
    colMethod: "How it runs",
    colWho: "Who takes it · scale",
    colReporting: "Reporting & output",
    colCredential: "Credential",
    acquisition: "Talent Acquisition",
    development: "Talent Development",
    forSelection: "For selection",
    forDevelopment: "For development",
    legendTitle: "Reading the sheet",
    legendAcq: "Talent Acquisition - screen, place and select.",
    legendDev: "Talent Development - develop, benchmark and certify.",
    legendNa: "Not applicable - this portal serves only one lens.",
  },
  ar: {
    back: "العودة إلى المنصّة",
    eyebrow: "مقارنة المنصّة",
    title: "استقطاب المواهب مقابل تطوير المواهب",
    sub: "كل بوّابات VIFM جنبًا إلى جنب - ما يقيسه كلٌّ منها وكيف، والتقرير الذي ينتجه، في استخدامه للاختيار (استقطاب المواهب) وللتطوير (إدارة المواهب).",
    colPortal: "البوّابة",
    colLens: "الغرض",
    colMeasures: "ما يقيسه",
    colMethod: "آلية التنفيذ",
    colWho: "من يؤديه · النطاق",
    colReporting: "التقرير والمخرجات",
    colCredential: "الشهادة",
    acquisition: "استقطاب المواهب",
    development: "تطوير المواهب",
    forSelection: "للاختيار",
    forDevelopment: "للتطوير",
    legendTitle: "كيفية قراءة الجدول",
    legendAcq: "استقطاب المواهب - فرز وتحديد مستوى واختيار.",
    legendDev: "تطوير المواهب - تطوير ومقارنة مرجعية واعتماد.",
    legendNa: "لا ينطبق - تخدم هذه البوّابة غرضًا واحدًا فقط.",
  },
} as const;

const naSelectionOnly: Cell = { en: "Not applicable - selection only.", ar: "لا ينطبق - للاختيار فقط." };
const naDevelopmentOnly: Cell = { en: "Not applicable - development only.", ar: "لا ينطبق - للتطوير فقط." };

const PORTALS: ReadonlyArray<Portal> = [
  {
    key: "ac",
    icon: ClipboardCheck,
    name: { en: "Assessment Center", ar: "مركز التقييم" },
    tagline: { en: "Competency assessment", ar: "تقييم الكفاءات" },
    acquire: {
      measures: { en: `Behaviour across the ${COMPETENCY_COUNT} competencies, observed in exercises.`, ar: `السلوك عبر الكفاءات الـ${COMPETENCY_COUNT}، مُلاحَظًا في التمارين.` },
      method: { en: "Assessment-center exercises + assessor observation + live wash-up consensus.", ar: "تمارين مركز التقييم + ملاحظة المقيّمين + توافق عبر المراجعة المباشرة." },
      who: { en: "Candidates, by cohort; assessor-run.", ar: "المرشّحون، بحسب الدفعة؛ يُجريها المقيّمون." },
      reporting: { en: "Competency fit-score + OAR recommendation (Ready Now / with Development / Not Ready); 6-page report.", ar: "درجة ملاءمة الكفاءات + توصية التقييم العام (جاهز الآن / مع تطوير / غير جاهز)؛ تقرير من 6 صفحات." },
      credential: { en: "AC Ready-Now (when the finalised OAR is Ready Now).", ar: "جاهز الآن (عند اعتماد التقييم العام كـ«جاهز الآن»)." },
    },
    manage: {
      measures: { en: `The same ${COMPETENCY_COUNT} competencies, read for growth.`, ar: `الكفاءات الـ${COMPETENCY_COUNT} نفسها، بهدف النمو.` },
      method: { en: "Same framework run developmentally.", ar: "الإطار نفسه بهدف التطوير." },
      who: { en: "Employees; individual + cohort.", ar: "الموظفون؛ فرديًا وبالدفعة." },
      reporting: { en: "Strengths/gaps + 30/60/90 learning plan + matched VIFM Academy courses.", ar: "نقاط القوة/الفجوات + خطة تعلّم 30/60/90 + دورات أكاديمية VIFM المطابقة." },
      credential: { en: "Via VIFM Academy completion.", ar: "عبر إتمام أكاديمية VIFM." },
    },
  },
  {
    key: "ara",
    icon: Compass,
    name: { en: "AI Readiness (AR Compass®)", ar: "الجاهزية للذكاء الاصطناعي (بوصلة الجاهزية)" },
    tagline: { en: "AI-readiness diagnostic", ar: "تشخيص الجاهزية للذكاء الاصطناعي" },
    acquire: {
      measures: { en: "How ready a person is to work with AI (four individual factors).", ar: "مدى جاهزية الشخص للعمل مع الذكاء الاصطناعي (أربعة عوامل فردية)." },
      method: { en: "Self-served snapshot; bilingual; calibrated to UAE/Saudi frameworks.", ar: "لمحة ذاتية؛ ثنائية اللغة؛ مُعايَرة وفق أُطُر الإمارات/السعودية." },
      who: { en: "Individuals (free snapshot or deep-dive).", ar: "الأفراد (لمحة مجانية أو تقييم معمّق)." },
      reporting: { en: "AI-readiness fit-score to rank and place people.", ar: "درجة ملاءمة لجاهزية الذكاء الاصطناعي لترتيب الأفراد وتوزيعهم." },
      credential: { en: "None (diagnostic).", ar: "لا توجد (تشخيصي)." },
    },
    manage: {
      measures: { en: "Organisational AI readiness across 8 pillars (+ individual layer).", ar: "جاهزية المؤسسة للذكاء الاصطناعي عبر 8 ركائز (+ طبقة فردية)." },
      method: { en: "Respondent survey (Levels 1-5), distortion checks, peer benchmarks.", ar: "استبيان للمستجيبين (مستويات 1-5)، فحوص تشويه، مقارنات مرجعية." },
      who: { en: "Org cohorts + workforce.", ar: "دفعات المؤسسة + القوى العاملة." },
      reporting: { en: "Readiness gaps -> matched AI courses; board-ready bilingual org report.", ar: "فجوات الجاهزية -> دورات ذكاء اصطناعي مطابقة؛ تقرير مؤسسي ثنائي اللغة جاهز للعرض." },
      credential: { en: "None (diagnostic).", ar: "لا توجد (تشخيصي)." },
    },
  },
  {
    key: "technical",
    icon: BadgeCheck,
    name: { en: "Techno®", ar: "تكنو" },
    tagline: { en: "Technical proficiency", ar: "الكفاءة التقنية" },
    acquire: {
      measures: { en: "Technical proficiency per finance domain (10 domains).", ar: "الكفاءة التقنية لكل مجال مالي (10 مجالات)." },
      method: { en: "Performance-based tasks graded vs master answers; server-held key.", ar: "مهام عملية تُصحَّح وفق إجابات نموذجية؛ مفتاح محفوظ على الخادم." },
      who: { en: "Candidates/delegates via voucher or direct link.", ar: "المرشّحون/المنتدبون عبر قسيمة أو رابط مباشر." },
      reporting: { en: "Technical fit-score for shortlisting (indicative 1-5 band per domain).", ar: "درجة ملاءمة تقنية للقائمة المختصرة (تصنيف استرشادي 1-5 لكل مجال)." },
      credential: { en: "Technical Proficiency (certified path, clears the cut-score).", ar: "كفاءة تقنية (المسار المعتمد، عند تجاوز درجة القطع)." },
    },
    manage: {
      measures: { en: "The same domain skills, read for growth.", ar: "مهارات المجالات نفسها، بهدف النمو." },
      method: { en: "Same hands-on tasks run developmentally.", ar: "المهام العملية نفسها بهدف التطوير." },
      who: { en: "Employees; individual + cohort.", ar: "الموظفون؛ فرديًا وبالدفعة." },
      reporting: { en: "Skill gaps -> VIFM Academy technical courses + per-block development tips.", ar: "فجوات المهارات -> دورات تقنية من أكاديمية VIFM + نصائح تطوير لكل قسم." },
      credential: { en: "Technical Proficiency (certified path).", ar: "كفاءة تقنية (المسار المعتمد)." },
    },
  },
  {
    key: "cognitive",
    icon: BrainCircuit,
    name: { en: "Logical®", ar: "لوجيكال" },
    tagline: { en: "Reasoning aptitude", ar: "القدرة على الاستدلال" },
    acquire: {
      measures: { en: "Numerical, verbal, inductive and deductive reasoning (+ g composite).", ar: "الاستدلال العددي واللفظي والاستقرائي والاستنتاجي (+ مؤشّر القدرة العامة)." },
      method: { en: "Server-scored MCQ, admin-run, bilingual; indicative bands.", ar: "اختيار من متعدد يُصحَّح على الخادم، يُجريه المسؤول، ثنائي اللغة؛ تصنيفات استرشادية." },
      who: { en: "Candidates; admin-run for a record.", ar: "المرشّحون؛ يُجريها المسؤول للسجلّ." },
      reporting: { en: "Foundational aptitude signal for screening and shortlisting.", ar: "إشارة قدرات تأسيسية للفرز والقائمة المختصرة." },
      credential: { en: "None (indicative).", ar: "لا توجد (استرشادي)." },
    },
    manage: {
      measures: { en: "The same reasoning profile, read for growth.", ar: "الملف الاستدلالي نفسه، بهدف النمو." },
      method: { en: "Same battery, developmental framing.", ar: "المجموعة نفسها، بإطار تطويري." },
      who: { en: "Employees; individual.", ar: "الموظفون؛ فرديًا." },
      reporting: { en: "Reasoning strengths/gaps that point to the right stretch work + courses.", ar: "نقاط قوة/فجوات الاستدلال توجّه نحو المهام التطويرية المناسبة + الدورات." },
      credential: { en: "None (indicative).", ar: "لا توجد (استرشادي)." },
    },
  },
  {
    key: "persona",
    icon: Layers,
    name: { en: "Persona®", ar: "بيرسونا" },
    tagline: { en: "Behavioural self-assessment", ar: "تقييم سلوكي ذاتي" },
    acquire: {
      measures: { en: `Self-ratings across the ${COMPETENCY_COUNT} competencies (the 'self' view).`, ar: `تقييم ذاتي عبر الكفاءات الـ${COMPETENCY_COUNT} (رؤية «الذات»).` },
      method: { en: "Likert + forced-choice (most/least) self-report; bilingual.", ar: "ليكرت + اختيار إجباري (الأكثر/الأقل) تقييم ذاتي؛ ثنائي اللغة." },
      who: { en: "Candidates; individual.", ar: "المرشّحون؛ فرديًا." },
      reporting: { en: "Behavioural fit signal vs a target role (fit %, prioritised gaps).", ar: "إشارة ملاءمة سلوكية مقابل دور مستهدف (نسبة ملاءمة، فجوات مرتّبة)." },
      credential: { en: "None.", ar: "لا توجد." },
    },
    manage: {
      measures: { en: `The same ${COMPETENCY_COUNT} competencies, for self-insight.`, ar: `الكفاءات الـ${COMPETENCY_COUNT} نفسها، للرؤية الذاتية.` },
      method: { en: "Same self-report, developmental framing.", ar: "التقييم الذاتي نفسه، بإطار تطويري." },
      who: { en: "Employees; individual.", ar: "الموظفون؛ فرديًا." },
      reporting: { en: "Self-insight -> development plan + matched VIFM Academy courses.", ar: "رؤية ذاتية -> خطة تطوير + دورات أكاديمية VIFM المطابقة." },
      credential: { en: "None.", ar: "لا توجد." },
    },
  },
  {
    key: "fluent",
    icon: Languages,
    name: { en: "Fluent®", ar: "فلوينت" },
    tagline: { en: "AI English placement", ar: "تحديد مستوى الإنجليزية بالذكاء الاصطناعي" },
    acquire: {
      measures: { en: "English across four skills, CEFR A1-C2.", ar: "الإنجليزية عبر أربع مهارات، إطار CEFR من A1 إلى C2." },
      method: { en: "AI reading/listening (auto), writing/speaking (rubric-scored); indicative.", ar: "قراءة/استماع بالذكاء الاصطناعي (آلي)، كتابة/تحدّث (تقييم بمعايير)؛ استرشادي." },
      who: { en: "Candidates; any scale.", ar: "المرشّحون؛ أي نطاق." },
      reporting: { en: "Indicative CEFR level to screen and place candidates.", ar: "مستوى CEFR استرشادي لفرز المرشّحين وتحديد مستواهم." },
      credential: { en: "Fluent CEFR certificate.", ar: "شهادة فلوينت CEFR." },
    },
    manage: {
      measures: { en: "The same four-skill CEFR profile, for growth.", ar: "ملف المهارات الأربع وفق CEFR نفسه، للنمو." },
      method: { en: "Same placement, developmental framing.", ar: "التحديد نفسه، بإطار تطويري." },
      who: { en: "Employees; any scale.", ar: "الموظفون؛ أي نطاق." },
      reporting: { en: "Comprehensive 4-skill report -> the right English programmes.", ar: "تقرير شامل للمهارات الأربع -> برامج الإنجليزية المناسبة." },
      credential: { en: "Fluent CEFR certificate.", ar: "شهادة فلوينت CEFR." },
    },
  },
  {
    key: "prehire",
    icon: UserSearch,
    name: { en: "Pre-Hire®", ar: "ما قبل التوظيف" },
    tagline: { en: "Pre-employment screening", ar: "الفرز قبل التوظيف" },
    acquire: {
      measures: { en: "A weighted composite screen: competency quiz + English + AI interview.", ar: "فرز مركّب مرجّح: اختبار كفاءات + إنجليزية + مقابلة بالذكاء الاصطناعي." },
      method: { en: "Configurable funnel; weighted composite; adverse-impact monitoring; audit trail.", ar: "مسار قابل للتخصيص؛ درجة مركّبة مرجّحة؛ مراقبة الأثر التمييزي؛ سجلّ تدقيق." },
      who: { en: "External applicants, at scale (no account).", ar: "المتقدّمون الخارجيون، على نطاق واسع (دون حساب)." },
      reporting: { en: "Ranked shortlist + per-candidate screening report; advisory band (never auto-reject).", ar: "قائمة مختصرة مرتّبة + تقرير فرز لكل مرشّح؛ تصنيف استرشادي (لا رفض تلقائي)." },
      credential: { en: "None.", ar: "لا توجد." },
    },
    manage: { na: naSelectionOnly },
  },
  {
    key: "reflect",
    icon: Aperture,
    name: { en: "Reflect 360®", ar: "ريفلكت 360" },
    tagline: { en: "360 leadership feedback", ar: "تغذية راجعة قيادية 360" },
    acquire: { na: naDevelopmentOnly },
    manage: {
      measures: { en: "360 leadership feedback on the client's own values/competencies.", ar: "تغذية راجعة قيادية 360 على قيم/كفاءات العميل نفسه." },
      method: { en: "Self + Manager + Peer + Direct Report raters, 5-point frequency; anonymity threshold.", ar: "مقيّمون: الذات + المدير + الأقران + المرؤوسون، مقياس تكرار من 5 نقاط؛ حدّ أدنى للسرّية." },
      who: { en: "Leaders + their raters.", ar: "القادة + مقيّموهم." },
      reporting: { en: "Participant report + IDP, cohort culture view, year-on-year deltas.", ar: "تقرير المشارك + خطة التطوير الفردية، عرض ثقافة الدفعة، فروقات سنوية." },
      credential: { en: "None.", ar: "لا توجد." },
    },
  },
  {
    key: "readiness",
    icon: TrendingUp,
    name: { en: "Succession Readiness", ar: "جاهزية التعاقب" },
    tagline: { en: "Self + 360 vs the role", ar: "الذات + 360 مقابل الدور" },
    acquire: { na: naDevelopmentOnly },
    manage: {
      measures: { en: "Readiness for a target role: Persona (self) + Reflect 360 (others) vs the role.", ar: "الجاهزية لدور مستهدف: بيرسونا (الذات) + ريفلكت 360 (الآخرون) مقابل الدور." },
      method: { en: "Fuses self + 360 against the target role profile.", ar: "يدمج الذات + 360 مقابل ملف الدور المستهدف." },
      who: { en: "High-potentials / succession candidates.", ar: "أصحاب الإمكانات العالية / مرشّحو التعاقب." },
      reporting: { en: "Readiness tier + gaps + blind spots + development plan (9-box).", ar: "مستوى الجاهزية + الفجوات + النقاط العمياء + خطة التطوير (مصفوفة 9 خانات)." },
      credential: { en: "None.", ar: "لا توجد." },
    },
  },
  {
    key: "academy",
    icon: GraduationCap,
    name: { en: "VIFM Academy", ar: "أكاديمية VIFM" },
    tagline: { en: "Learning & delivery", ar: "التعلّم والتقديم" },
    acquire: { na: naDevelopmentOnly },
    manage: {
      measures: { en: "Learning delivery + per-lesson knowledge checks (delivery, not a diagnostic).", ar: "تقديم التعلّم + اختبارات معرفية لكل درس (تقديم، وليس تشخيصًا)." },
      method: { en: "Self-paced programmes; AI knowledge-check per lesson; pass-gate.", ar: "برامج ذاتية الوتيرة؛ اختبار معرفي بالذكاء الاصطناعي لكل درس؛ بوّابة نجاح." },
      who: { en: "Learners; English or Arabic.", ar: "المتعلّمون؛ بالعربية أو الإنجليزية." },
      reporting: { en: "Completion + scores; closes the gaps the diagnostics found.", ar: "الإتمام + الدرجات؛ يعالج الفجوات التي كشفتها الأدوات التشخيصية." },
      credential: { en: "Verifiable completion credential.", ar: "شهادة إتمام قابلة للتحقّق." },
    },
  },
];

export function PortalComparison() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const cookie = document.cookie.match(/(?:^|;\s*)vifm-locale=(ar|en)/)?.[1];
      const saved = cookie ?? localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLang(saved);
    } catch {
      /* stay on English */
    }
  }, []);
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `vifm-locale=${l}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  };

  const t = UI[lang];
  const rtl = lang === "ar";

  // Two lens rows per portal. The lens cell carries the brand colour pair the
  // landing uses: light blue (#5391D5) = Talent Acquisition, dark blue (#111232)
  // = Talent Development.
  const lensBadge = (acq: boolean) => (
    <div
      className={`inline-flex flex-col rounded-md px-2 py-1 ${
        acq ? "bg-[#5391D5] text-[#010131]" : "bg-[#111232] text-[#FEFFF9]"
      }`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">
        {acq ? t.forSelection : t.forDevelopment}
      </span>
      <span className="text-xs font-bold leading-tight">
        {acq ? t.acquisition : t.development}
      </span>
    </div>
  );

  const sideCells = (side: Side) => {
    if (isNa(side)) {
      return (
        <td colSpan={5} className="px-3 py-3 text-center text-xs italic text-muted-foreground">
          {tx(side.na, lang)}
        </td>
      );
    }
    const cell = "px-3 py-3 align-top text-xs leading-snug text-foreground/90";
    return (
      <>
        <td className={cell}>{tx(side.measures, lang)}</td>
        <td className={cell}>{tx(side.method, lang)}</td>
        <td className={cell}>{tx(side.who, lang)}</td>
        <td className={`${cell} bg-[#5391D5]/[0.07] font-medium text-foreground`}>{tx(side.reporting, lang)}</td>
        <td className={cell}>{tx(side.credential, lang)}</td>
      </>
    );
  };

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-full flex-col bg-background">
      {/* Header */}
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pt-3 pb-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="sm" />
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t.back}
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
          <span className="ara-eyebrow text-accent">
            <Layout className="h-3 w-3" /> {t.eyebrow}
          </span>
          <h1 className="ara-numeral mt-2 mb-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">{t.title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-white/75">{t.sub}</p>
        </div>
      </header>

      {/* Table */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[960px] border-collapse text-start">
            <thead>
              <tr className="border-b bg-muted/50 text-start">
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colPortal}</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colLens}</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colMeasures}</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colMethod}</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colWho}</th>
                <th className="bg-[#5391D5]/[0.12] px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-[#0b3b66]">{t.colReporting}</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.colCredential}</th>
              </tr>
            </thead>
            {PORTALS.map((p) => {
              const Icon = p.icon;
              return (
                <tbody key={p.key} className="border-b last:border-b-0">
                  <tr className="border-b border-border/50">
                    <td rowSpan={2} className="w-48 px-3 py-3 align-top">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5391D5]/10 text-[#010131]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#010131]">{tx(p.name, lang)}</div>
                          <div className="text-[11px] text-muted-foreground">{tx(p.tagline, lang)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">{lensBadge(true)}</td>
                    {sideCells(p.acquire)}
                  </tr>
                  <tr>
                    <td className="px-3 py-3 align-top">{lensBadge(false)}</td>
                    {sideCells(p.manage)}
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <div className="mb-2 text-xs font-semibold text-foreground">{t.legendTitle}</div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#5391D5]" /> {t.legendAcq}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#111232]" /> {t.legendDev}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border border-border bg-card" /> {t.legendNa}
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
