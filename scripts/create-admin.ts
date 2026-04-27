/**
 * Create admin user for VIFM Assessment Center.
 * Usage: npx tsx scripts/create-admin.ts admin@vifm.ae YourPassword123
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const email = "admin@viftraining.com";
  const password = "admin123";
  const fullName = process.argv[2] || "VIFM Administrator";

  console.log(`Creating admin user: ${email}\n`);

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  let userId: string;

  if (existing) {
    console.log("Auth user already exists, skipping creation.");
    userId = existing.id;
  } else {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      console.error("Failed to create auth user:", authError.message);
      process.exit(1);
    }

    userId = authUser.user.id;
    console.log("Auth user created:", userId);
  }

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    // Update role to admin if not already
    await supabase.from("profiles").update({ role: "admin", full_name: fullName }).eq("id", userId);
    console.log("Profile already exists, updated role to admin.");
  } else {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        role: "admin",
        full_name: fullName,
        email,
      });

    if (profileError) {
      console.error("Failed to create profile:", profileError.message);
      process.exit(1);
    }

    console.log("Admin profile created.");
  }

  console.log("\nAdmin user is ready!");
  console.log(`  Email: ${email}`);
  console.log(`  Role: admin`);
  console.log(`  ID: ${userId}`);
  console.log(`\nYou can now login at /login with these credentials.`);
}

main().catch(console.error);
