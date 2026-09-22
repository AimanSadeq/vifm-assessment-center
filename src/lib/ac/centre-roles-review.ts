/**
 * Is this centre staffed by people competent to run it?
 *
 * BPS 5.22 requires the service provider to CONFIRM, before the centre starts,
 * that all centre staff have demonstrated competence against their role
 * profiles, and 6.2 says only staff deemed competent shall be used. 5.16 sets
 * the floor of one Centre Manager and one Centre Administrator, and 5.17 adds a
 * Psychometric Test User whenever tests are part of the process.
 *
 * Returns blocking problems and non-blocking cautions, the same shape as
 * reviewStaffing, so the engagement page and the activation gate can treat
 * both reviews identically.
 */

import { requiredCentreRoles, centreRoleName, type CentreRole } from "./centre-roles";

export type RoleAssignmentRow = {
  role_key: string;
  profile_id: string;
  is_external?: boolean | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

export type CompetenceRow = {
  profile_id: string;
  role_key: string;
  status: string;
  expires_on?: string | null;
};

export type CentreRolesReview = {
  required: CentreRole[];
  /** Roles with nobody in them. */
  unfilled: CentreRole[];
  /** People in a role without current competence for it. */
  uncertified: { roleKey: string; roleName: string; profileId: string; name: string; reason: string }[];
  blocking: string[];
  cautions: string[];
};

const nameOf = (r: RoleAssignmentRow) =>
  r.profiles?.full_name ?? r.profiles?.email ?? "Someone with no name on their profile";

/** Competent today: confirmed competent, and not lapsed. */
export function competenceIsCurrent(row: CompetenceRow | undefined, today = new Date()): boolean {
  if (!row) return false;
  if (row.status !== "competent") return false;
  if (!row.expires_on) return true;
  // A date-only column: compare as calendar dates, not instants, so a record
  // expiring today is still valid today wherever the reader is.
  const [y, m, d] = row.expires_on.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return true;
  const expiry = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  return expiry.getTime() >= Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

export function reviewCentreRoles(input: {
  purpose?: string | null;
  usesPsychometrics?: boolean;
  usesRolePlay?: boolean;
  usesFactFind?: boolean;
  assignments: RoleAssignmentRow[];
  competence: CompetenceRow[];
}): CentreRolesReview {
  const required = requiredCentreRoles(input);
  const byRole = new Map<string, RoleAssignmentRow[]>();
  for (const a of input.assignments) {
    const arr = byRole.get(a.role_key) ?? [];
    arr.push(a);
    byRole.set(a.role_key, arr);
  }
  const competenceBy = new Map<string, CompetenceRow>();
  for (const c of input.competence) competenceBy.set(`${c.profile_id}:${c.role_key}`, c);

  const unfilled = required.filter((r) => (byRole.get(r.key) ?? []).length === 0);

  const uncertified: CentreRolesReview["uncertified"] = [];
  for (const a of input.assignments) {
    const row = competenceBy.get(`${a.profile_id}:${a.role_key}`);
    if (competenceIsCurrent(row)) continue;
    uncertified.push({
      roleKey: a.role_key,
      roleName: centreRoleName(a.role_key),
      profileId: a.profile_id,
      name: nameOf(a),
      reason: !row
        ? "no competence record for this role"
        : row.status === "withdrawn"
          ? "competence withdrawn"
          : row.status === "in_training"
            ? "in training, not yet confirmed competent"
            : "competence has lapsed",
    });
  }

  const blocking: string[] = [];
  for (const r of unfilled) {
    blocking.push(`No ${r.name} has been assigned to this centre (${r.clause}).`);
  }
  for (const u of uncertified) {
    blocking.push(`${u.name} is assigned as ${u.roleName} but has ${u.reason} (5.22, 6.2).`);
  }

  const cautions: string[] = [];
  // One person doing everything satisfies the letter and worries the reader.
  const load = new Map<string, number>();
  for (const a of input.assignments) load.set(a.profile_id, (load.get(a.profile_id) ?? 0) + 1);
  for (const a of input.assignments) {
    if ((load.get(a.profile_id) ?? 0) >= 3 && !cautions.some((c) => c.startsWith(nameOf(a)))) {
      cautions.push(
        `${nameOf(a)} holds ${load.get(a.profile_id)} roles at this centre. Workable, but the Centre Manager cannot also be the one checking their own work.`
      );
    }
  }
  const externals = input.assignments.filter((a) => a.is_external);
  if (externals.length > 0) {
    cautions.push(
      `${externals.length} ${externals.length === 1 ? "person is" : "people are"} from outside VIFM. We remain responsible for their competence and must have given the client the specification for their role (3.12).`
    );
  }

  return { required, unfilled, uncertified, blocking, cautions };
}
