/**
 * Logica figure specs: validator, option permutation, and the authored
 * matrix items in scripts/sdc-hipo/logica-figures.json.
 *
 *   node --experimental-strip-types --test src/lib/psychometrics/figure.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFigure, permuteFigure, cellKey } from "./figure.ts";
import { reorderOptions } from "../scoring/option-shuffle.ts";

const src = JSON.parse(readFileSync(new URL("../../../scripts/sdc-hipo/logica-figures.json", import.meta.url), "utf8")) as {
  stem_en: string; stem_ar: string;
  items: { replaces: string; difficulty: string; correct: number; figure: unknown }[];
};

const grid2 = { cols: 2, cells: [{ dots: 1 }, { dots: 2 }, { dots: 3 }, null], options: [{ dots: 4 }, { dots: 3 }, { dots: 2 }, { dots: 5 }] };

test("a well-formed figure parses", () => {
  const f = parseFigure(grid2, 4);
  assert.ok(f);
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
    assert.equal(s.options[s.correctIndex], "Four dots");
    assert.equal(cellKey(pf.options[s.correctIndex]), cellKey({ dots: 4 }));
    // Every served drawing still matches its served text.
    s.origIndex.forEach((o, i) => assert.equal(cellKey(pf.options[i]), cellKey(f.options[o])));
  }
});

test("all ten authored matrix items validate", () => {
  assert.equal(src.items.length, 10);
  assert.equal(new Set(src.items.map((i) => i.replaces)).size, 10);
  const byDiff = src.items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.difficulty]: (a[i.difficulty] ?? 0) + 1 }), {});
  assert.deepEqual(byDiff, { easy: 3, medium: 4, hard: 3 }, "blueprint depth per difficulty");
  for (const it of src.items) {
    const f = parseFigure(it.figure, 4);
    assert.ok(f, `${it.replaces} validates`);
    assert.ok(it.correct >= 0 && it.correct < 4);
  }
});

test("the new stem no longer states a rule", () => {
  for (const s of [src.stem_en, src.stem_ar]) {
    assert.ok(s.length < 90, "short instruction only");
    assert.doesNotMatch(s, /increase|rotat|clockwise|each row|each column|يزداد|يدور|عقارب/);
  }
});
