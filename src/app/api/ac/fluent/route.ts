/**
 * VIFM Fluent — English placement prototype API (stateless).
 *
 * POST /api/ac/fluent
 *   { action: "start", language }                     -> FluentTest
 *   { action: "score", language, reading, answers,
 *     writingTask, writingResponse }                  -> FluentResult
 *
 * Prototype note: the test (incl. answer key) lives client-side between
 * start and score — fine for a demo. Production would persist the test
 * server-side (eng_* tables) so the key never reaches the browser.
 */

import { NextResponse } from "next/server";
import {
  generateFluentTest,
  scoreFluentWriting,
  computeFluentResult,
  type FluentLanguage,
  type ReadingItem,
  type WritingTask,
} from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";

type Body = {
  action?: "start" | "score";
  language?: FluentLanguage;
  reading?: ReadingItem[];
  answers?: Record<string, number>;
  writingTask?: WritingTask;
  writingResponse?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const language: FluentLanguage = body.language === "ar" ? "ar" : "en";

  if (body.action === "start") {
    const test = await generateFluentTest({ language });
    return NextResponse.json(test);
  }

  if (body.action === "score") {
    const reading = Array.isArray(body.reading) ? body.reading : null;
    const writingTask = body.writingTask ?? null;
    if (!reading || !writingTask) {
      return NextResponse.json(
        { error: "reading items and writingTask are required" },
        { status: 400 }
      );
    }
    const writing = await scoreFluentWriting({
      task: writingTask,
      response: String(body.writingResponse ?? ""),
      language,
    });
    const result = computeFluentResult({
      reading,
      answers: body.answers ?? {},
      writing,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "action must be 'start' or 'score'" }, { status: 400 });
}
