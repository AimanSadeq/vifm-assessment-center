"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { extractCompetenciesFromJobDescription } from "@/lib/ai/jd-competency-extractor";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import type { Competency } from "@/types/database";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

async function guard(): Promise<{ ok: true; uid?: string; isDev: boolean } | { error: string }> {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true, uid: caller.uid, isDev: caller.isDev };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

/** A suggested target proficiency from the AI-assigned priority (editable in the UI). */
function targetFromPriority(p: "high" | "medium" | "low"): number {
  return p === "high" ? 4 : p === "medium" ? 3.5 : 3;
}

export type DesignedCompetency = {
  competencyId: string;
  name: string;
  domain: string; // THINKING / RESULTS / PEOPLE / SELF
  domainSort: number;
  area: string; // cluster / area name
  weight: number;
  priority: "high" | "medium" | "low";
  target: number; // suggested target proficiency (1-5)
  reasoning: string;
};

/** Extract the relevant competencies for a role from a pasted job description. */
export async function extractRoleFromJdAction(input: {
  jobDescription: string;
  roleName?: string;
}): Promise<Result<{ competencies: DesignedCompetency[] }>> {
  const g = await guard();
  if ("error" in g) return g;
  const jd = (input.jobDescription ?? "").trim();
  if (jd.length < 30) return { error: "Paste a longer job description (at least a few lines)." };

  const sb = createServiceClient();
  const { data: cat, error } = await sb.from("competencies").select("id, name, description, cluster_id");
  if (error) return { error: "Could not load the competency framework." };
  const competencies = (cat ?? []) as Competency[];

  // Framework structure: competency -> cluster (area) -> domain. Loaded from the
  // DB so the rollup uses the real mapping (THINKING / RESULTS / PEOPLE / SELF).
  const [{ data: clusters }, { data: domains }] = await Promise.all([
    sb.from("competency_clusters").select("id, name, domain_id"),
    sb.from("competency_domains").select("id, name, sort_order"),
  ]);
  const domainById = new Map(
    (domains ?? []).map((d) => [d.id as string, { name: d.name as string, sort: Number(d.sort_order ?? 0) }]),
  );
  const clusterById = new Map(
    (clusters ?? []).map((c) => [c.id as string, { name: c.name as string, domainId: c.domain_id as string }]),
  );
  const compClusterId = new Map((cat ?? []).map((c) => [c.id as string, c.cluster_id as string | null]));

  const recs = await extractCompetenciesFromJobDescription({
    jobDescription: jd,
    targetRole: input.roleName?.trim() || undefined,
    competencies,
  });
  if (recs === null) {
    return { error: "AI extraction is unavailable. Set ANTHROPIC_API_KEY, or add competencies manually." };
  }

  // Area fallback name from the framework bank, used only if the cluster row is missing.
  const bankArea = new Map(BEHAVIORAL_COMPETENCIES.map((c) => [c.acCompetencyId, c.clusterNameEn]));
  const designed: DesignedCompetency[] = recs.map((r) => {
    const clusterId = compClusterId.get(r.competencyId) ?? null;
    const cluster = clusterId ? clusterById.get(clusterId) : undefined;
    const domain = cluster ? domainById.get(cluster.domainId) : undefined;
    return {
      competencyId: r.competencyId,
      name: r.competencyName,
      domain: domain?.name ?? "Other",
      domainSort: domain?.sort ?? 99,
      area: cluster?.name ?? bankArea.get(r.competencyId) ?? "Other",
      weight: r.weight,
      priority: r.priority,
      target: targetFromPriority(r.priority),
      reasoning: r.reasoning,
    };
  });
  return { ok: true, competencies: designed };
}

/** Persist a designed target role (role_profiles + role_profile_competencies,
 *  including per-competency target_proficiency) for reuse anywhere a role is picked. */
export async function saveTargetRoleAction(input: {
  name: string;
  region?: "uae" | "saudi" | "gcc" | "global" | null;
  sourceJd?: string | null;
  competencies: {
    competencyId: string;
    weight: number;
    priority: "high" | "medium" | "low";
    target: number;
  }[];
}): Promise<Result<{ id: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  const name = (input.name ?? "").trim();
  if (name.length < 2) return { error: "Give the role a name." };
  const comps = (input.competencies ?? []).filter((c) => c.competencyId);
  if (comps.length === 0) return { error: "Add at least one competency." };

  const sb = createServiceClient();
  const { data: profile, error: pErr } = await sb
    .from("role_profiles")
    .insert({
      name_en: name,
      target_role: name,
      region: input.region ?? null,
      source_jd: input.sourceJd?.slice(0, 20000) ?? null,
      default_target_proficiency: 3.5,
      created_by: g.isDev ? null : g.uid ?? null,
    })
    .select("id")
    .single();
  if (pErr || !profile) return { error: pErr?.message ?? "Could not create the role." };

  const rows = comps.map((c) => ({
    role_profile_id: profile.id as string,
    competency_id: c.competencyId,
    weight: Math.max(0.5, Math.min(10, c.weight || 1)),
    priority: c.priority,
    target_proficiency: Math.max(1, Math.min(5, c.target || 3.5)),
  }));
  let { error: cErr } = await sb.from("role_profile_competencies").insert(rows);
  // Tolerant of migration 00097 (target_proficiency) not applied: retry without it.
  if (cErr && (cErr.code === "42703" || cErr.code === "PGRST204")) {
    ({ error: cErr } = await sb
      .from("role_profile_competencies")
      .insert(rows.map(({ target_proficiency, ...r }) => { void target_proficiency; return r; })));
  }
  if (cErr) {
    await sb.from("role_profiles").delete().eq("id", profile.id);
    return { error: `Competencies: ${cErr.message}` };
  }

  revalidatePath("/ac/persona/roles");
  revalidatePath("/admin/role-profiles");
  return { ok: true, id: profile.id as string };
}
