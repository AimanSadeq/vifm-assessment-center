/**
 * Builds Word (.docx) versions of the two user guides:
 *
 *   docs/user-guide-ara.md  →  docs/VIFM-User-Guide-ARA.docx
 *   docs/user-guide-ac.md   →  docs/VIFM-User-Guide-AC.docx
 *
 * Mermaid roadmap diagrams (the ```mermaid fenced blocks at the top of
 * each guide) are pre-rendered to PNG via mermaid-cli (mmdc) and the
 * fences are replaced with image refs before pandoc is invoked. Pandoc
 * then carries the screenshots and the diagram PNGs into the docx.
 *
 * Run:
 *   npx tsx scripts/build-word-guides.ts
 *
 * Requires:
 *   - pandoc on PATH (winget install JohnMacFarlane.Pandoc)
 *   - @mermaid-js/mermaid-cli installed locally (already in devDeps)
 *
 * Output is committed alongside the markdown so non-developer recipients
 * (consultants, clients, training delegates) can open and read the
 * guides without a markdown viewer.
 */

import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

const execFile = promisify(execFileCb);

type GuideJob = {
  src: string;             // path to .md
  outDocx: string;         // path to .docx
  imageDir: string;        // where roadmap PNGs go
  diagramPrefix: string;   // PNG file basename prefix (e.g., "roadmap-consultant")
};

const ROOT = process.cwd();
const isWin = process.platform === "win32";
// Call mmdc's CLI script directly via `node` instead of the .bin shim
// because Node.js's execFile can't run Windows .cmd batch files without
// going through a shell (raises EINVAL). The cli.js entry is the same
// script the .cmd shim ultimately runs anyway.
const MMDC_CLI = resolve(ROOT, "node_modules/@mermaid-js/mermaid-cli/src/cli.js");

// Pandoc has to be resolved explicitly so we can call it via execFile
// without going through a shell. winget on Windows actually installs it
// under %LOCALAPPDATA%\Pandoc\pandoc.exe (not the WinGet/Links shim
// path) — surfaced by `Get-Command pandoc` in PowerShell after install.
function resolvePandoc(): string {
  if (!isWin) return "pandoc";
  const localApp = process.env.LOCALAPPDATA;
  const candidates: string[] = [];
  if (localApp) {
    candidates.push(resolve(localApp, "Pandoc/pandoc.exe"));
    candidates.push(resolve(localApp, "Microsoft/WinGet/Links/pandoc.exe"));
  }
  candidates.push("C:/Program Files/Pandoc/pandoc.exe");
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fall back to bare 'pandoc' and hope it's on PATH.
  return "pandoc";
}
const PANDOC = resolvePandoc();

const JOBS: GuideJob[] = [
  {
    src: resolve(ROOT, "docs/user-guide-ara.md"),
    outDocx: resolve(ROOT, "docs/VIFM-User-Guide-ARA.docx"),
    imageDir: resolve(ROOT, "docs/images/ara"),
    diagramPrefix: "roadmap",
  },
  {
    src: resolve(ROOT, "docs/user-guide-ac.md"),
    outDocx: resolve(ROOT, "docs/VIFM-User-Guide-AC.docx"),
    imageDir: resolve(ROOT, "docs/images/ac"),
    diagramPrefix: "roadmap",
  },
];

// VIFM brand-aligned mermaid theme. Inline as a config block in each
// .mmd source so mmdc honours it without needing a JSON config file.
const MERMAID_INIT = `%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#5391D5",
    "primaryTextColor": "#010131",
    "primaryBorderColor": "#010131",
    "lineColor": "#5391D5",
    "secondaryColor": "#FEFFF9",
    "tertiaryColor": "#f3f4f6",
    "fontFamily": "Open Sans, Helvetica, Arial, sans-serif"
  }
}}%%
`;

