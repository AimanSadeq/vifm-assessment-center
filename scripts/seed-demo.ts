/**
 * Seed the demo org (Najm Capital - Caliber Demo) with completed activity across
 * all services, so the client self-service portal shows populated funnels +
 * reviewable results. Idempotent (reuses the org, skips already-seeded services).
 * Run: npx tsx scripts/seed-demo.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

(async () => {
  const { seedDemoData } = await import("@/lib/demo/seed");
  const out = await seedDemoData();
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error("SEED ERROR:", e);
  process.exit(1);
});
