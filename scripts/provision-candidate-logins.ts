/**
 * Provision candidate portal logins (go-live backfill).
 *
 * AC candidates need a real Supabase auth account to sign in (unlike Pre-Hire /
 * ARA, which are token-based). New candidate rows are created with
 * profile_id = NULL, so until they are provisioned a candidate cannot log in and
 * see their own report/skills/credentials. This script does the three steps:
 *   1. find-or-create the auth user (email pre-confirmed)
 *   2. upsert profiles(role='candidate')
 *   3. set candidates.profile_id on every row sharing that email
 * then prints a one-time set-password link per candidate (no Supabase email is
 * sent - share it, or use the in-app "Invite to portal" button which emails it).
 *
 * DRY-RUN BY DEFAULT - nothing is written without --apply.
 *
 *   npx tsx scripts/provision-candidate-logins.ts                 # dry-run, ALL candidate emails
 *   npx tsx scripts/provision-candidate-logins.ts --apply         # provision ALL
 *   npx tsx scripts/provision-candidate-logins.ts a@x.com b@y.com # dry-run only those
 *   npx tsx scripts/provision-candidate-logins.ts --apply a@x.com # provision only that one
 *
 * NOTE: the seeded demo candidates use throwaway @adnoc.ae addresses - do NOT
 * provision those (a set-password link would go to a real/!real external inbox).
 * Pass the specific real emails you want, or clean up seed rows first.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const site = process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com";
const sb = createClient(url, serviceKey);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const targetEmails = new Set(
  argv.filter((a) => !a.startsWith("--")).map((a) => a.trim().toLowerCase()),
);

type CandRow = {
  id: string;
  full_name: string;
  email: string | null;
  profile_id: string | null;
  organization_id: string | null;
};

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // Load candidates + their engagement org (for profiles.organization_id).
  const { data: rows, error } = await sb
    .from("candidates")
    .select("id, full_name, email, profile_id, engagements(organization_id)");
  if (error) throw new Error(error.message);

  const cands: CandRow[] = (rows ?? []).map((r: Record<string, unknown>) => {
    const eng = r.engagements as { organization_id: string | null } | { organization_id: string | null }[] | null;
    const organization_id = Array.isArray(eng) ? eng[0]?.organization_id ?? null : eng?.organization_id ?? null;
    return {
      id: r.id as string,
      full_name: r.full_name as string,
      email: (r.email as string | null) ?? null,
      profile_id: (r.profile_id as string | null) ?? null,
      organization_id,
    };
  });

  // Group by lowercased email.
  const groups = new Map<string, CandRow[]>();
  for (const c of cands) {
    if (!c.email) continue;
    const e = c.email.trim().toLowerCase();
    if (targetEmails.size > 0 && !targetEmails.has(e)) continue;
    if (!groups.has(e)) groups.set(e, []);
    groups.get(e)!.push(c);
  }

  if (groups.size === 0) {
    console.log("No matching candidate emails.");
    return;
  }

  console.log(`\n${APPLY ? "APPLYING" : "DRY-RUN"} - ${groups.size} candidate email(s)${targetEmails.size ? " (filtered)" : ""}\n`);

  for (const [email, rowsForEmail] of groups) {
    const fullName = rowsForEmail[0].full_name;
    const orgId = rowsForEmail.find((r) => r.organization_id)?.organization_id ?? null;
    const unlinked = rowsForEmail.filter((r) => !r.profile_id);
    const allLinked = unlinked.length === 0;

    if (allLinked) {
      console.log(`= ${email} (${fullName}): already linked on all ${rowsForEmail.length} row(s) - skip`);
      continue;
    }

    if (!APPLY) {
      const existing = await findUserIdByEmail(email);
      if (existing) {
        const { data: prof } = await sb
          .from("profiles")
          .select("role")
          .eq("id", existing)
          .maybeSingle<{ role: string }>();
        if (prof && prof.role !== "candidate") {
          console.log(`! ${email} (${fullName}): existing ${prof.role} account - WOULD SKIP (not downgrading / not linking)`);
          continue;
        }
      }
      console.log(
        `+ ${email} (${fullName}): ${existing ? "reuse auth user" : "CREATE auth user"} + profile(candidate) + link ${unlinked.length}/${rowsForEmail.length} row(s)`,
      );
      continue;
    }

    // ---- APPLY ----
    try {
      let userId = await findUserIdByEmail(email);
      let created = false;
      if (!userId) {
        const { data, error: cErr } = await sb.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (cErr || !data.user) throw new Error(cErr?.message ?? "createUser failed");
        userId = data.user.id;
        created = true;
      }

      const { data: prof } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle<{ role: string }>();
      if (prof && prof.role !== "candidate") {
        console.log(`! ${email}: existing ${prof.role} account - SKIPPED (not downgrading / not linking)`);
        continue;
      }

      const { error: pErr } = await sb.from("profiles").upsert(
        { id: userId, role: "candidate", full_name: fullName, email, ...(orgId ? { organization_id: orgId } : {}) },
        { onConflict: "id" },
      );
      if (pErr) {
        if (created) await sb.auth.admin.deleteUser(userId);
        throw new Error(pErr.message);
      }

      const ids = unlinked.map((r) => r.id);
      const { error: lErr } = await sb.from("candidates").update({ profile_id: userId }).in("id", ids);
      if (lErr) throw new Error(lErr.message);

      const { data: linkData } = await sb.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${site}/update-password` },
      });
      const link = linkData?.properties?.action_link ?? "(link generation failed - use the in-app invite)";

      console.log(`+ ${email} (${fullName}): ${created ? "created" : "reused"} user, linked ${ids.length} row(s)`);
      console.log(`    set-password link: ${link}`);
    } catch (e) {
      console.log(`x ${email}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (!APPLY) console.log("\n(dry-run) re-run with --apply to provision. Pass specific emails to limit scope.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
