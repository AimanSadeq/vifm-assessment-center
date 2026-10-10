/**
 * Logica figure specs: validator, option permutation, and the authored
 * matrix items in scripts/sdc-hipo/logica-figures.json.
 *
 *   node --experimental-strip-types --test src/lib/psychometrics/figure.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFigure, permuteFigure, cellKey, hasDrawnOptions, type DataFigure } from "./figure.ts";
import { reorderOptions } from "../scoring/option-shuffle.ts";

const src = JSON.parse(readFileSync(new URL("../../../scripts/sdc-hipo/logica-figures.json", import.meta.url), "utf8")) as {
  stem_en: string; stem_ar: string;
  items: { replaces: string; label: string; difficulty: string; correct: number; stem_en?: string; stem_ar?: string; figure: { kind: string } }[];
};

const grid2 = { cols: 2, cells: [{ dots: 1 }, { dots: 2 }, { dots: 3 }, null], options: [{ dots: 4 }, { dots: 3 }, { dots: 2 }, { dots: 5 }] };

test("a well-formed figure parses", () => {
  const f = parseFigure(grid2, 4);
  assert.ok(f && f.kind === "grid");
  assert.equal(f.cells.filter((c) => c === null).length, 1);
});

test("malformed figures are refused, never half-drawn", () => {
  assert.equal(parseFigure(null, 4), null);
  assert.equal(parseFigure({ ...grid2, cols: 4 }, 4), null);
  assert.equal(parseFigure(grid2, 3), null, "option count must match the option text");
  assert.equal(parseFigure({ ...grid2, cells: [{ dots: 1 }, { dots: 2 }, null, null] }, 4), null, "exactly one missing cell");
  assert.equal(parseFigure({ ...grid2, cells: [{ dots: 1 }, { dots: 2 }, { dots: 3 }, { dots: 4 }] }, 4), null, "a missing cell is required");
  assert.equal(parseFigure({ ...grid2, options: [{ dots: 4 }, { dots: 4 }, { dots: 2 }, { dots: 5 }] }, 4), null, "duplicate drawings");
  assert.equal(parseFigure({ ...grid2, options: [{ dots: 4, lines: 2 }, { dots: 3 }, { dots: 2 }, { dots: 5 }] }, 4), null, "one primary element per cell");
  assert.equal(parseFigure({ ...grid2, options: [{ fill: "full" }, { dots: 3 }, { dots: 2 }, { dots: 5 }] }, 4), null, "modifier without a shape");
  assert.equal(parseFigure({ ...grid2, options: [{ svg: "<script>" }, { dots: 3 }, { dots: 2 }, { dots: 5 }] }, 4), null, "unknown keys draw nothing");
  assert.equal(parseFigure({ ...grid2, options: [{ dots: 9 }, { dots: 3 }, { dots: 2 }, { dots: 5 }] }, 4), null);
  assert.equal(parseFigure({ ...grid2, options: [{ quad: ["tl", "tl"] }, { dots: 3 }, { dots: 2 }, { dots: 5 }] }, 4), null);
});

test("the key follows its drawing through the per-sitting shuffle", () => {
  const f = parseFigure(grid2, 4)!;
  const text = ["Four dots", "Three dots", "Two dots", "Five dots"];
  for (let run = 0; run < 200; run++) {
    const s = reorderOptions(text, 0);
    const pf = permuteFigure(f, s.origIndex);
    assert.ok(hasDrawnOptions(f) && hasDrawnOptions(pf));
    assert.equal(s.options[s.correctIndex], "Four dots");
    assert.equal(cellKey(pf.options[s.correctIndex]), cellKey({ dots: 4 }));
    // Every served drawing still matches its served text.
    s.origIndex.forEach((o, i) => assert.equal(cellKey(pf.options[i]), cellKey(f.options[o])));
  }
});

const byKind = (k: string) => src.items.filter((i) => i.figure.kind === k);
const depth = (items: typeof src.items) =>
  items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.difficulty]: (a[i.difficulty] ?? 0) + 1 }), {});

test("all 21 authored figure items validate in both languages", () => {
  assert.equal(src.items.length, 21);
  assert.equal(new Set(src.items.map((i) => i.replaces)).size, 21);
  // Whole facets are replaced, so each keeps its blueprint depth (3 easy / 4 medium / 3 hard).
  assert.deepEqual(depth(byKind("grid")), { easy: 3, medium: 4, hard: 3 }, "matrix facet");
  assert.deepEqual(depth(byKind("data")), { easy: 3, medium: 4, hard: 3 }, "data-interpretation facet");
  assert.equal(byKind("options").length, 1);
  for (const it of src.items) {
    for (const lang of ["en", "ar"] as const) {
      const f = parseFigure(it.figure, 4, lang);
      assert.ok(f, `${it.label} (${lang}) validates`);
    }
    assert.ok(it.correct >= 0 && it.correct < 4);
  }
});

test("data figures resolve one language and keep the authored values", () => {
  for (const it of byKind("data")) {
    const en = parseFigure(it.figure, 4, "en") as DataFigure;
    const ar = parseFigure(it.figure, 4, "ar") as DataFigure;
    assert.deepEqual(en.rows.map((r) => r.value), ar.rows.map((r) => r.value), it.label);
    assert.match(ar.title, /[\u0600-\u06FF]/, `${it.label}: Arabic title`);
    assert.ok(!("title_en" in en), "stored bilingual keys never reach the browser");
    // The stem asks the question; the numbers live only in the figure.
    for (const r of en.rows) assert.ok(!it.stem_en!.includes(`${r.label} ${r.value}`), `${it.label}: data not repeated in the stem`);
  }
});

test("no figure stem states the rule", () => {
  const stems = [src.stem_en, src.stem_ar, ...byKind("options").flatMap((i) => [i.stem_en!, i.stem_ar!])];
  for (const s of stems) {
    assert.ok(s.length < 90, "short instruction only");
    assert.doesNotMatch(s, /increase|rotat|clockwise|each row|each column|four sides|يزداد|يدور|عقارب|أضلاع/);
  }
});
