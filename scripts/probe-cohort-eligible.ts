import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb
    .from("ara_assessments")
    .select("id, engagement_stage, include_individual_layer, status")
    .eq("include_individual_layer", true)
    .neq("engagement_stage", "individual")
    .limit(5);
  console.log("Mode C assessments:");
  for (const a of data ?? []) console.log(`  ${a.id} stage=${a.engagement_stage} status=${a.status}`);
  if ((data ?? []).length === 0) console.log("  (none — cohort dashboard will show 404 for now)");
}
main().catch(console.error);
