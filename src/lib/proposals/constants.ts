// Proposal service catalogue: maps each Caliber service to its rate-card key,
// display label, brand accent, downloadable methodology brief slug, and a concise
// "technical approach" blurb used in the proposal's technical section. Derived
// from the canonical PORTAL_SERVICES so the proposal list never drifts from the
// 7 sellable services.

import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import type { ProposalServiceKey } from "@/lib/proposals/licensing";

/** Caliber service key -> the /api/methodology/[slug]/pdf brief slug. */
export const PROPOSAL_METHODOLOGY_SLUG: Record<ProposalServiceKey, string> = {
  fluent: "fluent",
  logica: "logica",
  persona: "persona",
  techno: "techno",
  prehire: "prehire",
  arc: "ai-readiness",
  reflect: "reflect",
  bespoke: "bespoke-services",
  succession: "succession-planning",
};

/** One-paragraph "what it measures + how" for the proposal's technical section. */
export const PROPOSAL_BLURB: Record<ProposalServiceKey, string> = {
  fluent:
    "Indicative CEFR English placement across reading, listening, writing and speaking. Receptive skills are auto-scored; productive skills are AI-scored against a CEFR rubric with human-review calibration. Positioned as indicative placement, not a certified high-stakes qualification.",
  logica:
    "Indicative cognitive reasoning aptitude across numerical, verbal, inductive and deductive reasoning. The full keyed test is held server-side and graded there, with option order re-randomised per administration to protect result validity.",
  persona:
    "Behavioural competency self-assessment mapped to the VIFM 41-competency framework, with optional decision-rights (DARE) and emotional-intelligence lenses on the same sitting. Produces a development-grade profile and, where a target role is set, a role-fit view.",
  techno:
    "Function-specific technical proficiency drawn from an SME-reviewed item bank. Delivers an indicative 1-5 band per domain, or a certified, publicly verifiable credential when the score clears the documented cut-score. Secure delivery with a server-held answer key.",
  prehire:
    "Commercial pre-employment screening that orchestrates a competency check, an English placement and a short behavioural interview into a single advisory composite. It is a screening signal for selection - not a development diagnostic, and never an auto-reject: a person always makes the hiring decision.",
  arc:
    "Organisational and individual AI readiness across eight pillars, benchmarked against peers with year-on-year tracking. Deliverables include a bilingual (EN/AR) consultant report, a capability-building plan and a regulatory-alignment view for UAE and Saudi frameworks.",
  reflect:
    "Multi-rater 360 leadership feedback against the client's own competency framework. Self, manager, peer and direct-report ratings roll up into anonymity-protected participant and cohort reports with an individual development plan.",
  bespoke:
    "Configurable assessment solutions assembled from the Caliber instrument suite - custom bundles, role-readiness batteries and client-specific assessment designs - scoped, configured and reported to the client's own framework by VIFM consultants.",
  succession:
    "Succession and role-readiness evaluation combining behavioural (Persona) and technical (Techno) evidence against a defined target role, producing a ready / not-ready verdict with a personal development plan for each succession candidate."
};

