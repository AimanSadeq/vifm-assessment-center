// Client-safe Fluent bank constants + types (NO server imports). Kept separate
// from fluent-admin.ts (which imports the server-only supabase client) so client
// components can import these without pulling next/headers into the bundle.

import type { CefrLevel } from "@/lib/ai/fluent-english";

/** Min LIVE prompts per productive skill (writing/speaking) to serve a rotation. */
export const PROMPT_MIN = 3;

export type FluentItemStatus = "draft" | "calibrating" | "live" | "in_review" | "rejected" | "retired";

export type FluentItem = {
  id: string;
  skill: "reading" | "listening";
  cefr: string;
  content: string; // passage or script
  question: string;
  options: string[];
  correct_index: number;
  status: FluentItemStatus;
};

/** A productive-skill (writing/speaking) prompt - AI-scored open task, no key. */
export type FluentPrompt = {
  id: string;
  skill: "writing" | "speaking";
  cefr: string;
  prompt_en: string;
  prompt_ar: string;
  status: FluentItemStatus;
};

export type FluentCell = {
  skill: "reading" | "listening";
  cefr: CefrLevel;
  need: number;
  live: number;
  inReview: number;
  items: FluentItem[];
};
