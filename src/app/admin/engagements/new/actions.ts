"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createEngagementSchema,
  type CreateEngagementPayload,
  newOrganizationSchema,
  type NewOrganizationValues,
  newExerciseSchema,
  type NewExerciseValues,
} from "@/lib/validations/engagement";
import {
  extractCompetenciesFromJobDescription,
  extractCompetenciesFromJdPdf,
  type ExtractedCompetencyRecommendation,
} from "@/lib/ai/jd-competency-extractor";
import { isAIConfigured } from "@/lib/ai/client";
import type { Competency } from "@/types/database";

const MAX_JD_FILE_BYTES = 10 * 1024 * 1024;

export type DomainMapEntry = { id: string; name: string };
export type CompetencyDomainMap = Record<string, DomainMapEntry>;

type CompetencyWithDomain = Competency & {
  competency_clusters: {
    domain_id: string;
    competency_domains: { id: string; name: string } | null;
  } | null;
};

/**
 * Loads the competency framework with cluster + domain joined, returning
 * a slim `Competency[]` for the AI extractor and a `Map<competencyId, domain>`
 * for the H1 category-tally summary card on the recommendations preview.
 */
async function loadCompetenciesWithDomains(): Promise<
  { competencies: Competency[]; domains: CompetencyDomainMap } | { error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competencies")
    .select(
      "id, cluster_id, name, description, sort_order, tags, qa_questions, competency_clusters(domain_id, competency_domains(id, name))"
    )
    .order("sort_order");

  if (error) return { error: `Could not load competencies: ${error.message}` };
  if (!data || data.length === 0) {
    return { error: "No competencies are seeded — run the seed migration first." };
  }

  const rows = data as unknown as CompetencyWithDomain[];
  const domains: CompetencyDomainMap = {};
  const competencies: Competency[] = rows.map((r) => {
    const domain = r.competency_clusters?.competency_domains;
    if (domain) domains[r.id] = { id: domain.id, name: domain.name };
    return {
      id: r.id,
      cluster_id: r.cluster_id,
      name: r.name,
      description: r.description,
      sort_order: r.sort_order,
      tags: r.tags,
      qa_questions: r.qa_questions,
    };
  });
  return { competencies, domains };
}

export async function extractCompetenciesFromJdAction(input: {
  jobDescription: string;
  targetRole?: string;
}): Promise<
  | { recommendations: ExtractedCompetencyRecommendation[]; domains: CompetencyDomainMap }
  | { error: string }
> {
  const jd = input.jobDescription?.trim() ?? "";
  if (jd.length < 50) {
    return { error: "Paste at least 50 characters of the job description." };
  }
  if (jd.length > 20000) {
    return { error: "Job description is too long (max 20,000 characters)." };
  }

  if (!isAIConfigured()) {
    return {
      error:
        "AI is not configured on this server. Set ANTHROPIC_API_KEY in .env.local to enable JD extraction.",
    };
  }

  const loaded = await loadCompetenciesWithDomains();
  if ("error" in loaded) return { error: loaded.error };

  const recommendations = await extractCompetenciesFromJobDescription({
    jobDescription: jd,
    targetRole: input.targetRole,
    competencies: loaded.competencies,
  });

  if (recommendations === null) {
    return { error: "AI extraction failed. Check the server logs and try again." };
  }
  if (recommendations.length === 0) {
    return { error: "No competencies could be extracted from this JD. Try a longer or clearer description." };
  }

  return { recommendations, domains: loaded.domains };
}

export async function extractCompetenciesFromJdFileAction(
  formData: FormData
): Promise<
  | { recommendations: ExtractedCompetencyRecommendation[]; fileName: string; domains: CompetencyDomainMap }
  | { error: string }
