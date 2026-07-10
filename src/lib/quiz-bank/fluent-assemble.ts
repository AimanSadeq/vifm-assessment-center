// Fluent receptive bank - assembly (server-only).
//
// Builds a CEFR-ramped reading + listening test from APPROVED-and-promoted
// (status='live') eng_fluent_items, so a Fluent sitting can serve a vetted bank
// instead of minting the receptive items live per administration. Returns null
// when the live pool can't fill the ramp, so the caller falls back to
// generateFluentTest (live-AI). Writing + speaking are AI-scored tasks (not a
// receptive bank), so a bank-served test pairs the vetted receptive items with a
// vetted prompt from a small rotation set - no live generation needed at all.

import { createServiceClient } from "@/lib/supabase/server";
import { reorderOptions } from "@/lib/scoring/option-shuffle";
import {
  CEFR_ORDER,
  type CefrLevel,
  type ReadingItem,
  type ListeningItem,
  type WritingTask,
  type SpeakingTask,
  type FluentTest,
} from "@/lib/ai/fluent-english";

// Served ramp per skill: 2 each A1–B2, 1 each C1/C2 = 10 items (matches the
// live-AI test shape so scoring + reporting are unchanged).
const RAMP: Record<CefrLevel, number> = { A1: 2, A2: 2, B1: 2, B2: 2, C1: 1, C2: 1 };

type Row = { id: string; skill: string; stem: unknown; cefr_label: string | null };
type Stem = { passage?: unknown; script?: unknown; question?: unknown; options?: unknown; correct_index?: unknown; cefr?: unknown };

const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Draw a CEFR-ramped reading + listening set from the live bank, or null. */
export async function assembleFluentReceptive(): Promise<{ reading: ReadingItem[]; listening: ListeningItem[] } | null> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("eng_fluent_items")
      .select("id, skill, stem, cefr_label, n_responses")
      // Serve the FIXED authored bank (live/approved vetted + in_review provisional)
      // before ever live-generating - we already have the questions.
      .in("status", ["live", "approved", "in_review"])
      .order("n_responses", { ascending: true })
      .limit(3000);
    const rows = (data ?? []) as Row[];

    const build = (skill: "reading" | "listening"): ReadingItem[] | ListeningItem[] | null => {
      const out: Array<ReadingItem | ListeningItem> = [];
      for (const level of CEFR_ORDER) {
        const need = RAMP[level];
        const pool = rows.filter((r) => {
          const st = (r.stem ?? {}) as Stem;
          return r.skill === skill && (r.cefr_label === level || st.cefr === level);
        });
        if (pool.length < need) return null; // this level can't fill → whole assembly fails safe
        for (const r of pool.slice(0, need)) {
          const st = (r.stem ?? {}) as Stem;
          const content = skill === "reading" ? st.passage : st.script;
          const options = asStrArr(st.options);
          if (typeof content !== "string" || !content.trim() || options.length !== 4 || typeof st.correct_index !== "number") {
            return null;
          }
          const s = reorderOptions(options, st.correct_index);
          const base = { id: r.id, question: String(st.question ?? ""), options: s.options, correct_index: s.correctIndex, cefr: level };
          out.push(skill === "reading" ? { ...base, passage: content } : { ...base, script: content });
        }
      }
      return out as ReadingItem[] | ListeningItem[];
    };

    const reading = build("reading") as ReadingItem[] | null;
    const listening = build("listening") as ListeningItem[] | null;
    if (!reading || !listening) return null;
    return { reading, listening };
  } catch {
    return null;
  }
}

