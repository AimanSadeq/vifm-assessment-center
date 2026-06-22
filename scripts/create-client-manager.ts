/**
 * Provision a client-manager login bound to one organization.
 *
 *   npx tsx scripts/create-client-manager.ts manager@client.com "Full Name" <organization_id>
 *   CM_PASSWORD='Chosen!Pass1' npx tsx scripts/create-client-manager.ts ...
 *
 * Creates (or reuses) the Supabase Auth user (email-confirmed) and upserts the
 * public.profiles row with role='client_manager' + organization_id. If no
 * CM_PASSWORD is given, a strong temp password is generated and printed once.
 * Refuses to modify an existing non-client_manager account. Uses the
 * service-role key - never expose in app code.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomBytes } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, serviceKey);

const email = (process.argv[2] ?? "").trim().toLowerCase();
const fullName = process.argv[3] ?? "Client Manager";
const organizationId = (process.argv[4] ?? "").trim();
const password = process.env.CM_PASSWORD ?? `${randomBytes(12).toString("base64url")}Aa1!`;
const generatedPassword = !process.env.CM_PASSWORD;

if (!email || !organizationId) {
  console.error('Usage: npx tsx scripts/create-client-manager.ts <email> "<Full Name>" <organization_id>');
  process.exit(1);
}

async function findUserIdByEmail(target: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`Provisioning client manager: ${email} (org ${organizationId})\n`);

  let userId = await findUserIdByEmail(email);
  if (userId) {
    console.log(`Auth user already exists - reusing ${userId} (password unchanged).`);
  } else {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (authError || !authUser?.user) {
      console.error("Failed to create auth user:", authError?.message ?? "unknown error");
      process.exit(1);
    }
    userId = authUser.user.id;
    console.log(`Auth user created: ${userId}`);
    if (generatedPassword) {
      console.log(`\n  TEMP PASSWORD (share securely, reset on first login): ${password}\n`);
    }
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (existing && (existing as { role: string }).role !== "client_manager") {
    console.error(`Refusing: email already belongs to a ${(existing as { role: string }).role} account.`);
    process.exit(1);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, role: "client_manager", full_name: fullName, email, organization_id: organizationId },
      { onConflict: "id" }
    );
  if (profileError) {
    console.error("Failed to upsert profile:", profileError.message);
    process.exit(1);
  }

  console.log("Client-manager profile is set.");
  console.log(`\n  Email: ${email}`);
  console.log("  Role:  client_manager");
  console.log(`  Org:   ${organizationId}`);
  console.log(`  ID:    ${userId}`);
  console.log("\nThey can log in at /login and reach /portal.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
