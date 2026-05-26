/**
 * Captures the screenshots referenced from the two user guides
 * (docs/user-guide-ara.md and docs/user-guide-ac.md) by driving a
 * headless Chromium via Puppeteer against the local dev server.
 *
 * Run:
 *   npm run dev          # in one terminal
 *   npx tsx scripts/capture-user-guide-screenshots.ts
 *
 * The script:
 *   - Hits each URL listed in `SHOTS`
 *   - Captures a 1280x800 viewport screenshot to docs/images/{ara,ac}/
 *   - Tolerates pages that 404 or 500 (logs + moves on) so the script
 *     succeeds even with no seeded data
 *   - For URLs with `:id` / `:token` placeholders, tries to resolve a
 *     real id from Supabase via SUPABASE_SERVICE_ROLE_KEY; skips if no
 *     matching record exists
 *
 * Re-run any time the UI changes - the file names match the markdown's
 * image references exactly.
 */

import { config as loadEnv } from "dotenv";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const OUT_ARA = resolve(process.cwd(), "docs/images/ara");
const OUT_AC = resolve(process.cwd(), "docs/images/ac");

type Shot = {
  /** Output filename (relative to its module dir) - must match markdown ref */
  file: string;
  /** Module - picks the output folder */
  module: "ara" | "ac";
  /** URL path - supports `{assessmentId}`, `{respondentToken}`, `{candidateId}`,
   *   `{engagementId}`, `{quizAttemptId}` placeholders that get resolved at run-time. */
  path: string;
  /** Optional waitForSelector to ensure the page has rendered before snapping */
  waitFor?: string;
  /** Optional scrollY before snapping */
  scrollY?: number;
  /** Optional click - element text to find and click after navigation
   *   (used to switch Radix Tabs which are client-state, not URL-driven). */
  clickByText?: string;
};

const SHOTS: Shot[] = [
  // ── ARA - public ──────────────────────────────────────────
  { module: "ara", file: "01-landing.png",                path: "/ara" },
  { module: "ara", file: "10-consultant-dashboard.png",   path: "/ara/consultant" },
  { module: "ara", file: "11-organisations.png",          path: "/ara/admin/organizations" },
  { module: "ara", file: "12-new-assessment-step1.png",   path: "/ara/consultant/assessments/new" },
  { module: "ara", file: "13-new-assessment-step2.png",   path: "/ara/consultant/assessments/new?stage=department" },
  { module: "ara", file: "30-personal-start.png",         path: "/ara/personal/start" },
  { module: "ara", file: "40-admin-question-banks.png",   path: "/ara/admin/questions" },
  { module: "ara", file: "41-admin-regulatory.png",       path: "/ara/admin/regulatory" },

  // ── ARA - extra consultant-flow shots ────────────────────
  { module: "ara", file: "02-engage.png",                 path: "/ara/engage" },
  { module: "ara", file: "50-new-organization.png",       path: "/ara/admin/organizations/new" },
  { module: "ara", file: "53-personal-deep-dive-form.png", path: "/ara/consultant/personal-deep-dive/new" },

  // ── ARA - data-dependent (try to resolve a real record) ──
  { module: "ara", file: "51-assessment-overview-tab.png", path: "/ara/consultant/assessments/{assessmentId}" },
  { module: "ara", file: "14-respondents-tab.png",        path: "/ara/consultant/assessments/{assessmentId}",                clickByText: "Respondents" },
  { module: "ara", file: "16-phase2-tab.png",             path: "/ara/consultant/assessments/{assessmentId}",                clickByText: "Phase 2 notes" },
  { module: "ara", file: "52-phase2-guide-tab.png",       path: "/ara/consultant/assessments/{assessmentId}",                clickByText: "Phase 2 guide" },
  { module: "ara", file: "54-compliance-tab.png",         path: "/ara/consultant/assessments/{assessmentId}",                clickByText: "Compliance" },
  { module: "ara", file: "21-respondent-welcome.png",     path: "/ara/respond/{respondentToken}" },
  { module: "ara", file: "22-respondent-question.png",    path: "/ara/respond/{respondentToken}", scrollY: 400 },
  { module: "ara", file: "31-personal-results.png",       path: "/ara/personal/results/{personalResultsToken}" },

  // ── AC - public ───────────────────────────────────────────
  { module: "ac",  file: "01-admin-home.png",             path: "/admin" },
  { module: "ac",  file: "02-login.png",                  path: "/login" },
  { module: "ac",  file: "03-clients.png",                path: "/admin/clients" },
  { module: "ac",  file: "10-admin-portal.png",           path: "/admin/engagements" },
  { module: "ac",  file: "11-jd-extractor.png",           path: "/admin/engagements/new" },
  { module: "ac",  file: "14-admin-courses.png",          path: "/admin/courses" },
  { module: "ac",  file: "53-role-profiles.png",          path: "/admin/role-profiles" },
  { module: "ac",  file: "54-courses-import.png",         path: "/admin/courses/import" },

  // ── AC - data-dependent ──────────────────────────────────
  { module: "ac",  file: "12-engagement-detail.png",      path: "/admin/engagements/{engagementId}" },
  { module: "ac",  file: "50-engagement-assignments-tab.png", path: "/admin/engagements/{engagementId}",                  clickByText: "Assignments" },
  { module: "ac",  file: "51-engagement-matrix-tab.png",  path: "/admin/engagements/{engagementId}",                      clickByText: "Matrix" },
  { module: "ac",  file: "52-engagement-reports-tab.png", path: "/admin/engagements/{engagementId}",                      clickByText: "Reports" },
  { module: "ac",  file: "20-assessor-assignments.png",   path: "/assessor/assignments/{engagementId}" },
  { module: "ac",  file: "30-candidate-welcome.png",      path: "/candidate/welcome/{candidateId}" },
  { module: "ac",  file: "31-skills-dashboard.png",       path: "/candidate/skills/{candidateId}" },
  { module: "ac",  file: "40-client-engagements.png",     path: "/client/engagements" },
];

