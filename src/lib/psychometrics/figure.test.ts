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
  items: {
    replaces: string | null; like?: string; label: string; difficulty: string; difficulty_from?: string; correct: number;
    options_en: string[]; options_ar?: string[]; stem_en?: string; stem_ar?: string; figure: { kind: string };
  }[];
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

test("all 25 authored figure items validate in both languages", () => {
  const replaced = src.items.filter((i) => i.replaces);
  const added = src.items.filter((i) => !i.replaces);
  assert.equal(replaced.length, 21);
  assert.equal(added.length, 4);
  assert.equal(new Set(replaced.map((i) => i.replaces)).size, 21);
  // Every cell of every facet can still fill a sitting (at least one item per
  // difficulty); the matrix facet gains hard items after the line-count relabel.
  assert.deepEqual(depth(byKind("grid")), { easy: 4, medium: 4, hard: 6 }, "matrix facet");
  assert.deepEqual(depth(byKind("data")), { easy: 3, medium: 4, hard: 3 }, "data-interpretation facet");
  assert.equal(byKind("options").length, 1);
  for (const it of src.items) {
    for (const lang of ["en", "ar"] as const) {
      const f = parseFigure(it.figure, it.options_en.length, lang);
      assert.ok(f, `${it.label} (${lang}) validates`);
    }
    assert.ok(it.correct >= 0 && it.correct < it.options_en.length);
  }
  for (const it of added) {
    assert.ok(it.like && it.options_ar?.length === it.options_en.length, `${it.label}: reference item and Arabic options`);
    assert.equal(it.difficulty, "hard");
  }
});

test("each three-rule item's wrong options break exactly one rule", () => {
  type Cell = { shape?: string; fill?: string; side?: { count: number }; quad?: string[] };
  const attrs = (c: Cell) => [c.shape, c.fill, c.side?.count, c.quad ? [...c.quad].sort().join("") : undefined];
  // The two three-rule items: every distractor changes one feature of the key.
  const threeRule = src.items.filter((i) => !i.replaces && (i.label.startsWith("Shape") || i.label.startsWith("Rows")));
  assert.equal(threeRule.length, 2);
  for (const it of threeRule) {
    const opts = (it.figure as unknown as { options: Cell[] }).options;
    const key = attrs(opts[it.correct]);
    opts.forEach((o, i) => {
      if (i === it.correct) return;
      const diff = attrs(o).filter((v, k) => v !== key[k]).length;
      assert.equal(diff, 1, `${it.label}: option ${i} differs from the key in ${diff} features`);
    });
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
    assert.ok(s.length < 160, "short instruction only");
    assert.doesNotMatch(s, /increase|rotat|clockwise|each row|each column|four sides|يزداد|يدور|عقارب|أضلاع/);
  }
});

test("number options are ordered, in a random direction per sitting", () => {
  const seen = new Set<string>();
  for (let run = 0; run < 200; run++) {
    const s = reorderOptions(["13", "11", "15", "12"], 3);
    assert.equal(s.options[s.correctIndex], "12");
    const vals = s.options.map(Number);
    const asc = vals.every((v, i) => i === 0 || v > vals[i - 1]);
    const desc = vals.every((v, i) => i === 0 || v < vals[i - 1]);
    assert.ok(asc || desc, "always in numerical order");
    seen.add(asc ? "asc" : "desc");
  }
  assert.equal(seen.size, 2, "both directions occur");
});
