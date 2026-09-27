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

/** The role a sitting was scored against, frozen at start (00225
 *  behavioral_assessment_sessions.target_role_snapshot). Reports read this
 *  instead of the live profile, so editing or re-mapping a role profile later
 *  can never re-score a completed sitting. */
export type PersonaRoleSnapshot = PersonaRoleOption & { snapshotAt: string };

export async function snapshotPersonaRole(roleId: string | null | undefined): Promise<PersonaRoleSnapshot | null> {
  if (!roleId) return null;
  const role = await loadPersonaRoleById(roleId);
  return role ? { ...role, snapshotAt: new Date().toISOString() } : null;
}

/** Parse a stored snapshot defensively; anything malformed reads as absent. */
export function parsePersonaRoleSnapshot(raw: unknown): PersonaRoleOption | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; name?: unknown; comps?: unknown };
  if (typeof r.id !== "string" || !Array.isArray(r.comps)) return null;
  const comps = r.comps
    .filter((c): c is { competencyId: string; name?: string; target: number; weight?: number } =>
      !!c && typeof (c as { competencyId?: unknown }).competencyId === "string" && Number.isFinite(Number((c as { target?: unknown }).target)))
    .map((c) => ({
      competencyId: c.competencyId,
      name: typeof c.name === "string" ? c.name : "",
      target: Number(c.target),
      weight: Number.isFinite(Number(c.weight)) ? Number(c.weight) : 1,
    }));
  return { id: r.id, name: typeof r.name === "string" ? r.name : "Role profile", comps };
}

/** Frozen snapshots for a set of sessions (tolerant of 00225 not applied). */
export async function loadPersonaRoleSnapshots(sessionIds: string[]): Promise<Map<string, PersonaRoleOption>> {
  const out = new Map<string, PersonaRoleOption>();
  if (sessionIds.length === 0) return out;
  try {
    const sb = createServiceClient();
    for (let i = 0; i < sessionIds.length; i += 150) {
      const { data, error } = await sb
        .from("behavioral_assessment_sessions")
        .select("id, target_role_snapshot")
        .in("id", sessionIds.slice(i, i + 150))
        .not("target_role_snapshot", "is", null);
      if (error) return out;
      for (const row of (data ?? []) as Array<{ id: string; target_role_snapshot: unknown }>) {
        const snap = parsePersonaRoleSnapshot(row.target_role_snapshot);
        if (snap) out.set(row.id, snap);
      }
    }
  } catch {
    /* column absent - callers fall back to the live profile */
  }
  return out;
}
