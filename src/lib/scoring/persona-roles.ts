// ─────────────────────────────────────────────────────────────
// Persona hiring fit - role profile loader (server, service-role read).
//
// Loads role profiles + their required competencies (target proficiency falling
// back to the role default, weight defaulting to 1) into the shape the runner's
// hiring picker and the report's fit computation both consume. Read-only,
// tolerant: returns [] on any error so the picker simply hides.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import type { RoleCompReq } from "./persona-fit";

export type PersonaRoleOption = { id: string; name: string; comps: RoleCompReq[] };

type ProfileRow = { id: string; name_en: string | null; default_target_proficiency: number | null };
type CompRow = {
  role_profile_id: string;
  competency_id: string;
  weight: number | null;
  target_proficiency: number | null;
};

/** All role profiles with their competency requirements (for the hiring picker). */
export async function loadPersonaRoleOptions(): Promise<PersonaRoleOption[]> {
  try {
    const sb = createServiceClient();
    const [{ data: profiles }, { data: comps }, { data: catalogue }] = await Promise.all([
      sb.from("role_profiles").select("id, name_en, default_target_proficiency").order("name_en"),
      sb.from("role_profile_competencies").select("role_profile_id, competency_id, weight, target_proficiency"),
      sb.from("competencies").select("id, name"),
    ]);
    if (!profiles || !comps) return [];
    const nameById = new Map<string, string>((catalogue ?? []).map((c) => [c.id as string, c.name as string]));
    const byProfile = new Map<string, CompRow[]>();
    for (const c of comps as CompRow[]) {
      if (!byProfile.has(c.role_profile_id)) byProfile.set(c.role_profile_id, []);
      byProfile.get(c.role_profile_id)!.push(c);
    }
    const out: PersonaRoleOption[] = [];
    for (const p of profiles as ProfileRow[]) {
      const rows = byProfile.get(p.id) ?? [];
      if (rows.length === 0) continue;
      const def = p.default_target_proficiency ?? 3;
      out.push({
        id: p.id,
        name: p.name_en ?? "Role profile",
        comps: rows.map((r) => ({
          competencyId: r.competency_id,
          name: nameById.get(r.competency_id) ?? "",
          target: r.target_proficiency ?? def,
          weight: r.weight ?? 1,
        })),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** One role profile's competency requirements (for the report's fit recompute). */
export async function loadPersonaRoleById(roleId: string): Promise<PersonaRoleOption | null> {
  const all = await loadPersonaRoleOptions();
  return all.find((r) => r.id === roleId) ?? null;
}
