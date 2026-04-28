"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import type {
  VifmCourseLevel,
  VifmVertical,
} from "@/types/database";

async function requireAdmin() {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const VERTICALS = [
  "finance", "investment", "treasury", "accounting", "banking", "tax",
  "analytics", "business_intelligence", "artificial_intelligence",
  "business_reporting", "leadership", "strategy", "project_management",
  "real_estate",
] as const satisfies readonly VifmVertical[];

const LEVELS = ["foundation", "intermediate", "advanced"] as const satisfies readonly VifmCourseLevel[];

const PILLAR_IDS = [
  "strategy", "data", "technology", "talent", "culture",
  "governance", "operations", "model_management",
] as const;

// Block 6 outline — supports both shapes (flat bullets, nested subsections).
// See VifmCourseOutlineSection in src/types/database.ts for the field
// semantics. Each section uses ONE shape, never both.
const outlineBulletSchema = z.object({
  text: z.string(),
  sub_bullets: z.array(z.string()).optional(),
});
const outlineSectionSchema = z.object({
  main_header: z.string(),
  bullets: z.array(outlineBulletSchema).optional(),
  subsections: z
    .array(z.object({
      sub_header: z.string(),
      bullets: z.array(outlineBulletSchema),
    }))
    .optional(),
});

const courseUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(40).nullable().optional(),
  title_en: z.string().min(1).max(300),
  title_ar: z.string().max(300).nullable().optional(),
  vertical: z.enum(VERTICALS),
  level: z.enum(LEVELS).default("intermediate"),
  certification_code: z.string().max(40).nullable().optional(),
  default_duration_days: z.number().min(0.5).max(20).default(5),
  min_duration_days: z.number().min(0.5).max(20).default(2),
  max_duration_days: z.number().min(0.5).max(20).default(5),
  delivery_modes: z.array(z.string()).default(["classroom", "virtual"]),
  languages: z.array(z.string()).default(["en"]),
  overview_en: z.string().nullable().optional(),
  overview_ar: z.string().nullable().optional(),
  target_competencies_raw_en: z.array(z.string()).nullable().optional(),
  target_competencies_raw_ar: z.array(z.string()).nullable().optional(),
  audience_en: z.string().nullable().optional(),
  audience_ar: z.string().nullable().optional(),
  objectives_en: z.array(z.string()).nullable().optional(),
  objectives_ar: z.array(z.string()).nullable().optional(),
  methodology_en: z.string().nullable().optional(),
  methodology_ar: z.string().nullable().optional(),
  outline_en: z.array(outlineSectionSchema).nullable().optional(),
  outline_ar: z.array(outlineSectionSchema).nullable().optional(),
  note_en: z.string().nullable().optional(),
  note_ar: z.string().nullable().optional(),
  source_pdf_path: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CourseUpsertValues = z.infer<typeof courseUpsertSchema>;

export async function upsertCourseAction(values: CourseUpsertValues) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = courseUpsertSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  if (parsed.data.min_duration_days > parsed.data.default_duration_days
      || parsed.data.default_duration_days > parsed.data.max_duration_days) {
    return { error: "Duration range invalid: min ≤ default ≤ max." };
  }

  const sb = await createClient();
  if (parsed.data.id) {
    const { id, ...rest } = parsed.data;
    const { data, error } = await sb
      .from("vifm_courses")
      .update(rest)
      .eq("id", id)
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    return { data };
  } else {
    const { data, error } = await sb
      .from("vifm_courses")
      .insert(parsed.data)
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/admin/courses");
    return { data };
  }
}

export async function deleteCourseAction(id: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = await createClient();
  const { error } = await sb.from("vifm_courses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/courses");
  return { success: true };
}

const setCompetencyTagsSchema = z.object({
  course_id: z.string().uuid(),
  tags: z.array(z.object({
    competency_id: z.string().uuid(),
    relevance_weight: z.number().int().min(1).max(3),
    rationale: z.string().nullable().optional(),
    source: z.enum(["manual", "ai_proposed", "ai_accepted"]).default("manual"),
  })),
});

export async function setCourseCompetencyTagsAction(values: z.infer<typeof setCompetencyTagsSchema>) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = setCompetencyTagsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const sb = await createClient();
  // Replace-all semantics — easiest correct shape since the UI is
  // a multi-select "set of tags" rather than incremental adds. The
  // FK has ON DELETE CASCADE so this is safe.
  const { error: delErr } = await sb
    .from("vifm_course_competency_tags")
    .delete()
    .eq("course_id", parsed.data.course_id);
  if (delErr) return { error: delErr.message };

  if (parsed.data.tags.length > 0) {
    const rows = parsed.data.tags.map((t) => ({
      course_id: parsed.data.course_id,
      competency_id: t.competency_id,
      relevance_weight: t.relevance_weight,
      rationale: t.rationale ?? null,
      source: t.source,
    }));
    const { error: insErr } = await sb.from("vifm_course_competency_tags").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/admin/courses/${parsed.data.course_id}`);
  return { success: true };
}

const setPillarTagsSchema = z.object({
  course_id: z.string().uuid(),
  tags: z.array(z.object({
    pillar_id: z.enum(PILLAR_IDS),
    relevance_weight: z.number().int().min(1).max(3),
    rationale: z.string().nullable().optional(),
    source: z.enum(["manual", "ai_proposed", "ai_accepted"]).default("manual"),
  })),
});

export async function setCoursePillarTagsAction(values: z.infer<typeof setPillarTagsSchema>) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = setPillarTagsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const sb = await createClient();
  const { error: delErr } = await sb
    .from("vifm_course_pillar_tags")
    .delete()
    .eq("course_id", parsed.data.course_id);
  if (delErr) return { error: delErr.message };

  if (parsed.data.tags.length > 0) {
    const rows = parsed.data.tags.map((t) => ({
      course_id: parsed.data.course_id,
      pillar_id: t.pillar_id,
      relevance_weight: t.relevance_weight,
      rationale: t.rationale ?? null,
      source: t.source,
    }));
    const { error: insErr } = await sb.from("vifm_course_pillar_tags").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/admin/courses/${parsed.data.course_id}`);
  return { success: true };
}