/** Concrete deliverables per service, listed under each technical-approach block. */
export const PROPOSAL_DELIVERABLES: Record<ProposalServiceKey, string[]> = {
  fluent: [
    "Individual CEFR placement report with per-skill breakdown (reading, listening, writing, speaking)",
    "Downloadable placement certificate per participant",
    "Cohort placement matrix for programme planning",
  ],
  logica: [
    "Individual reasoning profile with per-subtest bands (numerical, verbal, inductive, deductive)",
    "Cohort analytics with band distributions",
    "Administration integrity signals surfaced to the programme owner",
  ],
  persona: [
    "Individual behavioural profile across the VIFM 41-competency framework",
    "Optional decision-rights (DARE) and emotional-intelligence report lenses",
    "Role-fit view where a target role profile is set",
    "Cohort intelligence sheet for the sponsoring organization",
  ],
  techno: [
    "Per-domain technical proficiency bands with skill-level detail",
    "Publicly verifiable Technical Proficiency credential where the documented cut-score is met",
    "Cohort readiness view across the assessed functions",
  ],
  prehire: [
    "Per-candidate screening report with advisory composite (never an auto-reject)",
    "Ranked shortlist across the full requisition",
    "Adverse-impact (4/5ths) monitoring view and immutable audit trail",
    "ATS-ready JSON/CSV export",
  ],
  arc: [
    "Bilingual (EN/AR) organizational AI-readiness report across the assessed pillars",
    "Pillar heatmap, investment matrix and phased capability-building roadmap",
    "Regulatory-alignment view for the applicable UAE / Saudi frameworks",
    "Year-on-year comparison on reassessment",
  ],
  reflect: [
    "Anonymity-protected participant 360 report per leader",
    "Individual development plan (IDP) per participant",
    "Organization-wide cohort report with strengths and blind-spots",
  ],
  bespoke: [
    "Scoped assessment design agreed with the client (instruments, competency scope, pass criteria)",
    "Configured battery on the Caliber platform with client-branded delivery",
    "Custom report format mapped to the client's own framework",
    "Consultant walkthrough of results and recommendations",
  ],
  succession: [
    "Target-role readiness profile (behavioural + technical evidence)",
    "Per-candidate ready / not-ready verdict with rationale",
    "Individual development plan per succession candidate",
    "Cohort succession-bench summary for HR leadership",
  ]
};

/** Arabic display label per service (brand names transliterated; used in the
 *  bilingual proposal's bundle-contents block). */
export const PROPOSAL_SERVICE_LABEL_AR: Record<ProposalServiceKey, string> = {
  fluent: "فلوينت (تحديد مستوى اللغة الإنجليزية)",
  logica: "لوجيكا (القدرات الاستدلالية)",
  persona: "بيرسونا (التقييم السلوكي)",
  techno: "تكنو (الكفاءة الفنية)",
  prehire: "الفرز قبل التوظيف",
  arc: "بوصلة الاستعداد للذكاء الاصطناعي",
  reflect: "ريفلكت 360 (التغذية الراجعة القيادية)",
  bespoke: "الخدمات المُخصّصة",
  succession: "التخطيط للتعاقب الوظيفي",
};

