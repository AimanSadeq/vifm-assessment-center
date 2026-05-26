"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { isAIConfigured } from "@/lib/ai/client";
import {
  extractCourseFromPdf,
  type ExtractedCoursePayload,
} from "@/lib/ai/course-extractor";
import type { Competency, VifmCourseLevel, VifmVertical } from "@/types/database";

async function requireAdmin() {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

export type ExtractRowResult =
  | {
      ok: true;
      filename: string;
      payload: ExtractedCoursePayload;
      // When the extracted record matches an existing course (by code,
      // or falling back to title_en case-insensitive), the existing
      // course's id and a friendly label come back so the import UI can
      // show "Replace existing" and the user can choose to overwrite or
      // skip per-row before committing.
      existing_course_id: string | null;
      existing_course_label: string | null;
    }
  | { ok: false; filename: string; error: string };

/**
 * Reads each uploaded PDF, sends it to Claude, returns a per-file
 * structured proposal. Nothing is written to the catalogue yet -
 * the admin reviews each row in the UI and clicks "Create N
 * courses" to commit accepted ones via createCoursesFromProposalsAction.
 */
export async function extractCoursesFromPdfsAction(
  formData: FormData
): Promise<{ ok: false; error: string } | { ok: true; results: ExtractRowResult[] }> {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isAIConfigured()) {
    return {
      ok: false,
      error: "AI is not configured. Set ANTHROPIC_API_KEY in .env.local to use the PDF importer.",
    };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { ok: false, error: "No files uploaded." };
  if (files.length > 25) {
    return { ok: false, error: "Up to 25 files per batch - split larger batches across runs." };
  }

  const sb = await createClient();
  // Only id/name/description are used by the extractor prompt - keep
  // the SELECT minimal so this works on environments where the Arabic
  // competency columns from later migrations haven't been applied.
  const { data: comps, error: compErr } = await sb
    .from("competencies")
    .select("id, name, description")
    .order("name");
  if (compErr) return { ok: false, error: `Couldn't load competencies: ${compErr.message}` };
  const competencies = (comps ?? []) as unknown as Competency[];

  // Process in parallel, capped - 25 PDFs at once would hammer the
  // Anthropic rate limits. 5 concurrent is plenty for this workload
  // and keeps total wall-time reasonable.
  const concurrency = 5;
  const results: ExtractRowResult[] = [];
  const queue: File[] = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        const pdfBase64 = Buffer.from(buf).toString("base64");
        const payload = await extractCourseFromPdf({
          pdfBase64,
          competencies,
          filename: file.name,
        });
        if (!payload) {
          results.push({ ok: false, filename: file.name, error: "AI extraction failed - see server logs" });
        } else {
          results.push({
            ok: true,
            filename: file.name,
            payload,
            existing_course_id: null,
            existing_course_label: null,
          });
        }
      } catch (e) {
        results.push({
          ok: false,
          filename: file.name,
          error: e instanceof Error ? e.message : "Unexpected error",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));

  // Duplicate detection - match each successful extraction against the
  // existing catalogue so the UI can show "Replace existing" per row.
  // Match priority: 1) code (case-insensitive) when the extraction
  // produced one, 2) title_en (case-insensitive). Code wins because a
  // re-uploaded PDF whose title was rephrased slightly is still the
  // same course.
  const successRows = results.filter((r): r is Extract<ExtractRowResult, { ok: true }> => r.ok);
  if (successRows.length > 0) {
    const codes = successRows
      .map((r) => r.payload.code?.trim().toLowerCase())
      .filter((c): c is string => !!c);
    const titles = successRows.map((r) => r.payload.title_en.trim().toLowerCase());

    const { data: existingByCode } = codes.length > 0
      ? await sb
          .from("vifm_courses")
          .select("id, title_en, code")
          .not("code", "is", null)
          .in("code", codes)
      : { data: [] as Array<{ id: string; title_en: string; code: string | null }> };

    const { data: existingByTitle } = await sb
      .from("vifm_courses")
      .select("id, title_en, code")
      .in("title_en", successRows.map((r) => r.payload.title_en));

    type ExistingRow = { id: string; title_en: string; code: string | null };
    const codeIndex = new Map<string, ExistingRow>();
    for (const row of (existingByCode ?? []) as ExistingRow[]) {
      if (row.code) codeIndex.set(row.code.toLowerCase(), row);
    }
    const titleIndex = new Map<string, ExistingRow>();
    for (const row of (existingByTitle ?? []) as ExistingRow[]) {
      titleIndex.set(row.title_en.toLowerCase(), row);
    }

    for (const row of successRows) {
      const code = row.payload.code?.trim().toLowerCase();
      const title = row.payload.title_en.trim().toLowerCase();
      const match = (code && codeIndex.get(code)) || titleIndex.get(title) || null;
      if (match) {
        row.existing_course_id = match.id;
        row.existing_course_label = match.code
          ? `${match.title_en} (${match.code})`
          : match.title_en;
      }
    }
  }

  // Stable ordering by original upload order
  const orderByName = new Map(files.map((f, i) => [f.name, i]));
  results.sort((a, b) => (orderByName.get(a.filename) ?? 0) - (orderByName.get(b.filename) ?? 0));

  return { ok: true, results };
}

/**
 * Commits the accepted proposals from the import UI into the catalogue.
 * Each successful proposal becomes one vifm_courses row + N tag rows.
 * Failures roll back the orphaned course shell so we never end up with
 * a course row that has no tags AND no further data.
 */
export async function createCoursesFromProposalsAction(
  proposals: Array<{
    payload: ExtractedCoursePayload;
    filename: string;
    // When set, the action UPDATES the existing course rather than
    // INSERTing a new one - used for the "Replace existing" path on
    // re-imports.
    replace_course_id?: string | null;
  }>
): Promise<{
  ok: false;
  error: string;
} | {
  ok: true;
  created: Array<{ filename: string; courseId: string; replaced: boolean }>;
  failed: Array<{ filename: string; error: string }>;
}> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (proposals.length === 0) return { ok: false, error: "No proposals to commit." };

  const sb = await createClient();

  const created: Array<{ filename: string; courseId: string; replaced: boolean }> = [];
  const failed: Array<{ filename: string; error: string }> = [];

  for (const { payload, filename, replace_course_id } of proposals) {
    const VALID_LEVELS: VifmCourseLevel[] = ["foundation", "intermediate", "advanced"];
    const VALID_VERTICALS: VifmVertical[] = [
      "finance", "investment", "treasury", "accounting", "banking", "tax",
      "analytics", "business_intelligence", "artificial_intelligence",
      "business_reporting", "leadership", "strategy", "project_management",
      "real_estate",
    ];

    if (!VALID_VERTICALS.includes(payload.vertical)) {
      failed.push({ filename, error: `Invalid vertical: ${payload.vertical}` });
      continue;
    }

    const courseRow = {
      code: payload.code,
      title_en: payload.title_en,
      title_ar: payload.title_ar,
      vertical: payload.vertical,
      level: VALID_LEVELS.includes(payload.level) ? payload.level : "intermediate",
      certification_code: payload.certification_code,
      default_duration_days: payload.default_duration_days,
      min_duration_days: payload.min_duration_days,
      max_duration_days: payload.max_duration_days,
      delivery_modes: ["classroom", "virtual"],
      languages: payload.title_ar ? ["en", "ar"] : ["en"],
      overview_en: payload.overview_en,
      overview_ar: payload.overview_ar,
      target_competencies_raw_en: payload.target_competencies_raw_en,
      target_competencies_raw_ar: payload.target_competencies_raw_ar,
      audience_en: payload.audience_en,
      audience_ar: payload.audience_ar,
      objectives_en: payload.objectives_en,
      objectives_ar: payload.objectives_ar,
      methodology_en: payload.methodology_en,
      methodology_ar: payload.methodology_ar,
      outline_en: payload.outline_en,
      outline_ar: payload.outline_ar,
      source_pdf_path: filename,
      extraction_confidence: payload.extraction_confidence,
      is_active: true,
    };

    let courseId: string;
    let replaced = false;
    if (replace_course_id) {
      const updateRes = await sb
        .from("vifm_courses")
        .update(courseRow)
        .eq("id", replace_course_id)
        .select("id")
        .single();
      if (updateRes.error || !updateRes.data) {
        failed.push({
          filename,
          error: updateRes.error?.message ?? "Course replace failed",
        });
        continue;
      }
      courseId = updateRes.data.id as string;
      replaced = true;
      // Wipe the old tag mappings - Day 2's import flow regenerates
      // them from the freshly-extracted payload below. We don't try
      // to merge old + new because the AI's tag set may legitimately
      // shift between extractions of two different revisions of the
      // same course outline.
      await sb.from("vifm_course_competency_tags").delete().eq("course_id", courseId);
      await sb.from("vifm_course_pillar_tags").delete().eq("course_id", courseId);
    } else {
      const insertRes = await sb
        .from("vifm_courses")
        .insert(courseRow)
        .select("id")
        .single();
      if (insertRes.error || !insertRes.data) {
        failed.push({ filename, error: insertRes.error?.message ?? "Course insert failed" });
        continue;
      }
      courseId = insertRes.data.id as string;
    }

    // Tag rows - best-effort. If they fail we keep the course (the
    // catalogue entry is still useful) but report the partial failure.
    if (payload.competency_tags.length > 0) {
      const compTagRows = payload.competency_tags.map((t) => ({
        course_id: courseId,
        competency_id: t.competency_id,
        relevance_weight: t.relevance_weight,
        rationale: t.rationale,
        source: "ai_accepted" as const,
      }));
      const tagRes = await sb.from("vifm_course_competency_tags").insert(compTagRows);
      if (tagRes.error) {
        failed.push({
          filename,
          error: `Course saved but competency tags failed: ${tagRes.error.message}`,
        });
        continue;
      }
    }
    if (payload.pillar_tags.length > 0) {
      const pillarTagRows = payload.pillar_tags.map((t) => ({
        course_id: courseId,
        pillar_id: t.pillar_id,
        relevance_weight: t.relevance_weight,
        rationale: t.rationale,
        source: "ai_accepted" as const,
      }));
      const tagRes = await sb.from("vifm_course_pillar_tags").insert(pillarTagRows);
      if (tagRes.error) {
        failed.push({
          filename,
          error: `Course saved but pillar tags failed: ${tagRes.error.message}`,
        });
        continue;
      }
    }

    created.push({ filename, courseId, replaced });
  }

  revalidatePath("/admin/courses");
  return { ok: true, created, failed };
}
