import { createServiceClient } from "@/lib/supabase/server";

/**
 * Client-manager login provisioning. A client manager is a VIFM-provisioned
 * account bound to ONE organization that runs that org's self-service portal.
 * Mirrors provisionCandidateLogin but: role='client_manager', organizationId is
 * REQUIRED, and the same safety rail refuses to downgrade an existing non-
 * client_manager account (so an admin can never be turned into a client manager).
 */
export type ProvisionClientManagerResult = {
  ok: boolean;
  error?: string;
  userId?: string;
  created?: boolean;
  roleMismatch?: boolean;
  existingRole?: string;
};

async function findUserIdByEmail(
  sb: ReturnType<typeof createServiceClient>,
  email: string
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

export async function provisionClientManagerLogin(opts: {
  email: string;
  fullName: string;
  organizationId: string;
}): Promise<ProvisionClientManagerResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "email required" };
  if (!opts.organizationId) return { ok: false, error: "organizationId required" };
  const sb = createServiceClient();

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
    if (error || !data.user) return { ok: false, error: error?.message ?? "createUser failed" };
    userId = data.user.id;
    created = true;
  }

  // Respect an existing non-client_manager role (do not downgrade an admin etc.).
  const { data: existing } = await sb
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();
  if (existing && existing.role !== "client_manager") {
    return {
      ok: false,
      roleMismatch: true,
      existingRole: existing.role,
      userId,
      created,
      error: `email already belongs to a ${existing.role} account; not modifying`,
    };
  }

  const { error: profErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      role: "client_manager",
      full_name: opts.fullName,
      email,
      organization_id: opts.organizationId,
    },
    { onConflict: "id" }
  );
  if (profErr) {
    if (created) await sb.auth.admin.deleteUser(userId);
    return { ok: false, error: profErr.message, userId, created };
  }

  return { ok: true, userId, created };
}
