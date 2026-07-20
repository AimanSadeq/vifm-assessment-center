// Vetted Fluent PRODUCTIVE-skill prompts (writing + speaking).
//
// Writing + speaking are AI-scored open tasks - the "item" is a prompt, with no
// answer key. These are the vetted rotation seeded into eng_fluent_items behind
// the SME review gate (status in_review -> live). CEFR-target-varied so a served
// sitting can draw a level-appropriate task. Arabic is best-effort MSA and, per
// project convention, is flagged for human review before high-stakes use.

import type { CefrLevel } from "@/lib/ai/fluent-english";

export type FluentPromptSeed = {
  skill: "writing" | "speaking";
  cefr: CefrLevel; // target level of the task
  prompt_en: string;
  prompt_ar: string;
  min_words?: number; // writing
  min_seconds?: number; // speaking
};

export const FLUENT_PROMPT_SEED_V1: FluentPromptSeed[] = [
  // ── Writing (8) ────────────────────────────────────────────────
  {
    skill: "writing", cefr: "A2", min_words: 50,
    prompt_en: "Write a short message (about 50-70 words) to a colleague to say you will be late for a meeting and why.",
    prompt_ar: "اكتب رسالة قصيرة (نحو 50-70 كلمة) إلى زميل لتخبره بأنك ستتأخر عن اجتماع وسبب ذلك.",
  },
  {
    skill: "writing", cefr: "A2", min_words: 50,
    prompt_en: "Write a short email (about 50-70 words) to book a meeting room for next Tuesday morning and say how many people will attend.",
    prompt_ar: "اكتب بريدًا إلكترونيًا قصيرًا (نحو 50-70 كلمة) لحجز قاعة اجتماعات صباح الثلاثاء المقبل مع ذكر عدد الحاضرين.",
  },
  {
    skill: "writing", cefr: "B1", min_words: 70,
    prompt_en: "Write a short email (about 70-90 words) to a colleague explaining why a project deadline needs to move, and propose a new date.",
    prompt_ar: "اكتب بريدًا إلكترونيًا قصيرًا (نحو 70-90 كلمة) إلى زميل تشرح فيه سبب الحاجة إلى تأجيل موعد تسليم مشروع، واقترح موعدًا جديدًا.",
  },
  {
    skill: "writing", cefr: "B1", min_words: 70,
    prompt_en: "Write a short message (about 70-90 words) to a client apologising for a delay and explaining the next steps you will take.",
    prompt_ar: "اكتب رسالة قصيرة (نحو 70-90 كلمة) إلى عميل تعتذر فيها عن تأخير وتوضّح الخطوات التالية التي ستتخذها.",
  },
  {
    skill: "writing", cefr: "B2", min_words: 90,
    prompt_en: "Write a short paragraph (about 90-110 words) giving your opinion on whether teams should work from the office or remotely, with one reason for your view.",
    prompt_ar: "اكتب فقرة قصيرة (نحو 90-110 كلمة) تبدي فيها رأيك حول ما إذا كان ينبغي للفرق العمل من المكتب أم عن بُعد، مع ذكر سبب واحد لرأيك.",
  },
  {
    skill: "writing", cefr: "B2", min_words: 90,
    prompt_en: "Write a short summary (about 90-110 words) of a problem your team faced recently and the action you recommend to prevent it happening again.",
    prompt_ar: "اكتب ملخصًا قصيرًا (نحو 90-110 كلمة) لمشكلة واجهها فريقك مؤخرًا والإجراء الذي توصي به لمنع تكرارها.",
  },
  {
    skill: "writing", cefr: "C1", min_words: 120,
    prompt_en: "Write a short briefing note (about 120-140 words) recommending whether your organisation should adopt a new tool. Weigh one benefit against one risk and give a clear recommendation.",
    prompt_ar: "اكتب مذكرة إحاطة قصيرة (نحو 120-140 كلمة) توصي فيها بما إذا كان ينبغي لمؤسستك اعتماد أداة جديدة. وازِن بين فائدة واحدة ومخاطرة واحدة وقدّم توصية واضحة.",
  },
  {
    skill: "writing", cefr: "C1", min_words: 120,
    prompt_en: "Write a short response (about 120-140 words) to a stakeholder who disagrees with a decision your team made. Acknowledge their concern and justify the decision professionally.",
    prompt_ar: "اكتب ردًا قصيرًا (نحو 120-140 كلمة) على أحد أصحاب المصلحة يعترض على قرار اتخذه فريقك. أقرّ بمخاوفه وبرّر القرار بأسلوب مهني.",
  },

  // ── Speaking (8) - the prompt's stated seconds equals min_seconds ────
  {
    skill: "speaking", cefr: "A2", min_seconds: 30,
    prompt_en: "Speak for about 30 seconds: introduce yourself and describe what you do in a typical working day.",
    prompt_ar: "تحدّث لمدة 30 ثانية تقريبًا: عرّف بنفسك وصِف ما تقوم به في يوم عمل معتاد.",
  },
  {
    skill: "speaking", cefr: "A2", min_seconds: 30,
    prompt_en: "Speak for about 30 seconds: describe your workplace and one thing you like about it.",
    prompt_ar: "تحدّث لمدة 30 ثانية تقريبًا: صِف مكان عملك وأمرًا واحدًا يعجبك فيه.",
  },
  {
    skill: "speaking", cefr: "B1", min_seconds: 45,
    prompt_en: "Speak for about 45 seconds: describe a work or study challenge you faced recently and how you dealt with it.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: صِف تحديًا واجهته مؤخرًا في العمل أو الدراسة وكيف تعاملت معه.",
  },
  {
    skill: "speaking", cefr: "B1", min_seconds: 45,
    prompt_en: "Speak for about 45 seconds: describe a skill you would like to improve and explain why it matters for your work.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: صِف مهارة تودّ تحسينها ووضّح سبب أهميتها لعملك.",
  },
  {
    skill: "speaking", cefr: "B2", min_seconds: 45,
    prompt_en: "Speak for about 45 seconds: give your opinion on whether new technology makes work easier or more stressful, with an example.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: أبدِ رأيك حول ما إذا كانت التقنية الحديثة تجعل العمل أسهل أم أكثر ضغطًا، مع مثال.",
  },
  {
    skill: "speaking", cefr: "B2", min_seconds: 45,
    prompt_en: "Speak for about 45 seconds: describe a decision you disagreed with at work and explain how you handled the situation.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: صِف قرارًا اختلفت معه في العمل ووضّح كيف تعاملت مع الموقف.",
  },
  {
    skill: "speaking", cefr: "C1", min_seconds: 60,
    prompt_en: "Speak for about 60 seconds: argue for or against the statement that organisations should measure employees mainly by results, not hours worked.",
    prompt_ar: "تحدّث لمدة 60 ثانية تقريبًا: قدّم حجة مؤيدة أو معارضة للقول بأن على المؤسسات قياس الموظفين أساسًا بالنتائج لا بساعات العمل.",
  },
  {
    skill: "speaking", cefr: "C1", min_seconds: 60,
    prompt_en: "Speak for about 60 seconds: a project you led did not meet its goal. Explain what happened, what you learned, and what you would do differently.",
    prompt_ar: "تحدّث لمدة 60 ثانية تقريبًا: مشروع قُدته لم يحقق هدفه. اشرح ما حدث، وما تعلّمته، وما الذي ستفعله بشكل مختلف.",
  },
];
