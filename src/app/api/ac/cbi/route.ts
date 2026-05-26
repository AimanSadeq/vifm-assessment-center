/**
 * AI Conversational Assessor - CBI prototype API.
 *
 * POST /api/ac/cbi
 *   { action: "turn",  competencyId, language, history } -> { message, shouldConclude }
 *   { action: "score", competencyId, language, history } -> CbiScore
 *
 * Fetches the competency + behavioural indicators server-side (service
 * client) so the client never has to ship them around. Auth is bypassed
 * in dev (AUTH_ENABLED=false); this is a prototype surface.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  nextInterviewerTurn,
  scoreCbiInterview,
  type CbiCompetency,
  type CbiLanguage,
  type CbiMessage,
} from "@/lib/ai/cbi-interviewer";

export const dynamic = "force-dynamic";

type Body = {
  action?: "turn" | "score";
  competencyId?: string;
  language?: CbiLanguage;
  history?: CbiMessage[];
};

async function loadCompetency(competencyId: string): Promise<CbiCompetency | null> {
  const sb = createServiceClient();
  const [{ data: comp }, { data: indicators }] = await Promise.all([
    sb.from("competencies").select("id, name, description").eq("id", competencyId).single(),
    sb
      .from("behavioral_indicators")
      .select("indicator_type, description")
      .eq("competency_id", competencyId)
      .order("sort_order"),
  ]);
  if (!comp) return null;
  const rows = (indicators ?? []) as { indicator_type: string; description: string }[];
  return {
    id: comp.id,
    name: comp.name,
    description: comp.description,
    positiveIndicators: rows.filter((r) => r.indicator_type === "positive").map((r) => r.description),
    negativeIndicators: rows.filter((r) => r.indicator_type === "negative").map((r) => r.description),
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  const competencyId = body.competencyId;
  const language: CbiLanguage = body.language === "ar" ? "ar" : "en";
  const history: CbiMessage[] = Array.isArray(body.history) ? body.history : [];

  if (action !== "turn" && action !== "score") {
    return NextResponse.json({ error: "action must be 'turn' or 'score'" }, { status: 400 });
  }
  if (!competencyId) {
    return NextResponse.json({ error: "competencyId is required" }, { status: 400 });
  }

  const competency = await loadCompetency(competencyId);
  if (!competency) {
    return NextResponse.json({ error: "Competency not found" }, { status: 404 });
  }

  if (action === "turn") {
    const turn = await nextInterviewerTurn({ competency, history, language });
    return NextResponse.json(turn);
  }

  // action === "score"
  if (history.filter((m) => m.role === "candidate").length === 0) {
    return NextResponse.json({ error: "No candidate answers to score" }, { status: 400 });
  }
  const score = await scoreCbiInterview({ competency, history, language });
  return NextResponse.json(score);
}