/** Arabic "what it measures + how" per service. */
export const PROPOSAL_BLURB_AR: Record<ProposalServiceKey, string> = {
  fluent:
    "تحديد استرشادي لمستوى اللغة الإنجليزية وفق الإطار الأوروبي المرجعي (CEFR) عبر القراءة والاستماع والكتابة والتحدث. تُصحَّح المهارات الاستقبالية آليًا، وتُقيَّم المهارات الإنتاجية بالذكاء الاصطناعي وفق معيار CEFR مع معايرة بشرية. يُقدَّم كتحديد استرشادي وليس شهادة عالية المخاطر.",
  logica:
    "قياس استرشادي للقدرات الاستدلالية عبر الاستدلال العددي واللفظي والاستقرائي والاستنباطي. يُحفظ الاختبار الكامل بمفتاح إجاباته على الخادم ويُصحَّح هناك، مع إعادة ترتيب الخيارات في كل جلسة لحماية صدق النتائج.",
  persona:
    "تقييم ذاتي للكفاءات السلوكية وفق إطار VIFM المكوَّن من 41 كفاءة، مع إمكانية إضافة عدسة أدوار القرار (DARE) والذكاء العاطفي في الجلسة نفسها. يُنتج ملفًا تطويريًا، وعند تحديد دور مستهدف يُنتج قراءة للملاءمة مع الدور.",
  techno:
    "كفاءة فنية خاصة بكل مجال وظيفي مستمدة من بنك أسئلة مُراجَع من خبراء الموضوع. يقدّم تصنيفًا استرشاديًا من 1 إلى 5 لكل مجال، أو اعتمادًا موثَّقًا وقابلًا للتحقق العام عند تجاوز درجة القطع الموثقة. تسليم آمن بمفتاح إجابات محفوظ على الخادم.",
  prehire:
    "فرز تجاري لما قبل التوظيف يجمع فحص كفاءة، وتحديد مستوى لغة إنجليزية، ومقابلة سلوكية قصيرة في مؤشر استرشادي مركّب. وهو إشارة فرز للاختيار وليس تشخيصًا تطويريًا، ولا يرفض تلقائيًا أبدًا؛ إذ يتخذ القرار شخصٌ دائمًا.",
  arc:
    "قياس الاستعداد للذكاء الاصطناعي على مستوى المؤسسة والأفراد عبر ثماني ركائز، مع مقارنة مرجعية بالنظراء وتتبع سنوي. تشمل المخرجات تقريرًا استشاريًا ثنائي اللغة (عربي/إنجليزي)، وخطة لبناء القدرات، وعرضًا للتوافق التنظيمي لأطر الإمارات والسعودية.",
  reflect:
    "تغذية راجعة قيادية بتقييم 360 درجة متعدد المُقيِّمين مقابل إطار كفاءات العميل. تتجمّع تقييمات الذات والمدير والأقران والمرؤوسين في تقارير فردية وتجميعية محمية بحد أدنى للسرية مع خطة تطوير فردية.",
  bespoke:
    "حلول تقييم قابلة للتخصيص تُجمَّع من مجموعة أدوات Caliber - حزم مخصصة وبطاريات جاهزية الأدوار وتصاميم تقييم خاصة بالعميل - يصممها ويهيّئها ويعدّ تقاريرها استشاريو VIFM وفق إطار العميل.",
  succession:
    "تقييم للتعاقب وجاهزية الأدوار يجمع الأدلة السلوكية (بيرسونا) والفنية (تكنو) مقابل دور مستهدف محدد، ويُنتج حكمًا بالجاهزية (جاهز/غير جاهز) مع خطة تطوير فردية لكل مرشح.",
};

/** Arabic deliverables/reports per service. */
export const PROPOSAL_DELIVERABLES_AR: Record<ProposalServiceKey, string[]> = {
  fluent: [
    "تقرير فردي لتحديد مستوى CEFR مع تفصيل لكل مهارة (قراءة، استماع، كتابة، تحدث)",
    "شهادة تحديد مستوى قابلة للتنزيل لكل مشارك",
    "مصفوفة تحديد مستوى للمجموعة لأغراض تخطيط البرامج",
  ],
  logica: [
    "ملف استدلالي فردي مع تصنيفات لكل اختبار فرعي (عددي، لفظي، استقرائي، استنباطي)",
    "تحليلات للمجموعة مع توزيع التصنيفات",
    "مؤشرات نزاهة الإجراء تُعرَض لمالك البرنامج",
  ],
  persona: [
    "ملف سلوكي فردي عبر إطار VIFM المكوَّن من 41 كفاءة",
    "عدستا تقرير اختياريتان: أدوار القرار (DARE) والذكاء العاطفي",
    "قراءة للملاءمة مع الدور عند تحديد ملف دور مستهدف",
    "ورقة استخبارات للمجموعة للمؤسسة الراعية",
  ],
  techno: [
    "تصنيفات كفاءة فنية لكل مجال مع تفصيل على مستوى المهارة",
    "اعتماد كفاءة فنية قابل للتحقق العام عند بلوغ درجة القطع الموثقة",
    "عرض جاهزية للمجموعة عبر الوظائف المُقيَّمة",
  ],
  prehire: [
    "تقرير فرز لكل مرشح مع مؤشر استرشادي مركّب (ليس رفضًا تلقائيًا أبدًا)",
    "قائمة مختصرة مرتّبة عبر كامل الطلب الوظيفي",
    "عرض لمراقبة الأثر التفاضلي (قاعدة الأربعة أخماس) وسجل تدقيق غير قابل للتعديل",
    "تصدير جاهز لأنظمة تتبع المتقدمين (JSON/CSV)",
  ],
  arc: [
    "تقرير استعداد مؤسسي للذكاء الاصطناعي ثنائي اللغة (عربي/إنجليزي) عبر الركائز المُقيَّمة",
    "خريطة حرارية للركائز، ومصفوفة استثمار، وخارطة طريق مرحلية لبناء القدرات",
    "عرض للتوافق التنظيمي للأطر السعودية/الإماراتية ذات الصلة",
    "مقارنة سنوية عند إعادة التقييم",
  ],
  reflect: [
    "تقرير 360 فردي محمي بالسرية لكل قائد",
    "خطة تطوير فردية لكل مشارك",
    "تقرير تجميعي على مستوى المؤسسة يبرز نقاط القوة والنقاط العمياء",
  ],
  bespoke: [
    "تصميم تقييم مُتفق عليه مع العميل (الأدوات، نطاق الكفاءات، معايير النجاح)",
    "بطارية مُهيّأة على منصة Caliber بتسليم يحمل هوية العميل",
    "صيغة تقرير مخصّصة تتوافق مع إطار العميل",
    "جلسة استعراض من الاستشاري للنتائج والتوصيات",
  ],
  succession: [
    "ملف جاهزية للدور المستهدف (أدلة سلوكية وفنية)",
    "حكم بالجاهزية لكل مرشح (جاهز/غير جاهز) مع المبررات",
    "خطة تطوير فردية لكل مرشح للتعاقب",
    "ملخص لمخزون التعاقب للمجموعة لقيادة الموارد البشرية",
  ],
};

