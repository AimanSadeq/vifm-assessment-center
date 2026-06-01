"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { isAIConfigured } from "@/lib/ai/client";
import { listTechnicalFunctions, skillLibraryFrom, TECH_FUNCTION_CATEGORIES } from "@/lib/competencies/technical-function";
import {
  extractTechnicalSkillsFromJd,
  extractTechnicalSkillsFromJdPdf,
  translateFunctionToArabic,
  type JdFunctionBlueprint,
} from "@/lib/ai/jd-technical-extractor";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

async function guard(): Promise<{ ok: true } | { error: string }> {
  try {
    await requireRole(["admin"]);
    return { ok: true };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const CATEGORY_SET = new Set<string>(TECH_FUNCTION_CATEGORIES);

/**
 * Read a JD (pasted text OR an uploaded PDF/TXT) and return a proposed function
 * blueprint — matched library skills + proposed-new skills + suggested name and
 * category. The admin reviews/edits before createTechnicalFunctionAction.
 */
export async function extractFunctionFromJdAction(
  formData: FormData
): Promise<Result<{ blueprint: JdFunctionBlueprint }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!isAIConfigured()) {
    return { error: "AI is not configured. Set ANTHROPIC_API_KEY to import a job description." };
  }

  const targetRole = (formData.get("targetRole") as string | null)?.trim() || undefined;
  const jdText = (formData.get("jdText") as string | null)?.trim() || "";
  const file = formData.get("file");

  // The reuse menu: every skill across the current standard + custom functions.
  const skillLibrary = skillLibraryFrom(await listTechnicalFunctions("en"));

  try {
    let blueprint: JdFunctionBlueprint | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return { error: "File too large (max 10 MB)." };
      const lower = file.name.toLowerCase();
      const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
      const isTxt = lower.endsWith(".txt") || file.type === "text/plain";
      if (!isPdf && !isTxt) return { error: "Only PDF or TXT job descriptions are supported." };
      const buffer = Buffer.from(await file.arrayBuffer());
      blueprint = isPdf
        ? await extractTechnicalSkillsFromJdPdf({ pdfBase64: buffer.toString("base64"), skillLibrary, targetRole })
        : await extractTechnicalSkillsFromJd({ jobDescription: buffer.toString("utf8"), skillLibrary, targetRole });
    } else if (jdText) {
      blueprint = await extractTechnicalSkillsFromJd({ jobDescription: jdText, skillLibrary, targetRole });
    } else {
      return { error: "Paste a job description or upload a PDF/TXT file." };
    }

    if (!blueprint) return { error: "Couldn't derive a function from that job description. Try a fuller JD." };
    return { ok: true, blueprint };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Extraction failed." };
  }
}

/**
 * Create a custom (source='jd') function from the reviewed blueprint. `skills`
 * are the final accepted English skill names (matched + proposed). Arabic is
 * best-effort (the loader falls back to English when absent).
 */
export async function createTechnicalFunctionAction(input: {
  name: string;
  category: string;
  skills: string[];
}): Promise<Result<{ id: string }>> {
  const g = await guard();
  if ("error" in g) return g;

  const name = input.name.trim();
  const category = CATEGORY_SET.has(input.category) ? input.category : "accounting";
  const skills = Array.from(new Set(input.skills.map((s) => s.trim()).filter(Boolean)));
  if (!name) return { error: "Give the function a name." };
  if (skills.length < 3) return { error: "A function needs at least 3 skills." };

  // Best-effort bilingual: translate the final name + skills to Arabic.
  const { name_ar, skills_ar } = await translateFunctionToArabic({ name, skills });

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_functions")
      .insert({
        key: null, // custom functions have no stable key
        name_en: name,
        name_ar,
        category,
        skills_en: skills,
        skills_ar,
        source: "jd",
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not create the function." };
    revalidatePath("/admin/tech-assessment/functions");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the function." };
  }
}

/** Delete a custom (JD-derived) function. Refuses to touch the standard library. */
export async function deleteTechnicalFunctionAction(input: { id: string }): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  try {
    const sb = createServiceClient();
    const { data: row } = await sb
      .from("technical_functions")
      .select("source")
      .eq("id", input.id)
      .maybeSingle();
    if (!row) return { error: "Function not found." };
    if (row.source !== "jd") return { error: "Standard library functions can't be deleted." };
    const { error } = await sb.from("technical_functions").delete().eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/tech-assessment/functions");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not delete the function." };
  }
}
