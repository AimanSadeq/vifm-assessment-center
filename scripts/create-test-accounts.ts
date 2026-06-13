/**
 * Create test accounts for all non-admin user_role values.
 * Run: npx tsx scripts/create-test-accounts.ts
 *
 * Creates:
 * - consultant@viftraining.com (consultant)
 * - assessor@viftraining.com (lead_assessor)
 * - associate@viftraining.com (associate_assessor)
 * - candidate@viftraining.com (candidate)
 * - client@viftraining.com (client, linked to ADNOC Group org)
 *
 * All with password: admin123
 * Admin account (admin@viftraining.com) is created by scripts/create-admin.ts.
 *
 * These are the accounts the login page's quick-login dropdown signs in as.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * pointing at the real Supabase project.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PASSWORD = "admin123";

async function createUser(email: string, fullName: string, role: string, organizationId?: string) {
  // Check if already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`  ↳ Auth user exists: ${userId}`);
  } else {
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`Auth ${email}: ${error.message}`);
    userId = authUser.user.id;
    console.log(`  ↳ Auth user created: ${userId}`);
  }

  // Upsert profile
  const profileData: Record<string, unknown> = {
    id: userId,
    role,
    full_name: fullName,
    email,
  };
  if (organizationId) profileData.organization_id = organizationId;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    await supabase.from("profiles").update({ role, full_name: fullName, ...(organizationId ? { organization_id: organizationId } : {}) }).eq("id", userId);
    console.log(`  ↳ Profile updated: ${role}`);
  } else {
    const { error: profErr } = await supabase.from("profiles").insert(profileData);
    if (profErr) throw new Error(`Profile ${email}: ${profErr.message}`);
    console.log(`  ↳ Profile created: ${role}`);
  }

  return userId;
}

async function main() {
  console.log("Creating test accounts (all passwords: admin123)\n");

  // Get ADNOC org for client account
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", "ADNOC Group")
    .maybeSingle();

  // 1. Consultant (ARA)
  console.log("1. consultant@viftraining.com (consultant)");
  await createUser("consultant@viftraining.com", "Layla Al Hashimi", "consultant");

  // 2. Lead Assessor
  console.log("\n2. assessor@viftraining.com (lead_assessor)");
  await createUser("assessor@viftraining.com", "Dr. Sarah Al Ameri", "lead_assessor");

  // 3. Associate Assessor
  console.log("\n3. associate@viftraining.com (associate_assessor)");
  await createUser("associate@viftraining.com", "Omar Al Suwaidi", "associate_assessor");

  // 4. Candidate
  console.log("\n4. candidate@viftraining.com (candidate)");
  await createUser("candidate@viftraining.com", "Ahmed Al Mansoori", "candidate");

  // 5. Client
  console.log("\n5. client@viftraining.com (client)");
  await createUser("client@viftraining.com", "Mohammed Al Jaber", "client", org?.id);

  console.log("\n✅ All test accounts ready!");
  console.log("\nLogin credentials:");
  console.log("  admin@viftraining.com      / admin123  → /          (full access to all portals)");
  console.log("  consultant@viftraining.com / admin123  → /ara/consultant");
  console.log("  assessor@viftraining.com   / admin123  → /assessor  (lead_assessor)");
  console.log("  associate@viftraining.com  / admin123  → /assessor  (associate_assessor)");
  console.log("  candidate@viftraining.com  / admin123  → /candidate");
  console.log("  client@viftraining.com     / admin123  → /client");
}

main().catch(console.error);