export type ProposalServiceMeta = {
  key: ProposalServiceKey;
  label: string;
  accent: string;
  methodologySlug: string;
  blurb: string;
};

export const PROPOSAL_SERVICES: ProposalServiceMeta[] = [
  ...PORTAL_SERVICES.map((s) => ({
    key: s.id as ProposalServiceKey,
    label: s.label,
    accent: s.accent,
    methodologySlug: PROPOSAL_METHODOLOGY_SLUG[s.id],
    blurb: PROPOSAL_BLURB[s.id],
  })),
  // Proposal-only offerings: consultant-delivered solutions with no portal
  // tile - sellable lines like any other service.
  {
    key: "bespoke",
    label: "Bespoke Services",
    accent: "#7c3aed",
    methodologySlug: PROPOSAL_METHODOLOGY_SLUG.bespoke,
    blurb: PROPOSAL_BLURB.bespoke,
  },
  {
    key: "succession",
    label: "Succession Planning",
    accent: "#0f766e",
    methodologySlug: PROPOSAL_METHODOLOGY_SLUG.succession,
    blurb: PROPOSAL_BLURB.succession,
  },
];

export function proposalService(key: string): ProposalServiceMeta | undefined {
  return PROPOSAL_SERVICES.find((s) => s.key === key);
}

/** Per-service pricing basis, shown on licence rows and denormalised onto the
 *  licence model (e.g. "Persona - per employee"). */
export const PROPOSAL_SERVICE_BASIS: Record<ProposalServiceKey, string> = {
  prehire: "per candidate",
  logica: "per individual",
  persona: "per employee",
  techno: "per individual",
  fluent: "per individual",
  arc: "per business unit",
  reflect: "per leader",
  bespoke: "per assessment",
  succession: "per candidate",
};

/** Short category label carried onto the licence model (denormalised snapshot). */
export const PROPOSAL_SERVICE_CATEGORY: Record<ProposalServiceKey, string> = {
  prehire: "Pre-employment screening",
  logica: "Reasoning aptitude",
  persona: "Behavioural self-assessment",
  techno: "Technical proficiency",
  fluent: "English placement",
  arc: "AI readiness diagnostic",
  reflect: "Leadership 360 feedback",
  bespoke: "Configurable assessment solutions",
  succession: "Succession & role-readiness",
};

/** Default, editable boilerplate seeded into a new proposal. */
export const DEFAULT_PAYMENT_TERMS =
  "50% on signature of the statement of work, 50% on delivery. Fees are exclusive of any applicable taxes and are valid until the date shown above.";

