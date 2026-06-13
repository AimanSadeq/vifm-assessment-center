/**
 * Generate a password-recovery link WITHOUT sending an email (no rate limit).
 *
 * Usage:
 *   npx tsx scripts/recovery-link.ts <email>
 *
 * Prints a URL to paste into your browser. It lands on /update-password where
 * you set the new password. Reads NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY (and optional NEXT_PUBLIC_SITE_URL) from .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/recovery-link.ts <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const site = process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com";
const supabase = createClient(url, serviceKey);

async function main() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${site}/update-password` },
  });
  if (error) throw new Error(error.message);
  console.log("\nPaste this URL into your browser (no email needed):\n");
  console.log(data.properties?.action_link);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
