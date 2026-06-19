/**
 * Pre-Hire - voluntary demographic self-identification.
 *
 * POST { gender?, age_band?, nationality_group? } -> { ok: true }
 *
 * Used ONLY for aggregate adverse-impact monitoring; never in scoring, never
 * shown to assessors. All fields optional - a "skip" posts an empty body and
 * still stamps demographics_submitted_at so the candidate isn't re-asked.
 * Best-effort + tolerant: returns ok even if migration 00051 isn't applied yet.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { logPrehireEvent } from "@/lib/prehire/audit";

const GENDERS = ["male", "female", "prefer_not_to_say"];
const AGE_BANDS = ["under_25", "25_34", "35_44", "45_54", "55_plus", "prefer_not_to_say"];
const NATIONALITY = ["national", "expatriate", "prefer_not_to_say"];

const pick = (v: unknown, allowed: string[]): string | null =>
  typeof v === "string" && allowed.includes(v) ? v : null;

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    gender?: unknown;
    age_band?: unknown;
    nationality_group?: unknown;
  } | null;

  const gender = pick(body?.gender, GENDERS);
  const age_band = pick(body?.age_band, AGE_BANDS);
  const nationality_group = pick(body?.nationality_group, NATIONALITY);

  const svc = createServiceClient();
  // Tolerant: if 00051 isn't applied the columns don't exist - swallow the error
  // so an optional step never blocks the candidate.
  await svc
    .from("prehire_candidates")
    .update({
      gender,
      age_band,
      nationality_group,
      demographics_submitted_at: new Date().toISOString(),
    })
    .eq("id", ctx.candidate.id);

  // Never log the values (the audit trail is client-readable) - only whether
  // the candidate disclosed anything.
  await logPrehireEvent({
    action: "demographics_submitted",
    requisitionId: ctx.requisition.id,
    candidateId: ctx.candidate.id,
    actorLabel: "candidate",
    detail: { disclosed: !!(gender || age_band || nationality_group) },
  });

  return NextResponse.json({ ok: true });
}
