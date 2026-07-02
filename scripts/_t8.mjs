// Repro: inductive-only voucher -> start -> submit answers -> does score fail?
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: v } = await sb.from("cognitive_vouchers").insert({ code: "VIFM-COG-TEST-SCOR", label: "_score-test", subtests: ["inductive"], max_uses: 1 }).select("id").single();
const { data: red } = await sb.from("cognitive_voucher_redemptions").insert({ voucher_id: v.id, redeemer_name: "Score Test", redeemer_email: "score@test.local", company_name: "T" }).select("redemption_token").single();

const start = await fetch("http://localhost:3000/api/ac/cognitive", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "start", language: "en", subtests: ["inductive"], redemptionToken: red.redemption_token }) });
const s = await start.json();
console.log("start:", start.status, "items:", s.test?.items?.length, "scales:", JSON.stringify([...new Set((s.test?.items??[]).map(i=>i.scale))]));

// answer everything with option 0
const answers = {};
for (const it of s.test.items) answers[it.id] = 0;
const score = await fetch("http://localhost:3000/api/ac/cognitive", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "score", session_id: s.session_id, answers, language: "en", takerName: "Score Test", redemptionToken: red.redemption_token }) });
const d = await score.json().catch(() => null);
console.log("score:", score.status, JSON.stringify(d)?.slice(0, 400));

// cleanup
if (d?.result_id) await sb.from("psy_item_responses").delete().eq("result_id", d.result_id);
if (d?.result_id) await sb.from("psy_results").delete().eq("id", d.result_id);
await sb.from("psy_sessions").delete().eq("id", s.session_id);
await sb.from("cognitive_voucher_redemptions").delete().eq("voucher_id", v.id);
await sb.from("cognitive_vouchers").delete().eq("id", v.id);
console.log("cleaned");
