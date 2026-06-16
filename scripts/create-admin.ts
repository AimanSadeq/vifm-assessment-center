/**
 * Create (or promote) an admin user for the VIFM Assessment Center.
 *
 *   npx tsx scripts/create-admin.ts
 *   npx tsx scripts/create-admin.ts someone@viftraining.com "Full Name"
 *   ADMIN_PASSWORD='Chosen!Pass1' npx tsx scripts/create-admin.ts
 *
 * Defaults to ahmad.rashid@viftraining.com. Auth is ENABLED, so this does BOTH
 * required steps:
 *   1. Create the Supabase Auth user (email-confirmed). If no ADMIN_PASSWORD is
 *      given, a strong random temp password is generated and printed once -
 *      share it securely and have them reset it on first login. Existing users
 *      are reused (password left unchanged), not duplicated.
 *   2. Upsert the matching public.profiles row with role = 'admin' (there is no
 *      auto-profile trigger, so this row is mandatory).
 *
 * Uses the service-role key (admin API) - never expose this in app code.
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

const email = (process.env.ADMIN_EMAIL ?? process.argv[2] ?? "ahmad.rashid@viftraining.com").trim().toLowerCase();
const fullName = process.env.ADMIN_NAME ?? process.argv[3] ?? "Ahmad Rashid";
const password = process.env.ADMIN_PASSWORD ?? `${randomBytes(12).toString("base64url")}Aa1!`;
const generatedPassword = !process.env.ADMIN_PASSWORD;

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
  console.log(`Creating / promoting admin: ${email}\n`);

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

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, role: "admin", full_name: fullName, email }, { onConflict: "id" });
  if (profileError) {
    console.error("Failed to upsert profile:", profileError.message);
    process.exit(1);
  }

  console.log("Admin profile is set.");
  console.log(`\n  Email: ${email}`);
  console.log("  Role:  admin");
  console.log(`  ID:    ${userId}`);
  console.log("\nThey can now log in at /login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
