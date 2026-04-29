import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("\n=== ARA assessments ===");
  const { data: ara } = await sb
    .from("ara_assessments")
    .select("id, engagement_stage, include_individual_layer, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const a of ara ?? []) {
    console.log(
      `  ${a.id.slice(0, 8)} stage=${a.engagement_stage} layer=${a.include_individual_layer ?? false} status=${a.status}`
    );
  }

  console.log("\n=== ARA respondents on individual-stage or layer-on assessments ===");
  const personalEligible = (ara ?? []).filter(
    (a) => a.engagement_stage === "individual" || a.include_individual_layer
  );
  if (personalEligible.length === 0) {
    console.log("  none");
  } else {
    const { data: rs } = await sb
      .from("ara_respondents")
      .select("id, access_token, name, completed_at, assessment_id")
      .in("assessment_id", personalEligible.map((a) => a.id))
      .limit(5);
    for (const r of rs ?? []) {
      console.log(`  token=${r.access_token?.slice(0, 12) ?? "(null)"} name=${r.name} completed=${!!r.completed_at}`);
    }
  }

  console.log("\n=== AC engagements ===");
  const { data: engs } = await sb
    .from("engagements")
    .select("id, name, status, organization_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const e of engs ?? []) {
    console.log(`  ${e.id.slice(0, 8)} name=${e.name} status=${e.status}`);
  }

  console.log("\n=== AC candidates ===");
  const { data: cands } = await sb
    .from("candidates")
    .select("id, name, engagement_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const c of cands ?? []) {
    console.log(`  ${c.id.slice(0, 8)} name=${c.name} eng=${c.engagement_id?.slice(0, 8) ?? "(null)"}`);
  }
}
main().catch(console.error);
