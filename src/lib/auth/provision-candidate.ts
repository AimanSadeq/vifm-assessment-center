import { createServiceClient } from "@/lib/supabase/server";

/**
 * Candidate login provisioning.
 *
 * AC candidates need a REAL Supabase auth account (unlike Pre-Hire / ARA
 * respondents, which are token-based). This wires the three pieces that make a
 * candidate able to sign in and see their own portal:
 *   1. an auth.users row (find-or-create, email pre-confirmed)
 *   2. a profiles row with role='candidate' (no auto-create trigger exists)
 *   3. candidates.profile_id set on EVERY candidate row sharing that email
 *      (one person can appear across several engagements)
 *
 * Mirrors the battle-tested addDemoAssessorAction pattern (auth.admin.createUser
 * -> profiles upsert -> cleanup-on-fail), generalised + made idempotent.
 *
 * Safety rail: if the email already belongs to a profile with a DIFFERENT role
 * (e.g. an admin who also happens to sit in a candidate row), we DO NOT
 * downgrade the role and DO NOT link - we return { roleMismatch } so the caller
 * can warn. This prevents the "admin becomes a candidate" trap.
 */
export type ProvisionResult = {
  ok: boolean;
  error?: string;
  userId?: string;
  /** auth user was newly created (vs reused) */
  created?: boolean;
  /** a profiles row already existed for this user */
  alreadyHadProfile?: boolean;
  /** how many candidate rows got profile_id set by this call */
  linkedCandidateCount?: number;
  /** existing profile had a non-candidate role; left untouched, nothing linked */
  roleMismatch?: boolean;
  existingRole?: string;
};

async function findUserIdByEmail(
  sb: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function provisionCandidateLogin(opts: {
  email: string;
  fullName: string;
  organizationId?: string | null;
}): Promise<ProvisionResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "email required" };
  const sb = createServiceClient();

  // 1. find-or-create the auth user
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(sb, email);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "listUsers failed" };
  }

  let created = false;
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: opts.fullName },
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "createUser failed" };
    }
    userId = data.user.id;
    created = true;
  }

  // 2. respect an existing non-candidate role (do not downgrade an admin etc.)
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();

  if (existingProfile && existingProfile.role !== "candidate") {
    return {
      ok: false,
      roleMismatch: true,
      existingRole: existingProfile.role,
      userId,
      created,
      error: `email already belongs to a ${existingProfile.role} account; not modifying`,
    };
  }

  // 3. upsert the candidate profile
  const { error: profErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      role: "candidate",
      full_name: opts.fullName,
      email,
      ...(opts.organizationId ? { organization_id: opts.organizationId } : {}),
    },
    { onConflict: "id" },
  );
  if (profErr) {
    if (created) await sb.auth.admin.deleteUser(userId);
    return { ok: false, error: profErr.message, userId, created };
  }

  // 4. link every still-unlinked candidate row that shares this email.
  //    Fetch + JS-filter (not ilike) so a literal "_"/"%" in a local-part
  //    can't act as a SQL wildcard and over-match.
  const { data: candRows, error: readErr } = await sb
    .from("candidates")
    .select("id, email")
    .is("profile_id", null);
  if (readErr) return { ok: false, error: readErr.message, userId, created };

  const ids = (candRows ?? [])
    .filter((c) => ((c.email as string | null) ?? "").trim().toLowerCase() === email)
    .map((c) => c.id as string);

  let linkedCandidateCount = 0;
  if (ids.length > 0) {
    const { data: linked, error: linkErr } = await sb
      .from("candidates")
      .update({ profile_id: userId })
      .in("id", ids)
      .select("id");
    if (linkErr) return { ok: false, error: linkErr.message, userId, created };
    linkedCandidateCount = linked?.length ?? 0;
  }

  return {
    ok: true,
    userId,
    created,
    alreadyHadProfile: !!existingProfile,
    linkedCandidateCount,
  };
}

/**
 * Generate a one-time set-password / sign-in link (no Supabase email is sent;
 * we deliver it ourselves via Microsoft Graph). Lands the candidate on
 * /update-password to choose their password, after which they reach /candidate.
 */
export async function generateCandidateSetupLink(email: string): Promise<string | null> {
  const sb = createServiceClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com";
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: { redirectTo: `${site}/update-password` },
  });
  if (error) return null;
  return data.properties?.action_link ?? null;
}