/** SaaS payment schedule seeded when a new proposal opens in licence mode. */
export const DEFAULT_LICENCE_PAYMENT_TERMS =
  "50% upon signing; 50% upon go-live; annually in advance thereafter. The licence is annual and renewable; renewal for Year 2 is capped at no more than a 5% uplift. Fees are exclusive of any applicable taxes.";

// ── Section selection + recommendation tiers (Phase 2) ──
// The document outline, each section carrying a recommendation tier. MANDATORY
// sections always render (and are the only ones cross-referenced by other
// sections, so a reference can never point at an excluded section). RECOMMENDED
// default on; OPTIONAL default off. Single source for proposal-html + the builder.
export type SectionTier = "mandatory" | "recommended" | "optional";

export const PROPOSAL_SECTION_DEFS: { title: string; tier: SectionTier }[] = [
  { title: "Executive summary", tier: "mandatory" },
  { title: "About VIFM", tier: "mandatory" },
  { title: "Understanding of your requirements", tier: "mandatory" },
  { title: "Proposed solution & technical approach", tier: "mandatory" },
  { title: "Psychometric foundations", tier: "recommended" },
  { title: "Methodology & quality standards", tier: "recommended" },
  { title: "Platform, integration & security", tier: "recommended" },
  { title: "Implementation plan", tier: "recommended" },
  { title: "Project governance & team", tier: "mandatory" },
  { title: "Data protection & privacy", tier: "mandatory" },
  { title: "AI governance & standards", tier: "recommended" },
  { title: "Service level & support", tier: "mandatory" },
  { title: "Relevant experience", tier: "optional" },
  { title: "Commercial proposal", tier: "mandatory" },
  { title: "Assumptions & exclusions", tier: "recommended" },
  { title: "Terms & conditions", tier: "mandatory" },
  { title: "Definitions", tier: "recommended" },
  { title: "Acceptance & next steps", tier: "mandatory" },
  { title: "Sample reports", tier: "optional" },
];

export const PROPOSAL_SECTION_TITLES = PROPOSAL_SECTION_DEFS.map((s) => s.title);

const MANDATORY_SECTIONS = PROPOSAL_SECTION_DEFS.filter((s) => s.tier === "mandatory").map((s) => s.title);

/** Default ticked set for a NEW proposal: mandatory + recommended (optional off). */
export function defaultSectionSelection(): string[] {
  return PROPOSAL_SECTION_DEFS.filter((s) => s.tier !== "optional").map((s) => s.title);
}

/** Renamed section titles: a saved selection referencing an old title still
 *  resolves to the current one (so an existing proposal doesn't silently lose
 *  the section after a rename). */
export const SECTION_TITLE_ALIASES: Record<string, string> = {
  "Evidence & sample reports": "Sample reports",
};

/** Resolve the ordered set of sections to render. `null`/empty selection ⇒ the
 *  default (mandatory + recommended). Mandatory sections are always included. */
export function resolveIncludedSections(sel: string[] | null | undefined): string[] {
  if (!sel || !Array.isArray(sel) || sel.length === 0) return defaultSectionSelection();
  const chosen = new Set(sel.map((t) => SECTION_TITLE_ALIASES[t] ?? t));
  return PROPOSAL_SECTION_DEFS.filter((s) => s.tier === "mandatory" || chosen.has(s.title)).map((s) => s.title);
}

export { MANDATORY_SECTIONS };

export function defaultTerms(clientName: string, currency: string): string {
  return (
    `This proposal is confidential and prepared exclusively for ${clientName}. ` +
    `All fees are quoted in ${currency} and are valid until the date shown above. ` +
    "Any engagement is subject to VIFM's standard terms of service and a signed statement of work. " +
    "Assessment data is processed in line with applicable data-protection law (UAE Federal Decree-Law No. 45 of 2021, " +
    "Saudi PDPL, and GDPR where relevant) and retained for a maximum of 24 months unless contractually extended."
  );
}
