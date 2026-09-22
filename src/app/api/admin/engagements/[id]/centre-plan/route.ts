import { NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { buildCentrePlanHtml, type CentrePlanData } from "@/lib/reports/centre-plan-html";

/**
 * GET /api/admin/engagements/[id]/centre-plan - the plan the standard requires
 * to be agreed and documented with the client (BPS 3.26).
 *
 * Every section is generated from the engagement as designed, so the plan
 * cannot drift from the centre it describes. Admin-gated.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const sb = createServiceClient();
  const { data: engagement } = await sb
    .from("engagements")
    .select("*, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [compRows, exRows, matrixRows, roleRows, candCount] = await Promise.all([
    sb
      .from("engagement_competencies")
      .select("competency_id, weight, rationale, source, competencies(name)")
      .eq("engagement_id", params.id),
    sb
      .from("engagement_exercises")
      .select("exercise_id, exercises(id, name, exercise_type, duration_minutes)")
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
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", params.id),
  ]);

  const compName = (row: unknown): string => {
    const c = row as { name?: string } | { name?: string }[] | null;
    return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Unnamed criterion";
  };

  const competencies = (compRows.data ?? []).map((c) => ({
    name: compName(c.competencies),
    weight: (c.weight as number | null) ?? null,
    rationale: (c.rationale as string | null) ?? null,
    source: (c.source as string | null) ?? null,
  }));

  const byExercise = new Map<string, string[]>();
  for (const m of matrixRows.data ?? []) {
    const arr = byExercise.get(m.exercise_id as string) ?? [];
    arr.push(compName(m.competencies));
    byExercise.set(m.exercise_id as string, arr);
  }

  const exercises = (exRows.data ?? [])
    .map((x) => x.exercises as unknown as { id: string; name: string; exercise_type: string | null; duration_minutes: number | null } | null)
    .filter(Boolean)
    .map((x) => ({
      name: x!.name,
      exerciseType: x!.exercise_type,
      durationMinutes: x!.duration_minutes,
      competencies: byExercise.get(x!.id) ?? [],
    }));

  const roles = ((roleRows as { data: Record<string, unknown>[] | null }).data ?? []).map((r) => {
    const p = r.profiles as unknown as { full_name?: string | null; email?: string | null } | null;
    return {
      roleKey: r.role_key as string,
      name: p?.full_name ?? p?.email ?? "Unnamed",
      isExternal: Boolean(r.is_external),
    };
  });

  const org = engagement.organizations as unknown as { name?: string } | null;
  const data: CentrePlanData = {
    engagement: engagement as Record<string, unknown>,
    organisationName: org?.name ?? null,
    competencies,
    exercises,
    roles,
    participantCount: candCount.count ?? 0,
    generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };

  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser({ defaultViewport: { width: 1200, height: 1500, deviceScaleFactor: 1 } });
    const page = await browser.newPage();
    // Same reasoning as the framework PDF: the brand webfont is a nicety and
    // the content is already in the DOM after setContent, so a slow font CDN
    // must not turn a plan into a 500.
    try {
      await page.setContent(buildCentrePlanHtml(data), { waitUntil: "networkidle0", timeout: 12_000 });
    } catch {
      /* font CDN slow or blocked; render with the fallback face */
    }
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const safeName = String(engagement.name ?? "centre").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Centre-plan-${safeName}.pdf"`,
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