async function renderMermaidBlock(body: string, outPath: string): Promise<void> {
  const src = `${MERMAID_INIT}\n${body}`;
  const tmpMmd = outPath.replace(/\.png$/, ".mmd");
  await writeFile(tmpMmd, src, "utf8");
  // node + the cli.js entry; bypass the .bin shim (see MMDC_CLI comment).
  await execFile(process.execPath, [
    MMDC_CLI,
    "-i", tmpMmd,
    "-o", outPath,
    "-b", "white",
    "-w", "1400",
  ]);
  await rm(tmpMmd, { force: true });
}

async function preprocessMarkdown(job: GuideJob): Promise<{ tmpMd: string; renderedCount: number }> {
  const md = await readFile(job.src, "utf8");
  await mkdir(job.imageDir, { recursive: true });

  const re = /```mermaid\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let counter = 0;
  let out = md;
  type Replacement = { fullMatch: string; pngFile: string; alt: string };
  const repls: Replacement[] = [];
  while ((match = re.exec(md)) !== null) {
    counter += 1;
    const body = match[1].trim();
    const firstLine = body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("%%") && !l.startsWith("flowchart") && !l.startsWith("graph"))
      ?? `Roadmap ${counter}`;
    const alt = `Roadmap diagram ${counter}: ${firstLine.slice(0, 80)}`;
    const pngFile = `${job.diagramPrefix}-${counter}.png`;
    const pngPath = resolve(job.imageDir, pngFile);
    repls.push({ fullMatch: match[0], pngFile, alt });

    process.stdout.write(`  rendering mermaid #${counter} → ${pngFile} … `);
    await renderMermaidBlock(body, pngPath);
    process.stdout.write("ok\n");
  }

  const moduleSlug = job.src.includes("ara") ? "ara" : "ac";
  for (const r of repls) {
    const rel = `./images/${moduleSlug}/${r.pngFile}`;
    out = out.replace(r.fullMatch, `![${r.alt}](${rel})`);
  }

  const tmpMd = job.src.replace(/\.md$/, ".tmp-for-docx.md");
  await writeFile(tmpMd, out, "utf8");
  return { tmpMd, renderedCount: counter };
}

async function pandocConvert(tmpMd: string, outDocx: string): Promise<void> {
  const args = [
    tmpMd,
    "-o", outDocx,
    "--from=gfm",
    "--toc",
    "--toc-depth=2",
    "--resource-path=" + dirname(tmpMd),
  ];
  // Use execFile (no shell) — both the binary path and args are
  // controlled by us, so there's no injection surface.
  const { stderr } = await execFile(PANDOC, args, { maxBuffer: 50 * 1024 * 1024 });
  if (stderr.trim()) {
    // Pandoc writes warnings (eg. image not found) to stderr but still
    // exits 0. Surface them so they don't go silent.
    console.warn(stderr.trim().split("\n").map((l) => "    " + l).join("\n"));
  }
}

async function buildOne(job: GuideJob): Promise<void> {
  const label = job.src.split(/[\\/]/).pop();
  console.log(`\n▶ ${label}`);
  if (!existsSync(job.src)) {
    console.warn(`  (source not found, skipping)`);
    return;
  }
  const { tmpMd, renderedCount } = await preprocessMarkdown(job);
  console.log(`  ${renderedCount} mermaid block(s) rendered`);
  await pandocConvert(tmpMd, job.outDocx);
  await rm(tmpMd, { force: true });
  console.log(`  ✓ ${job.outDocx.split(/[\\/]/).pop()}`);
}

async function main() {
  if (!existsSync(MMDC_CLI)) {
    console.error("mmdc cli.js not found — run: npm install --save-dev --legacy-peer-deps @mermaid-js/mermaid-cli");
    process.exit(1);
  }
  console.log(`Using pandoc: ${PANDOC}`);
  console.log(`Using mmdc:   ${MMDC_CLI}`);
  for (const job of JOBS) {
    try {
      await buildOne(job);
    } catch (e) {
      console.error(`  ✗ ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
