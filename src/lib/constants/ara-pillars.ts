import type { AraPillarId } from "@/types/ara";

export const ARA_PILLARS: ReadonlyArray<{
  id: AraPillarId;
  name_en: string;
  name_ar: string;
  description_en: string;
}> = [
  {
    id: "strategy",
    name_en: "Strategy & Vision",
    name_ar: "الاستراتيجية والرؤية",
    description_en: "AI mandate, executive sponsor, budget, use case prioritization.",
  },
  {
    id: "data",
    name_en: "Data Foundations",
    name_ar: "أسس البيانات",
    description_en: "Data quality, ownership, sovereignty, shadow AI risk.",
  },
  {
    id: "technology",
    name_en: "Technology & Infrastructure",
    name_ar: "التكنولوجيا والبنية التحتية",
    description_en: "Cloud sovereignty, AI tool approval, MLOps, sandbox.",
  },
  {
    id: "talent",
    name_en: "Talent & Skills",
    name_ar: "المواهب والمهارات",
    description_en: "Digital literacy, AI literacy, technical skills, training plans.",
  },
  {
    id: "culture",
    name_en: "Culture & Change Readiness",
    name_ar: "الثقافة والاستعداد للتغيير",
    description_en: "Leadership cascade, ROI framework, employee sentiment, change plans.",
  },
  {
    id: "governance",
    name_en: "Governance, Ethics & Compliance",
    name_ar: "الحوكمة والأخلاقيات والامتثال",
    description_en: "AI governance policy, acceptable use, compliance audits, incident response.",
  },
  {
    id: "operations",
    name_en: "Operations & Use Case Portfolio",
    name_ar: "العمليات ومحفظة حالات الاستخدام",
    description_en: "Use case discovery, prioritization, ROI measurement, business outcomes.",
  },
  {
    id: "model_management",
    name_en: "Model Management & Monitoring",
    name_ar: "إدارة النماذج والمراقبة",
    description_en: "Model versioning, performance monitoring, bias testing, human review.",
  },
] as const;

export const ARA_PILLAR_MAP: Readonly<Record<AraPillarId, (typeof ARA_PILLARS)[number]>> =
  Object.fromEntries(ARA_PILLARS.map((p) => [p.id, p])) as Readonly<
    Record<AraPillarId, (typeof ARA_PILLARS)[number]>
  >;

// Level 1 floor is 0.0, not 1.0, so admin-defined score_maps that
// assign a 0 for "no_policy"-style answers still bucket cleanly into
// the lowest maturity level. Handover §7.2 shows label ranges starting
// at 1.0, but the nominal "scoring range" and the bucketing rule are
// separate concerns — display copy is unchanged.
export const ARA_MATURITY_LEVELS: ReadonlyArray<{
  level: 1 | 2 | 3 | 4 | 5;
  label_en: string;
  label_ar: string;
  min: number;
  max: number;
}> = [
  { level: 1, label_en: "Unaware", label_ar: "غير مدرك", min: 0.0, max: 1.9 },
  { level: 2, label_en: "Exploring", label_ar: "يستكشف", min: 2.0, max: 2.9 },
  { level: 3, label_en: "Developing", label_ar: "يطور", min: 3.0, max: 3.9 },
  { level: 4, label_en: "Advancing", label_ar: "يتقدم", min: 4.0, max: 4.4 },
  { level: 5, label_en: "Leading", label_ar: "رائد", min: 4.5, max: 5.0 },
] as const;

// Same 0.0 floor as maturity levels — a weighted overall can be below
// 1.0 when score_map values assign 0 to some answers. Display copy in
// the report still uses the 1.0–5.0 labels from the handover.
export const ARA_OVERALL_BANDS: ReadonlyArray<{
  label_en: string;
  label_ar: string;
  min: number;
  max: number;
  color: string;
}> = [
  { label_en: "Not Ready", label_ar: "غير جاهز", min: 0.0, max: 1.9, color: "#DC3545" },
  { label_en: "Early Stage", label_ar: "مرحلة مبكرة", min: 2.0, max: 2.9, color: "#FD7E14" },
  { label_en: "In Progress", label_ar: "في التقدم", min: 3.0, max: 3.9, color: "#FFC107" },
  { label_en: "Advanced", label_ar: "متقدم", min: 4.0, max: 4.4, color: "#28A745" },
  { label_en: "AI Leader", label_ar: "رائد في الذكاء الاصطناعي", min: 4.5, max: 5.0, color: "#FFD700" },
] as const;
