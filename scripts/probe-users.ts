import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { users } } = await sb.auth.admin.listUsers();
  console.log("auth.users:");
  for (const u of users.slice(0, 10)) console.log(`  ${u.email} id=${u.id.slice(0,8)}`);
  const { data: profs } = await sb.from("profiles").select("id, email, role, full_name").limit(10);
  console.log("\nprofiles:");
  for (const p of profs ?? []) console.log(`  ${p.email} role=${p.role} name=${p.full_name}`);
}
main().catch(console.error);
