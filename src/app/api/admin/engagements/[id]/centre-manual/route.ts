import { NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildCentreManual,
  sectionsFor,
  isConfidential,
  type ManualVariant,
  type ManualExercise,
} from "@/lib/ac/centre-manual";
import { buildCentreManualHtml, variantLabel } from "@/lib/reports/centre-manual-html";
import { CENTRE_ROLE_MAP } from "@/lib/ac/centre-roles";

/**
 * GET /api/admin/engagements/[id]/centre-manual?variant=full|<role key>
 *
 * The centre manual (BPS 4.39) and the per-role manuals compiled from it
 * (4.40). Admin-gated, because every variant except the least sensitive
 * carries exercise material.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const url = new URL(req.url);
  const requested = url.searchParams.get("variant") ?? "full";
  // An unknown variant must not silently fall back to the FULL manual - that
  // would turn a typo into a disclosure. Refuse instead.
  if (requested !== "full" && !CENTRE_ROLE_MAP[requested]) {
    return NextResponse.json({ error: "Unknown manual variant" }, { status: 400 });
  }
  const variant = requested as ManualVariant;
  const issuedTo = url.searchParams.get("issuedTo");

  const sb = createServiceClient();
  const { data: engagement } = await sb
    .from("engagements")
    .select("*, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [exRows, matrixRows, roleRows, candRows, compRows] = await Promise.all([
    sb
      .from("engagement_exercises")
      .select(
        "exercise_id, exercises(id, name, exercise_type, duration_minutes, prep_minutes, meeting_minutes, instructions_minutes, participant_brief, scenario_context, assessor_notes)"
      )
      .eq("engagement_id", params.id),
    sb
      .from("exercise_competency_matrix")
      .select("exercise_id, competency_id, competencies(name)")
      .eq("engagement_id", params.id),
    sb
      .from("ac_engagement_roles")
      .select("role_key, is_external, profiles(full_name, email)")
      .eq("engagement_id", params.id)
      .then((r) => r, () => ({ data: null })),
    sb
      .from("candidates")
      .select("full_name, adjustment_status, adjustment_agreed, adjustment_extra_minutes")
      .eq("engagement_id", params.id)
      .order("full_name"),
    sb
      .from("engagement_competencies")
      .select("weight, competencies(name)")
      .eq("engagement_id", params.id),
  ]);

  const nameOf = (row: unknown): string => {
    const c = row as { name?: string } | { name?: string }[] | null;
    return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Unnamed";
  };

  // Role-player material lives in role_player_prompts, one row per prompt.
  const exerciseIds = (exRows.data ?? [])
    .map((x) => (x.exercises as unknown as { id?: string } | null)?.id)
    .filter((x): x is string => Boolean(x));
  const promptsByExercise = new Map<string, { prompt: string; triggerBehaviours: string | null }[]>();
  if (exerciseIds.length > 0) {
    const { data: prompts } = await sb
      .from("role_player_prompts")
      .select("exercise_id, prompt_text, trigger_behaviors")
      .in("exercise_id", exerciseIds);
    for (const p of prompts ?? []) {
      const arr = promptsByExercise.get(p.exercise_id as string) ?? [];
      arr.push({
        prompt: (p.prompt_text as string) ?? "",
        triggerBehaviours: (p.trigger_behaviors as string) ?? null,
      });
      promptsByExercise.set(p.exercise_id as string, arr);
    }
  }

  const byExercise = new Map<string, string[]>();
  for (const m of matrixRows.data ?? []) {
    const arr = byExercise.get(m.exercise_id as string) ?? [];
    arr.push(nameOf(m.competencies));
    byExercise.set(m.exercise_id as string, arr);
  }

  const exercises: ManualExercise[] = (exRows.data ?? [])
    .map((x) => x.exercises as unknown as Record<string, unknown> | null)
    .filter(Boolean)
    .map((x) => ({
      name: (x!.name as string) ?? "Exercise",
      exerciseType: (x!.exercise_type as string) ?? null,
      durationMinutes: (x!.duration_minutes as number) ?? null,
      prepMinutes: (x!.prep_minutes as number) ?? null,
      meetingMinutes: (x!.meeting_minutes as number) ?? null,
      instructionsMinutes: (x!.instructions_minutes as number) ?? null,
      participantBrief: (x!.participant_brief as string) ?? null,
      scenarioContext: (x!.scenario_context as string) ?? null,
      assessorNotes: (x!.assessor_notes as string) ?? null,
      rolePlayerPrompts: promptsByExercise.get(x!.id as string) ?? [],
      competencies: byExercise.get(x!.id as string) ?? [],
    }));

  const roles = ((roleRows as { data: Record<string, unknown>[] | null }).data ?? []).map((r) => {
    const p = r.profiles as unknown as { full_name?: string | null; email?: string | null } | null;
    return {
      roleKey: r.role_key as string,
      name: p?.full_name ?? p?.email ?? "Unnamed",
      isExternal: Boolean(r.is_external),
    };
  });

  const participants = (candRows.data ?? []).map((c) => ({
    name: c.full_name as string,
    adjustment: c.adjustment_status === "agreed" ? ((c.adjustment_agreed as string) ?? null) : null,
    extraMinutes: (c.adjustment_extra_minutes as number) ?? null,
  }));

  const org = engagement.organizations as unknown as { name?: string } | null;
  const { sections, checklist, version } = buildCentreManual({
    engagement: engagement as Record<string, unknown>,
    organisationName: org?.name ?? null,
    exercises,
    roles,
    participants,
    competencies: (compRows.data ?? []).map((c) => ({
      name: nameOf(c.competencies),
      weight: (c.weight as number | null) ?? null,
    })),
  });

  const visible = sectionsFor(sections, variant);
  const html = buildCentreManualHtml({
    variant,
    engagementName: engagement.name as string,
    organisationName: org?.name ?? null,
    version,
    sections: visible,
    // The checklist is the centre manager's and the administrator's working
    // document; it lists participant adjustments, so it does not travel with
    // an assessor's or a role-player's copy.
    checklist: variant === "full" || variant === "centre_manager" || variant === "centre_administrator" ? checklist : null,
    confidential: isConfidential(sections, variant),
    issuedTo,
    generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  });

  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 1500, deviceScaleFactor: 1 } });
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 12_000 });
    } catch {
      /* font CDN slow or blocked; the DOM is already in place */
    }
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const safe = `${variantLabel(variant)} ${engagement.name as string}`
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe}-v${version}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
