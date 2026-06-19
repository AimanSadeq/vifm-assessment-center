/**
 * Seed the SDAIA demo: the client org (saudi / government) + the three pilot
 * voucher batches. Idempotent and DRY-RUN by default - it prints the plan and
 * issues nothing until you pass --apply.
 *
 *   npx tsx scripts/seed-sdaia-pilots.ts            # dry run (safe; no codes issued)
 *   npx tsx scripts/seed-sdaia-pilots.ts --apply    # actually issue the voucher codes
 *
 * Pilots (per PENDING-ACTIONS.md Priority 1):
 *   1 - Talent Acquisition : Persona, HIRING, SDAIA HR role profile, 2 codes
 *   2 - L&D                : Technical sandbox, L&D function (node 2.6), 20 codes
 *   3 - Succession         : Persona, DEVELOPMENT, 2 codes
 *
 * NOTE: Pilots 1+3 issue PERSONA codes and Pilot 2 issues a TECHNICAL code -
 * NOT ARC AI-Readiness questionnaire codes. Only the org row lives in
 * ara_organizations (saudi/government). Re-running skips any batch whose label
 * already exists, so it never double-issues.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { createClientOrganization } from "@/lib/clients/registry";
import { createVoucherBatch as createPersonaBatch } from "@/lib/persona/vouchers";
import { generateVoucherBatch as createTechBatch } from "@/lib/technical-sandbox/vouchers";

const APPLY = process.argv.includes("--apply");
const ROLE_PROFILE_NAME = "SDAIA - HR / Talent Acquisition Specialist";
const LD_FUNCTION_KEY = "learning_development";
const LABELS = {
  pilot1: "SDAIA Pilot 1 - Talent Acquisition",
  pilot2: "SDAIA Pilot 2 - L&D",
  pilot3: "SDAIA Pilot 3 - Succession",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

async function personaBatchExists(label: string): Promise<boolean> {
  const { data } = await sb.from("persona_vouchers").select("id").eq("label", label).limit(1);
  return (data ?? []).length > 0;
}
async function techBatchExists(label: string): Promise<boolean> {
  const { data } = await sb.from("technical_sandbox_vouchers").select("id").eq("label", label).limit(1);
  return (data ?? []).length > 0;
}

async function main() {
  console.log(`\nSDAIA pilot seed - ${APPLY ? "APPLY (issuing codes)" : "DRY RUN (no codes issued)"}\n`);

  // 1) SDAIA org (idempotent: createClientOrganization dedupes by name).
  const org = await createClientOrganization({
    name: "SDAIA",
    nameAr: "الهيئة السعودية للبيانات والذكاء الاصطناعي",
    region: "saudi",
    sector: "government",
  });
  if (!org.ok) {
    console.error("Could not ensure the SDAIA org:", org.error);
    process.exit(1);
  }
  console.log(`SDAIA org ready  (ac=${org.organizationId}  arc=${org.araOrganizationId})  region=saudi sector=government`);

  // 2) Resolve the Pilot 1 target role profile + the Pilot 2 L&D function.
  const { data: rp } = await sb.from("role_profiles").select("id, name_en").eq("name_en", ROLE_PROFILE_NAME).limit(1);
  const roleProfileId = (rp ?? [])[0]?.id ?? null;
  const { data: fn } = await sb.from("technical_functions").select("id, node_status").eq("key", LD_FUNCTION_KEY).limit(1);
  const ldFunctionId = (fn ?? [])[0]?.id ?? null;
  const ldActive = (fn ?? [])[0]?.node_status === "active";

  console.log(`Pilot 1 role profile: ${roleProfileId ? "found" : "MISSING (apply 00124)"}`);
  console.log(`Pilot 2 L&D function: ${ldFunctionId ? `found${ldActive ? " (active)" : " (INACTIVE - apply 00117)"}` : "MISSING (apply 00077)"}`);

  if (!APPLY) {
    console.log("\nDry run - would issue:");
    console.log(`  - ${LABELS.pilot1}: 2 Persona codes (hiring${roleProfileId ? ", role pinned" : ", NO role - will fall back to development"})`);
    console.log(`  - ${LABELS.pilot2}: 20 Technical codes (L&D function)`);
    console.log(`  - ${LABELS.pilot3}: 2 Persona codes (development)`);
    console.log("\nRe-run with --apply to issue. Existing batches (matched by label) are skipped.\n");
    return;
  }

  // 3) Pilot 1 - Persona hiring (falls back to development if the role is missing).
  if (await personaBatchExists(LABELS.pilot1)) {
    console.log(`Pilot 1: batch "${LABELS.pilot1}" already exists - skipping.`);
  } else {
    const res = await createPersonaBatch({
      count: 2,
      label: LABELS.pilot1,
      clientName: "SDAIA",
      organizationId: org.araOrganizationId,
      purpose: roleProfileId ? "hiring" : "development",
      targetRoleProfileId: roleProfileId,
      projectLabel: "SDAIA-TA",
    });
    console.log(res.ok ? `Pilot 1: ${res.codes.join(", ")}` : `Pilot 1 FAILED: ${res.error}`);
  }

  // 4) Pilot 2 - Technical L&D.
  if (!ldFunctionId) {
    console.log("Pilot 2: L&D function not found - skipping (apply 00077/00117).");
  } else if (await techBatchExists(LABELS.pilot2)) {
    console.log(`Pilot 2: batch "${LABELS.pilot2}" already exists - skipping.`);
  } else {
    const res = await createTechBatch({
      functionId: ldFunctionId,
      count: 20,
      organizationName: "SDAIA",
      label: LABELS.pilot2,
      talentLens: "development",
    });
    console.log(`Pilot 2: ${(res.codes ?? []).join(", ")}`);
  }

  // 5) Pilot 3 - Persona development (succession).
  if (await personaBatchExists(LABELS.pilot3)) {
    console.log(`Pilot 3: batch "${LABELS.pilot3}" already exists - skipping.`);
  } else {
    const res = await createPersonaBatch({
      count: 2,
      label: LABELS.pilot3,
      clientName: "SDAIA",
      organizationId: org.araOrganizationId,
      purpose: "development",
      projectLabel: "SDAIA-Succession",
    });
    console.log(res.ok ? `Pilot 3: ${res.codes.join(", ")}` : `Pilot 3 FAILED: ${res.error}`);
  }

  console.log("\nDone. Distribute the codes per pilot (or use the per-row Email actions in the admin UI).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
