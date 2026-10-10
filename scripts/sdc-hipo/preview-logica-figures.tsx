/**
 * Renders scripts/sdc-hipo/logica-figures.json to a static HTML review sheet
 * (grid, the four drawn options with letters, the key, and the rationale), so
 * the SME can check every drawing before the load runs.
 *
 *   npx tsx --tsconfig scripts/sdc-hipo/tsconfig.preview.json scripts/sdc-hipo/preview-logica-figures.tsx out.html [--no-key]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { FigureGrid, FigureCell } from "../../src/components/shared/logica-figure";
import { parseFigure } from "../../src/lib/psychometrics/figure";

type Entry = { replaces: string; label: string; difficulty: string; correct: number; redesigned?: string; rationale?: string; figure: unknown };
const src = JSON.parse(readFileSync(new URL("./logica-figures.json", import.meta.url), "utf8")) as { stem_en: string; items: Entry[] };
const out = process.argv[2] ?? "logica-figures.html";
const showKey = !process.argv.includes("--no-key");

const blocks = src.items.map((it, n) => {
  const fig = parseFigure(it.figure, 4);
  if (!fig) throw new Error(`Figure ${n + 1} (${it.label}) does not validate`);
  return (
    <section key={it.replaces} style={{ breakInside: "avoid", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>Item {n + 1} of {src.items.length} · {it.label} · {it.difficulty}{it.redesigned ? " · REDESIGNED" : ""}</div>
      <p style={{ fontWeight: 600, color: "#010131", margin: "6px 0 10px" }}>{src.stem_en}</p>
      <FigureGrid figure={fig} ariaLabel="Pattern grid" />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {fig.options.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, border: `2px solid ${showKey && i === it.correct ? "#059669" : "#e2e8f0"}`, borderRadius: 8, padding: "4px 8px" }}>
            <b style={{ color: "#010131" }}>{String.fromCharCode(65 + i)}</b>
            <FigureCell cell={c} size={64} />
          </div>
        ))}
      </div>
      {showKey && <p style={{ fontSize: 12, color: "#059669", margin: "8px 0 0" }}>Key: {String.fromCharCode(65 + it.correct)}</p>}
      {showKey && it.redesigned && <p style={{ fontSize: 12, color: "#b45309", margin: "4px 0 0" }}>{it.redesigned}</p>}
      {showKey && it.rationale && <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>{it.rationale}</p>}
    </section>
  );
});

const css = ".inline-grid{display:inline-grid}.gap-1\\.5{gap:6px}.rounded-lg{border-radius:8px}.rounded-md{border-radius:6px}.border{border:1px solid #e2e8f0}.border-2{border-width:2px}.border-dashed{border-style:dashed;border-color:#5391D5}.p-2{padding:8px}.flex{display:flex}.items-center{align-items:center}.justify-center{justify-content:center}.bg-white{background:#fff}";
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Logica figure items</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px}${css}</style></head><body><h1 style="font-size:18px;color:#010131">Logica matrix items as figures (review sheet)</h1>${renderToStaticMarkup(<>{blocks}</>)}</body></html>`;
writeFileSync(out, html);
console.log(`wrote ${out}`);
