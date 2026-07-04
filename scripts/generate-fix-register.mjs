/**
 * Fix Register generator.
 *
 * Reads the git commit history and writes a per-service changelog to
 *   src/data/fix-register.generated.json
 * which the admin page /admin/fix-register renders. Runs automatically before
 * every production build (npm "prebuild"), so the register refreshes on each
 * deploy - and can be run by hand any time with `npm run gen:fix-register`.
 *
 * Design notes:
 * - Pure git-derived (the chosen model). Each commit becomes an entry classified
 *   to a service by the files it touched + its message. Date = commit date,
 *   By = commit author. An optional `Requested-by:` trailer in the commit body
 *   is surfaced as the Requester (so future commits can record who asked).
 * - Tolerant: if git is unavailable at build time (no .git in the container),
 *   it leaves the committed JSON untouched instead of failing the build.
 * - No shell interpolation (execFileSync with an args array) so the %-format
 *   placeholders survive on Windows cmd.exe and Linux alike.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src", "data", "fix-register.generated.json");
const MAX_COMMITS = 600;

const US = "\x1f"; // unit separator (between fields)
const RS = "\x1e"; // record separator (between commits)

// ── Service classification. Order = display order. A commit is scored against
//    each service by how many of its changed files match `paths`, plus a bonus
//    when the subject/body hits a `kw` keyword; the top scorer wins. ──
const SERVICES = [
  { key: "persona", label: "Persona", blurb: "Behavioural self-assessment (shared AC / 360 framework).",
    paths: [/\/ac\/persona/, /scoring\/persona/, /\bpersona\b/i], kw: [/\bpersona\b/i] },
  { key: "arc", label: "AR Compass (ARC)", blurb: "AI Readiness Compass - organisation + individual readiness.",
    paths: [/\/ara\//, /lib\/ara\//, /\bara_/, /ara-/], kw: [/\bARC\b/, /AR Compass/i, /AI Readiness/i, /\bARA\b/] },
  { key: "techno", label: "Techno", blurb: "Technical certification - the credential-issuing module.",
    paths: [/tech-assessment/, /technical-/, /technical_/, /tech-sandbox/], kw: [/\btechno\b/i, /technical (certification|proficiency|assessment|program)/i] },
  { key: "fluent", label: "Fluent", blurb: "English placement (CEFR).",
    paths: [/\/ac\/fluent/, /eng_fluent/, /\bfluent\b/i], kw: [/\bfluent\b/i] },
  { key: "logica", label: "Logica (Cognitive)", blurb: "Cognitive ability + psychometrics.",
    paths: [/\/ac\/cognitive/, /psychometric/, /\bpsy_/, /\/cognitive/], kw: [/\blogica\b/i, /\bcognitive\b/i, /psychometric/i] },
  { key: "reflect", label: "Reflect 360", blurb: "360-degree leadership feedback.",
    paths: [/\/reflect\//, /reflect_/, /lib\/reflect\//], kw: [/reflect\s?360/i, /\breflect\b/i] },
  { key: "prehire", label: "Pre-Hire", blurb: "Commercial pre-employment screening.",
    paths: [/prehire/], kw: [/pre-?hire/i] },
  { key: "academy", label: "Academy & Credentials", blurb: "Course delivery + verifiable credentials.",
    paths: [/\/academy/, /credentials/, /vifm_credentials/, /\/verify\//], kw: [/\bacademy\b/i, /\bcredential/i] },
  { key: "courses", label: "Courses & Recommender", blurb: "Training catalogue + gap-driven recommender.",
    paths: [/\/admin\/courses/, /vifm_course/, /recommender/], kw: [/\bcourse/i, /recommender/i] },
  { key: "portal", label: "Client Portal & Bespoke", blurb: "Client self-service portal + bespoke bundles.",
    paths: [/\/portal/, /bespoke/, /client_manager/], kw: [/client portal/i, /\bbespoke\b/i] },
  { key: "platform", label: "Platform & Admin", blurb: "Auth, middleware, clients, cross-cutting admin.",
    paths: [/middleware/, /lib\/auth/, /lib\/clients/, /\/admin\//], kw: [/\bauth\b/i, /\bmiddleware\b/i, /\brls\b/i] },
];
const OTHER = { key: "other", label: "Other", blurb: "Uncategorised changes.", paths: [], kw: [] };

function classify(files, subject, body) {
  const text = `${subject}\n${body}`;
  let best = null;
  let bestScore = 0;
  for (const svc of SERVICES) {
    let score = 0;
    for (const f of files) for (const rx of svc.paths) if (rx.test(f)) score += 2;
    for (const rx of svc.kw) if (rx.test(text)) score += 3;
    if (score > bestScore) { bestScore = score; best = svc; }
  }
  return bestScore > 0 ? best : OTHER;
}

// ── Change type (for the badge). Derived from the message; best-effort. ──
function classifyType(subject, body) {
  const t = `${subject}\n${body}`;
  if (/\bcritical\b/i.test(t)) return "critical";
  if (/\b(security|leak|idor|replay|cross-tenant|vulnerab|hardening|lockdown)\b/i.test(t)) return "security";
  if (/\baudit\b/i.test(t)) return "audit";
  if (/\b(fix|bug|hotfix|patch|regression|correct)\b/i.test(t)) return "fix";
  if (/^(add|new|introduce|ship|implement|build|create|feat)/i.test(subject) || /\bfeature\b/i.test(t)) return "feature";
  return "change";
}

// Strip trailers/co-author lines from the body and pull out an optional
// `Requested-by:` value. Returns { explanation, requester }.
function parseBody(body) {
  let requester = null;
  const kept = [];
  for (const line of body.split("\n")) {
    const req = line.match(/^\s*requested[- ]by:\s*(.+)$/i);
    if (req) { requester = req[1].trim(); continue; }
    if (/^\s*co-authored-by:/i.test(line)) continue;
    if (/^\s*🤖\s*generated with/i.test(line)) continue;
    if (/claude\.com\/claude-code/i.test(line)) continue;
    kept.push(line);
  }
  const explanation = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { explanation, requester };
}

function readCommits() {
  const fmt = ["%H", "%h", "%an", "%ad", "%s", "%b"].join(US) + RS;
  const meta = execFileSync(
    "git",
    ["log", "--no-merges", "--date=short", `--pretty=format:${fmt}`, "-n", String(MAX_COMMITS)],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );

  // Files per commit, in a second pass. Format: RS + hash + US + newline + files.
  const fileRaw = execFileSync(
    "git",
    ["log", "--no-merges", "--name-only", `--pretty=format:${RS}%H${US}`, "-n", String(MAX_COMMITS)],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
  const filesByHash = new Map();
  for (const block of fileRaw.split(RS)) {
    if (!block.trim()) continue;
    const [head, ...rest] = block.split(US);
    const hash = head.trim();
    const files = rest.join(US).split("\n").map((s) => s.trim()).filter(Boolean);
    if (hash) filesByHash.set(hash, files);
  }

  const commits = [];
  for (const rec of meta.split(RS)) {
    if (!rec.trim()) continue;
    const [hash, short, author, date, subject, body = ""] = rec.split(US);
    if (!hash) continue;
    const files = filesByHash.get(hash.trim()) ?? [];
    const svc = classify(files, subject ?? "", body ?? "");
    const { explanation, requester } = parseBody(body ?? "");
    commits.push({
      hash: hash.trim(),
      short: (short ?? "").trim(),
      date: (date ?? "").trim(),
      author: (author ?? "").trim(),
      requester,
      type: classifyType(subject ?? "", body ?? ""),
      title: (subject ?? "").trim(),
      explanation,
      service: svc.key,
    });
  }
  return commits;
}

function build(commits) {
  const order = [...SERVICES, OTHER];
  const services = order
    .map((svc) => {
      const entries = commits
        .filter((c) => c.service === svc.key)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return { key: svc.key, label: svc.label, blurb: svc.blurb, count: entries.length, entries };
    })
    .filter((s) => s.count > 0);

  const latest = commits.reduce((m, c) => (c.date > m ? c.date : m), "");
  return {
    generatedAt: new Date().toISOString(),
    latestFixDate: latest,
    totalEntries: commits.length,
    serviceCount: services.length,
    services,
  };
}

try {
  const commits = readCommits();
  const data = build(commits);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`[fix-register] wrote ${data.totalEntries} entries across ${data.serviceCount} services -> ${OUT}`);
} catch (err) {
  // No .git at build time (or git failed): keep the committed JSON so the page
  // still renders the last snapshot rather than breaking the build.
  console.warn(`[fix-register] skipped generation: ${err instanceof Error ? err.message : err}`);
  process.exit(0);
}
