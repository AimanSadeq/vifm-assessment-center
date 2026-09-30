/**
 * Provision a client login (role = 'client') bound to one organization.
 *
 *   npx tsx scripts/create-client-login.ts client@client.com "Full Name" <organization_id>
 *   CLIENT_PASSWORD='Chosen!Pass1' npx tsx scripts/create-client-login.ts ...
 *
 * The 'client' role is the one that sees Assessment Center results: the
 * engagement list, released candidate reports and the decision makers'
 * guidance note at /client/engagements. It is distinct from 'client_manager',
 * which runs the self-service portal at /portal (vouchers, seats, the other
 * services) - see scripts/create-client-manager.ts for that one. The same
 * person can hold only one role, so a manager who also needs centre results
 * needs a second address.
 *
 * Creates (or reuses) the Supabase Auth user (email-confirmed) and upserts the
 * public.profiles row with role='client' + organization_id (the AC store's
 * organizations.id). If no CLIENT_PASSWORD is given, a strong temp password is
 * generated and printed once. Refuses to modify an existing account that holds
 * a different role. Uses the service-role key - never expose in app code.
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

const ROLE = "client";
const email = (process.argv[2] ?? "").trim().toLowerCase();
const fullName = process.argv[3] ?? "Client User";
const organizationId = (process.argv[4] ?? "").trim();
const password = process.env.CLIENT_PASSWORD ?? `${randomBytes(12).toString("base64url")}Aa1!`;
const generatedPassword = !process.env.CLIENT_PASSWORD;

if (!email || !organizationId) {
  console.error('Usage: npx tsx scripts/create-client-login.ts <email> "<Full Name>" <organization_id>');
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
  // The organisation has to exist in the AC store, or the login would be bound
  // to nothing and see an empty engagement list with no explanation.
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgError || !org) {
    console.error(`No organization with id ${organizationId} in the organizations table.`);
    process.exit(1);
  }
  console.log(`Provisioning client login: ${email} for ${org.name as string}\n`);

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
  if (existing && (existing as { role: string }).role !== ROLE) {
    console.error(`Refusing: email already belongs to a ${(existing as { role: string }).role} account.`);
    process.exit(1);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, role: ROLE, full_name: fullName, email, organization_id: organizationId }, { onConflict: "id" });
  if (profileError) {
    console.error("Failed to upsert profile:", profileError.message);
    process.exit(1);
  }

  console.log("Client profile is set.");
  console.log(`\n  Email: ${email}`);
  console.log(`  Role:  ${ROLE}`);
  console.log(`  Org:   ${org.name as string} (${organizationId})`);
  console.log(`  ID:    ${userId}`);
  console.log("\nThey can log in at /login and reach /client/engagements.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