> {
  const file = formData.get("file");
  const targetRole = String(formData.get("targetRole") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a JD file to upload." };
  }
  if (file.size > MAX_JD_FILE_BYTES) {
    return { error: "File is too large (max 10MB)." };
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
  const isTxt = lowerName.endsWith(".txt") || file.type === "text/plain";

  if (!isPdf && !isTxt) {
    return { error: "Only PDF or TXT files are supported. Convert .docx to PDF first." };
  }

  if (!isAIConfigured()) {
    return {
      error:
        "AI is not configured on this server. Set ANTHROPIC_API_KEY in .env.local to enable JD extraction.",
    };
  }

  const loaded = await loadCompetenciesWithDomains();
  if ("error" in loaded) return { error: loaded.error };

  const buffer = Buffer.from(await file.arrayBuffer());

  const recommendations = isPdf
    ? await extractCompetenciesFromJdPdf({
        pdfBase64: buffer.toString("base64"),
        targetRole: targetRole || undefined,
        competencies: loaded.competencies,
      })
    : await extractCompetenciesFromJobDescription({
        jobDescription: buffer.toString("utf8"),
        targetRole: targetRole || undefined,
        competencies: loaded.competencies,
      });

  if (recommendations === null) {
    return { error: "AI extraction failed. Check the server logs and try again." };
  }
  if (recommendations.length === 0) {
    return { error: "No competencies could be extracted from this file." };
  }

  return { recommendations, fileName: file.name, domains: loaded.domains };
}

export async function createOrganizationAction(values: NewOrganizationValues) {
  const parsed = newOrganizationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      industry: parsed.data.industry || null,
      country: parsed.data.country || null,
      contact_name: parsed.data.contactName || null,
      contact_email: parsed.data.contactEmail || null,
    })
    .select("id, name")
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createExerciseAction(values: NewExerciseValues) {
  const parsed = newExerciseSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: parsed.data.name,
      exercise_type: parsed.data.exerciseType,
      description: parsed.data.description || null,
      duration_minutes: parsed.data.durationMinutes || null,
      instructions: parsed.data.instructions || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

async function rollbackEngagement(supabase: Awaited<ReturnType<typeof createClient>>, engagementId: string) {
  // Delete in reverse dependency order - cascade should handle most of this
  // but be explicit to ensure clean rollback
  await supabase.from("exercise_competency_matrix").delete().eq("engagement_id", engagementId);
  await supabase.from("engagement_exercises").delete().eq("engagement_id", engagementId);
  await supabase.from("engagement_competencies").delete().eq("engagement_id", engagementId);
  await supabase.from("engagements").delete().eq("id", engagementId);
}

export async function createEngagementAction(payload: CreateEngagementPayload) {
  const parsed = createEngagementSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const data = parsed.data;

  // 1. Insert engagement
  const { data: engagement, error: engError } = await supabase
    .from("engagements")
    .insert({
      organization_id: data.organizationId,
      name: data.name,
      target_role: data.targetRole || null,
      status: "draft",
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      created_by: await supabase.auth.getUser().then(r => r.data.user?.id ?? null),
    })
    .select("id")
    .single();

  if (engError || !engagement) {
    return { error: engError?.message ?? "Failed to create engagement" };
  }

  const engagementId = engagement.id;

  // 2. Insert engagement_competencies
  const compRows = data.competencies.map((c) => ({
    engagement_id: engagementId,
    competency_id: c.competencyId,
    weight: c.weight,
  }));

  const { error: compError } = await supabase
    .from("engagement_competencies")
    .insert(compRows);

  if (compError) {
    await rollbackEngagement(supabase, engagementId);
    return { error: `Competencies: ${compError.message}` };
  }

  // 3. Insert engagement_exercises
  const exRows = data.exercises.map((exerciseId) => ({
    engagement_id: engagementId,
    exercise_id: exerciseId,
  }));

  const { error: exError } = await supabase
    .from("engagement_exercises")
    .insert(exRows);

  if (exError) {
    await rollbackEngagement(supabase, engagementId);
    return { error: `Exercises: ${exError.message}` };
  }

  // 4. Insert exercise_competency_matrix
  if (data.matrix.length > 0) {
    const matrixRows = data.matrix.map((m) => ({
      engagement_id: engagementId,
      exercise_id: m.exerciseId,
      competency_id: m.competencyId,
    }));

    const { error: matrixError } = await supabase
      .from("exercise_competency_matrix")
      .insert(matrixRows);

    if (matrixError) {
      await rollbackEngagement(supabase, engagementId);
      return { error: `Matrix: ${matrixError.message}` };
    }
  }

  return { data: { id: engagementId } };
}
