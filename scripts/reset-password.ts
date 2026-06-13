/**
 * Reset (set) a Supabase user's password via the Admin API - no email, no redirect.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <newPassword>
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Also confirms the user's email so they can sign in immediately.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npx tsx scripts/reset-password.ts <email> <newPassword>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function findUserId(targetEmail: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) return undefined;
  }
}

async function main() {
  const userId = await findUserId(email);
  if (!userId) {
    console.error(`No auth user found with email ${email}`);
    process.exit(1);
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  console.log(`Password updated for ${email} (id ${userId}).`);
  console.log("You can now sign in at /login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