// ── Vetted writing + speaking prompts (rotation set) ──────────────
// Writing/speaking are AI-scored open tasks, so a small fixed rotation is fine
// (the candidate's response varies) and keeps a bank-served sitting free of any
// live generation. Bilingual so an Arabic-first taker reads the prompt in Arabic.
const WRITING_PROMPTS: WritingTask[] = [
  { id: "w1", cefr_target: "B1", min_words: 60,
    prompt_en: "Write a short email (about 80 words) to a colleague explaining why a project deadline needs to move, and propose a new date.",
    prompt_ar: "اكتب بريدًا إلكترونيًا قصيرًا (نحو 80 كلمة) إلى زميل تشرح فيه سبب الحاجة إلى تأجيل موعد تسليم مشروع، واقترح موعدًا جديدًا." },
  { id: "w2", cefr_target: "B1", min_words: 60,
    prompt_en: "Write a short message (about 80 words) to a client apologising for a delay and explaining the next steps you will take.",
    prompt_ar: "اكتب رسالة قصيرة (نحو 80 كلمة) إلى عميل تعتذر فيها عن تأخير وتوضّح الخطوات التالية التي ستتخذها." },
  { id: "w3", cefr_target: "B2", min_words: 70,
    prompt_en: "Write a short paragraph (about 90 words) giving your opinion on whether teams should work from the office or remotely, with one reason for your view.",
    prompt_ar: "اكتب فقرة قصيرة (نحو 90 كلمة) تبدي فيها رأيك حول ما إذا كان ينبغي للفرق العمل من المكتب أم عن بُعد، مع ذكر سبب واحد لرأيك." },
];
const SPEAKING_PROMPTS: SpeakingTask[] = [
  { id: "s1", cefr_target: "B1", min_seconds: 40,
    prompt_en: "Speak for about 45 seconds: describe a work or study challenge you faced recently and how you dealt with it.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: صِف تحديًا واجهته مؤخرًا في العمل أو الدراسة وكيف تعاملت معه." },
  { id: "s2", cefr_target: "B1", min_seconds: 40,
    prompt_en: "Speak for about 45 seconds: describe a skill you would like to improve and explain why it matters for your work.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: صِف مهارة تودّ تحسينها ووضّح سبب أهميتها لعملك." },
  { id: "s3", cefr_target: "B2", min_seconds: 45,
    prompt_en: "Speak for about 45 seconds: give your opinion on whether new technology makes work easier or more stressful, with an example.",
    prompt_ar: "تحدّث لمدة 45 ثانية تقريبًا: أبدِ رأيك حول ما إذا كانت التقنية الحديثة تجعل العمل أسهل أم أكثر ضغطًا، مع مثال." },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
}

type PromptStem = { prompt_en?: unknown; prompt_ar?: unknown; cefr_target?: unknown; min_words?: unknown; min_seconds?: unknown };

/** Draw one vetted prompt for a productive skill from the LIVE bank, or null to
 *  fall back to the in-code rotation. Rotates least-served-first, then random. */
async function drawLivePrompt(skill: "writing" | "speaking"): Promise<WritingTask | SpeakingTask | null> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("eng_fluent_items")
      .select("id, stem, cefr_label, n_responses")
      .eq("skill", skill)
      .in("status", ["live", "approved", "in_review"])
      .order("n_responses", { ascending: true })
      .limit(50);
    const rows = (data ?? []) as Array<{ id: string; stem: PromptStem; cefr_label: string | null }>;
    if (rows.length === 0) return null;
    // Rotate within the least-served band (all rows share the same min once served).
    const r = pick(rows);
    const st = (r.stem ?? {}) as PromptStem;
    const promptEn = String(st.prompt_en ?? "");
    if (!promptEn.trim()) return null;
    const base = {
      id: r.id,
      cefr_target: String(st.cefr_target ?? r.cefr_label ?? "B1"),
      prompt_en: promptEn,
      prompt_ar: String(st.prompt_ar ?? ""),
    };
    return skill === "writing"
      ? { ...base, min_words: typeof st.min_words === "number" ? st.min_words : 60 } as WritingTask
      : { ...base, min_seconds: typeof st.min_seconds === "number" ? st.min_seconds : 45 } as SpeakingTask;
  } catch {
    return null;
  }
}

/** A full Fluent test assembled from the vetted bank, or null to fall back. The
 *  receptive ramp must fill from the bank; the productive prompts prefer the live
 *  bank but fall back to the in-code vetted rotation (both are vetted). */
export async function assembleFluentTestFromBank(): Promise<FluentTest | null> {
  const receptive = await assembleFluentReceptive();
  if (!receptive) return null;
  const [writing, speaking] = await Promise.all([drawLivePrompt("writing"), drawLivePrompt("speaking")]);
  return {
    reading: receptive.reading,
    listening: receptive.listening,
    writing: (writing as WritingTask) ?? pick(WRITING_PROMPTS),
    speaking: (speaking as SpeakingTask) ?? pick(SPEAKING_PROMPTS),
    ai_generated: false,
  };
}
