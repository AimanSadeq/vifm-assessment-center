"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
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
import { createClientOrganization } from "@/lib/clients/registry";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
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
    return { error: "No competencies are seeded - run the seed migration first." };
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

  // Admin-gated; under AUTH_ENABLED=false requireRole returns a synthetic admin.
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Not authorized." };
    throw e;
  }

  // Write through the shared registry (service-role - fixes the RLS-denied insert
  // on `organizations`) so the new client also lands in the AR Compass / Reflect
  // store and is selectable across every service, not just this engagement.
  const res = await createClientOrganization({
    name: parsed.data.name,
    industry: parsed.data.industry || null,
    country: parsed.data.country || null,
    contactName: parsed.data.contactName || null,
    contactEmail: parsed.data.contactEmail || null,
  });
  if (!res.ok) return { error: res.error };
  return { data: { id: res.organizationId, name: parsed.data.name } };
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

export async function createEngagementAction(payload: CreateEngagementPayload) {
  const parsed = createEngagementSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Previously a non-atomic 4-step multi-insert with an error-swallowing manual
  // rollback: a failed step past the first left a half-built engagement, and a
  // failing rollback (its own errors were discarded) left an inconsistent draft.
  // Delegate to the create_engagement_atomic RPC instead - a single transaction
  // (all inserts or none). The RPC is SECURITY DEFINER, locked to service_role
  // (migration 00188), so it runs via the service client, which bypasses RLS -
  // hence the explicit admin gate here (the old path relied on RLS).
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Not authorized." };
    throw e;
  }

  const data = parsed.data;
  const svc = createServiceClient();
  const { data: newId, error } = await svc.rpc("create_engagement_atomic", {
    p_organization_id: data.organizationId,
    p_name: data.name,
    p_target_role: data.targetRole || null,
    p_status: "draft",
    p_start_date: data.startDate || null,
    p_end_date: data.endDate || null,
    p_created_by: caller.isDev ? null : caller.uid,
    p_competencies: data.competencies, // [{competencyId, weight}] -> jsonb
    p_exercises: data.exercises, // uuid[]
    p_matrix: data.matrix, // [{exerciseId, competencyId}] -> jsonb
  });

  if (error) return { error: error.message };
  return { data: { id: newId as string } };
}
