"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai/client";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

async function gateAdmin(): Promise<{ error: string } | null> {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}
import {
  extractCompetenciesFromJobDescription,
  extractCompetenciesFromJdPdf,
  type ExtractedCompetencyRecommendation,
} from "@/lib/ai/jd-competency-extractor";
import type { Competency } from "@/types/database";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 25;

export type BulkJdExtractItem =
  | {
      status: "ok";
      fileName: string;
      suggestedName: string;
      recommendations: ExtractedCompetencyRecommendation[];
    }
  | {
      status: "error";
      fileName: string;
      error: string;
    };

/**
 * G4 - Process N JDs in one server roundtrip and return one row per file
 * with the extracted recommendations + a suggested name. The client then
 * lets the admin tweak names + decide which to actually create as role
 * profiles.
 *
 * Caveat: each file does a separate Claude call so this scales O(n) in
 * AI cost and latency. Capped at 25 files per batch to keep total
 * latency reasonable; the admin can run the page multiple times.
 */
export async function bulkExtractJdsAction(
  formData: FormData
): Promise<{ items: BulkJdExtractItem[] } | { error: string }> {
  const denied = await gateAdmin();
  if (denied) return denied;

  if (!isAIConfigured()) {
    return {
      error:
        "AI is not configured on this server. Set ANTHROPIC_API_KEY in .env.local to enable bulk JD import.",
    };
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return { error: "No files uploaded." };
  }
  if (files.length > MAX_FILES_PER_BATCH) {
    return {
      error: `Max ${MAX_FILES_PER_BATCH} files per batch. Split the upload and retry.`,
    };
  }

  const supabase = await createClient();
  const { data: competencies, error: compErr } = await supabase
    .from("competencies")
    .select("id, name, description, sort_order, cluster_id, tags, qa_questions")
    .order("sort_order");

  if (compErr || !competencies || competencies.length === 0) {
    return {
      error: compErr?.message ?? "No competencies seeded - run the seed migrations first.",
    };
  }

  const items: BulkJdExtractItem[] = [];
  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      items.push({ status: "error", fileName: "(empty)", error: "Empty file." });
      continue;
    }
    if (fileEntry.size > MAX_FILE_BYTES) {
      items.push({
        status: "error",
        fileName: fileEntry.name,
        error: `Too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`,
      });
      continue;
    }

    const lower = fileEntry.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || fileEntry.type === "application/pdf";
    const isTxt = lower.endsWith(".txt") || fileEntry.type === "text/plain";
    if (!isPdf && !isTxt) {
      items.push({
        status: "error",
        fileName: fileEntry.name,
        error: "Only PDF or TXT supported.",
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      const recommendations = isPdf
        ? await extractCompetenciesFromJdPdf({
            pdfBase64: buffer.toString("base64"),
            competencies: competencies as Competency[],
          })
        : await extractCompetenciesFromJobDescription({
            jobDescription: buffer.toString("utf8"),
            competencies: competencies as Competency[],
          });

      if (!recommendations || recommendations.length === 0) {
        items.push({
          status: "error",
          fileName: fileEntry.name,
          error: "AI returned no usable competencies.",
        });
        continue;
      }

      const suggestedName = fileEntry.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);

      items.push({
        status: "ok",
        fileName: fileEntry.name,
        suggestedName: suggestedName || fileEntry.name,
        recommendations,
      });
    } catch (err) {
      items.push({
        status: "error",
        fileName: fileEntry.name,
        error: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return { items };
}

const bulkCreateSchema = z.object({
  profiles: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        recommendations: z.array(
          z.object({
            competencyId: z.string(),
            weight: z.number(),
            priority: z.enum(["high", "medium", "low"]),
            reasoning: z.string().optional(),
          })
        ),
      })
    )
    .min(1)
    .max(25),
});

/**
 * Inserts each accepted profile as a role_profile + role_profile_competencies
 * rows in sequence. Returns one entry per input so the UI can flag failures.
 */
export async function bulkCreateRoleProfilesAction(input: {
  profiles: {
    name: string;
    recommendations: ExtractedCompetencyRecommendation[];
  }[];
}) {
  const denied = await gateAdmin();
  if (denied) return denied;

  const parsed = bulkCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Validation failed. Check each profile name and recommendations." };
  }

  const supabase = await createClient();
  const created: { name: string; id: string }[] = [];
  const failed: { name: string; message: string }[] = [];

  for (const profile of parsed.data.profiles) {
    const { data: rp, error: insertErr } = await supabase
      .from("role_profiles")
      .insert({
        name_en: profile.name,
        default_target_proficiency: 3,
        source_jd: "(bulk-import)",
      })
      .select("id")
      .single();

    if (insertErr || !rp) {
      failed.push({ name: profile.name, message: insertErr?.message ?? "insert failed" });
      continue;
    }

    const compRows = profile.recommendations.map((r) => ({
      role_profile_id: rp.id as string,
      competency_id: r.competencyId,
      weight: r.weight,
      priority: r.priority,
      reasoning: r.reasoning ?? null,
    }));

    const { error: compErr } = await supabase
      .from("role_profile_competencies")
      .insert(compRows);

    if (compErr) {
      // Roll back the role_profile so we don't leave an empty shell
      await supabase.from("role_profiles").delete().eq("id", rp.id);
      failed.push({
        name: profile.name,
        message: `Competency rows failed: ${compErr.message}`,
      });
      continue;
    }

    created.push({ name: profile.name, id: rp.id as string });
  }

  return { created, failed };
}