async function resolvePlaceholders(): Promise<Record<string, string | null>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("⚠️  Missing Supabase env - data-dependent shots will be skipped.");
    return {};
  }
  const sb = createClient(url, key);

  // ── ARA: any assessment for the org-side detail page ────────────
  const { data: araList } = await sb
    .from("ara_assessments")
    .select("id, engagement_stage, include_individual_layer, status")
    .order("created_at", { ascending: false })
    .limit(20);

  const assessmentId = araList?.find((a) => a.engagement_stage !== "individual")?.id
    ?? araList?.[0]?.id ?? null;

  // ── ARA respondent token for the survey form (any assessment) ───
  const { data: anyRespondent } = await sb
    .from("ara_respondents")
    .select("access_token")
    .order("created_at", { ascending: false })
    .limit(1);
  const respondentToken = anyRespondent?.[0]?.access_token ?? null;

  // ── ARA personal-eligible respondent token: the results page only
  //    resolves for engagement_stage='individual' OR include_individual_layer=true.
  const eligibleAssessmentIds = (araList ?? [])
    .filter((a) => a.engagement_stage === "individual" || a.include_individual_layer)
    .map((a) => a.id);

  let personalResultsToken: string | null = null;
  if (eligibleAssessmentIds.length > 0) {
    const { data: rs } = await sb
      .from("ara_respondents")
      .select("access_token")
      .in("assessment_id", eligibleAssessmentIds)
      .limit(1);
    personalResultsToken = rs?.[0]?.access_token ?? null;
  }

  // ── AC: prefer a non-draft engagement so the detail page has data
  //    ready to render (drafts may notFound() if mid-wizard state).
  const { data: engs } = await sb
    .from("engagements")
    .select("id, status")
    .order("created_at", { ascending: false })
    .limit(20);
  const engagementId = engs?.find((e) => e.status !== "draft")?.id
    ?? engs?.[0]?.id ?? null;

  // ── AC candidate (any) ─────────────────────────────────────────
  const { data: candidates } = await sb
    .from("candidates")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);
  const candidateId = candidates?.[0]?.id ?? null;

  return {
    "{assessmentId}":           assessmentId,
    "{respondentToken}":        respondentToken,
    "{personalResultsToken}":   personalResultsToken,
    "{engagementId}":           engagementId,
    "{candidateId}":            candidateId,
  };
}

