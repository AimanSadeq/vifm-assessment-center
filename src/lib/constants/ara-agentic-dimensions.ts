/**
 * VIFM ARC — Agentic-AI Readiness dimensions.
 *
 * Six dimensions measuring an organisation's readiness to DELEGATE work
 * to autonomous AI agents — distinct from the 8 ARC pillars, which
 * measure readiness to USE AI. Seeded as an opt-in tier on the question
 * bank (migration 00041) via the `agentic_dimension_id` discriminator on
 * ara_questions; an assessment opts in with `include_agentic_layer`.
 *
 * Naming and structure are VIFM original.
 */

export type AraAgenticDimensionId =
  | "agent_governance"
  | "human_oversight"
  | "risk_failure"
  | "access_control"
  | "autonomy_calibration"
  | "auditability";

export type AraAgenticDimension = {
  id: AraAgenticDimensionId;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  /** ARC pillar each dimension is seeded under for compatibility. */
  anchor_pillar: "governance" | "model_management";
  /** Hex tone for report/UI rendering. */
  color: string;
};

export const ARA_AGENTIC_DIMENSIONS: AraAgenticDimension[] = [
  {
    id: "agent_governance",
    name_en: "Agent Governance & Accountability",
    name_ar: "حوكمة الوكلاء والمساءلة",
    description_en:
      "Clear ownership and accountability for every autonomous agent — who approves it, who can pause it, and who answers for what it does.",
    description_ar:
      "ملكية ومساءلة واضحة لكل وكيل مستقل — من يعتمده، ومن يستطيع إيقافه، ومن يتحمّل مسؤولية ما يفعله.",
    anchor_pillar: "governance",
    color: "#5391D5",
  },
  {
    id: "human_oversight",
    name_en: "Human-in-the-Loop & Oversight",
    name_ar: "إشراف الإنسان والرقابة",
    description_en:
      "The right human checkpoints: explicit approval for high-impact actions, clear review boundaries, and the ability to interrupt an agent mid-action.",
    description_ar:
      "نقاط التحقق البشرية الصحيحة: موافقة صريحة على الإجراءات عالية الأثر، وحدود مراجعة واضحة، والقدرة على مقاطعة الوكيل أثناء التنفيذ.",
    anchor_pillar: "governance",
    color: "#047857",
  },
  {
    id: "risk_failure",
    name_en: "Failure-Mode & Risk Awareness",
    name_ar: "الوعي بأنماط الفشل والمخاطر",
    description_en:
      "Knowing how agents fail before they do — assessed failure modes, documented fallback plans, and testing against adversarial and edge cases.",
    description_ar:
      "معرفة كيف تفشل الوكلاء قبل حدوث ذلك — تقييم أنماط الفشل، وخطط بديلة موثّقة، واختبار في مواجهة الحالات العدائية والحدّية.",
    anchor_pillar: "model_management",
    color: "#9F1239",
  },
  {
    id: "access_control",
    name_en: "Tool & Data Access Control",
    name_ar: "التحكم في الوصول إلى الأدوات والبيانات",
    description_en:
      "Least-privilege access for agents: scoped system reach, controlled and logged tool/API calls, and sensitive data under the same controls as staff.",
    description_ar:
      "وصول بأقل امتياز للوكلاء: نطاق محدود للأنظمة، واستدعاءات أدوات وواجهات مُتحكَّم بها ومُسجَّلة، وبيانات حساسة تخضع لضوابط الموظفين نفسها.",
    anchor_pillar: "governance",
    color: "#B45309",
  },
  {
    id: "autonomy_calibration",
    name_en: "Autonomy Calibration",
    name_ar: "معايرة الاستقلالية",
    description_en:
      "Matching the leash to the risk — low-risk tasks delegated, high-risk decisions kept with people, and autonomy adjusted by each agent's track record.",
    description_ar:
      "مواءمة مدى الاستقلالية مع المخاطر — تفويض المهام منخفضة المخاطر، وإبقاء القرارات عالية المخاطر بيد البشر، وتعديل الاستقلالية بحسب سجل أداء كل وكيل.",
    anchor_pillar: "model_management",
    color: "#6D28D9",
  },
  {
    id: "auditability",
    name_en: "Auditability & Traceability",
    name_ar: "قابلية التدقيق والتتبّع",
    description_en:
      "Reconstructable logs of every consequential agent action, an audit trail fit for a regulator, and monitoring that flags out-of-scope behaviour.",
    description_ar:
      "سجلات قابلة لإعادة التتبّع لكل إجراء مؤثّر للوكيل، ومسار تدقيق يصلح لجهة تنظيمية، ومراقبة تنبّه إلى السلوك خارج النطاق.",
    anchor_pillar: "governance",
    color: "#121140",
  },
];

export const ARA_AGENTIC_DIMENSION_MAP: Record<AraAgenticDimensionId, AraAgenticDimension> =
  Object.fromEntries(
    ARA_AGENTIC_DIMENSIONS.map((d) => [d.id, d])
  ) as Record<AraAgenticDimensionId, AraAgenticDimension>;

export const ARA_AGENTIC_DIMENSION_IDS: AraAgenticDimensionId[] = [
  "agent_governance",
  "human_oversight",
  "risk_failure",
  "access_control",
  "autonomy_calibration",
  "auditability",
];