async function captureOne(browser: Browser, shot: Shot, placeholders: Record<string, string | null>): Promise<"ok" | "skip" | "fail"> {
  let path = shot.path;
  for (const [k, v] of Object.entries(placeholders)) {
    if (path.includes(k)) {
      if (!v) return "skip";
      path = path.replaceAll(k, v);
    }
  }
  const url = `${BASE}${path}`;
  const outDir = shot.module === "ara" ? OUT_ARA : OUT_AC;
  const outFile = resolve(outDir, shot.file);

  // Fresh page per shot - isolates failures so a hung/crashed page can't
  // cascade-detach subsequent shots. Slightly slower but much more robust.
  const page: Page = await browser.newPage();
  try {
    await page.setViewport(VIEWPORT);
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    if (!resp || !resp.ok()) {
      console.warn(`  ✗ ${shot.module}/${shot.file} - ${resp?.status() ?? "no response"} for ${url}`);
      return "fail";
    }
    if (shot.waitFor) {
      await page.waitForSelector(shot.waitFor, { timeout: 5_000 }).catch(() => {});
    }
    if (shot.clickByText) {
      // Find the element by text content (typically a Radix TabsTrigger
      // <button role="tab"> with the given label) and click via
      // Puppeteer's mouse so the pointer events fire - bare HTMLElement
      // .click() doesn't trigger Radix's internal pointerdown listeners.
      const handle = await page.evaluateHandle((needle: string) => {
        const candidates = Array.from(
          document.querySelectorAll('button, [role="tab"], a')
        ) as HTMLElement[];
        // Prefer exact match, then startsWith - handles tab labels with
        // appended counts like "Assignments (9)". Inline trim() rather
        // than a helper because tsx transpilation injects __name() calls
        // into the helper that don't exist in the browser eval context.
        let exact = null as HTMLElement | null;
        let prefix = null as HTMLElement | null;
        for (const c of candidates) {
          const t = (c.textContent ?? "").trim();
          if (t === needle) { exact = c; break; }
          if (!prefix && t.startsWith(needle + " ")) prefix = c;
        }
        return exact ?? prefix;
      }, shot.clickByText);
      const el = handle.asElement();
      if (el) {
        await (el as import("puppeteer").ElementHandle<HTMLElement>).click();
      } else {
        console.warn(`    (clickByText: "${shot.clickByText}" not found on page)`);
      }
      await handle.dispose();
      // Tab content render + any animation settle.
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (shot.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
      await new Promise((r) => setTimeout(r, 400));
    }
    // Light delay so any client-side animation settles.
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: outFile as `${string}.png`, type: "png", fullPage: false });
    console.log(`  ✓ ${shot.module}/${shot.file}`);
    return "ok";
  } catch (e) {
    console.warn(`  ✗ ${shot.module}/${shot.file} - ${e instanceof Error ? e.message : String(e)}`);
    return "fail";
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  await Promise.all([mkdir(OUT_ARA, { recursive: true }), mkdir(OUT_AC, { recursive: true })]);

  console.log("Resolving data-dependent placeholders…");
  const placeholders = await resolvePlaceholders();
  for (const [k, v] of Object.entries(placeholders)) {
    console.log(`  ${k}  →  ${v ?? "<not found>"}`);
  }

  console.log("\nLaunching headless Chromium…");
  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  // Dev-bypass login. Pages that read data via the auth-aware Supabase
  // client (createClient, not service-role) are RLS-gated, so we sign in
  // as the admin dev user via the /login page. The resulting Supabase
  // session cookie persists on the browser instance for every later
  // newPage(). The seed admin is admin@viftraining.com / admin123. If
  // that user doesn't exist, sign-in silently fails and detail-page
  // shots 404 - already-captured pages stay valid either way.
  console.log("\nAttempting dev-bypass admin login…");
  const loginPage = await browser.newPage();
  await loginPage.setViewport(VIEWPORT);
  try {
    await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30_000 });
    // Use the manual email+password form - more deterministic than
    // driving the role-dropdown + Quick Login button.
    await loginPage.waitForSelector("input#email", { timeout: 10_000 });
    await loginPage.type("input#email", "admin@viftraining.com");
    await loginPage.type("input#password", "admin123");
    // Submit the form (form's onSubmit triggers handleLogin which
    // signInWithPassword + role-routes to /admin).
    await Promise.all([
      loginPage.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 }).catch(() => {}),
      loginPage.evaluate(() => {
        const form = document.querySelector("form");
        form?.requestSubmit();
      }),
    ]);
    // Poll briefly in case the navigation event raced with the redirect
    for (let i = 0; i < 10; i++) {
      if (!loginPage.url().includes("/login")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const currentUrl = loginPage.url();
    if (currentUrl.includes("/login")) {
      console.warn(`  ⚠ Login may have failed - still at ${new URL(currentUrl).pathname}. Detail-page shots will probably 404.`);
    } else {
      console.log(`  ✓ Logged in (now at ${new URL(currentUrl).pathname})`);
    }
  } catch (e) {
    console.warn(`  ⚠ Login error: ${e instanceof Error ? e.message : e}. Continuing without auth.`);
  } finally {
    await loginPage.close().catch(() => {});
  }

  let ok = 0, skip = 0, fail = 0;
  for (const shot of SHOTS) {
    const r = await captureOne(browser, shot, placeholders);
    if (r === "ok") ok++;
    else if (r === "skip") skip++;
    else fail++;
  }

  await browser.close();
  console.log(`\n${ok} captured, ${skip} skipped (no data), ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
