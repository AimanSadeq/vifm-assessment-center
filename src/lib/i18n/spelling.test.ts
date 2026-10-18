/**
 * Caliber writes American English (Aiman's ruling, 18 Oct 2026). The product name
 * "Assessment Center" was already American. This guard scans the English copy
 * that people see for British spellings so the standard cannot drift back:
 *
 *   - every string value in src/lib/i18n/locales/en.json
 *   - every string in the SDC IDP content (src/lib/reports/sdc-hipo/idp-content.json)
 *   - prose string literals (three or more words) in src, outside comments
 *
 * Left alone on purpose: identifiers, enum values, URLs, the database seed files
 * (*-seed.ts) and src/data, which mirror rows that are still spelled as stored,
 * and the names of stored framework entities listed in STORED_NAMES.
 *
 * Run: npx tsx --test src/lib/i18n/spelling.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");

// prettier-ignore
const BRITISH = /\b(?:[a-z]*(?:organis|realis|recognis|prioritis|summaris|customis|optimis|minimis|maximis|utilis|standardis|specialis|finalis|authoris|personalis|categoris|characteris|criticis|memoris|visualis|normalis|formalis|centralis|generalis|mobilis|capitalis|itemis|localis|materialis|modernis|monetis|neutralis|operationalis|rationalis|scrutinis|stabilis|anonymis|randomis|annualis|sanitis|contextualis|idealis|individualis|energis|institutionalis|initialis|nationalis|professionalis|amortis|emphasis|synthesis|hypothesis)(?:e|es|ed|ing|ation|ations|ational|er|ers|able)|analys(?:e|ed|ing)|[a-z]*(?:behavi|col|fav|hon|lab|cand|rig|vig|rum|neighb|flav|endeav|hum|arm|harb|od|val|sav|splend|demean|ferv|clam|vap)our[a-z]*|[a-z]*(?:cent|met|lit|theat|fib|calib)res?|centr(?:ed|ing)|[a-z]*(?:travel|model|label|cancel|counsel|fuel|level|signal|total|channel|dial|equal|trial|marshal)l(?:ed|ing|er|ers|or|ors)|catalogu(?:e|es|ed|ing)|analogue|defence|offence|licenc(?:e|es|ed|ing)|programmes?|grey|cheques?|tyres?|artefacts?|ageing|whilst|amongst|learnt|judgements?|acknowledgements?|enquir(?:y|ies|e|ed|ing)|practis(?:e|es|ed|ing)|storeys?|maths|orientated|focussed|dependants?|enrol(?:s|ment|ments)?|fulfil(?:s|ment)?|instalments?|skilful|per cent)\b/i; // keep-british

// Names of stored framework entities and published titles: spelled as stored or published.
// prettier-ignore
const STORED_NAMES = /British Psychological Society|Design and Delivery of Assessment Centres|Granada Centre|Managing Successful Programmes|UAE Labour Law|Demo Organisation|Mobilising Around Purpose|Planning & Prioritisation|Sound Judgement|Process Optimisation|Resource Mobilisation|Financial Modelling|Forecasting & Modelling|Data Modelling|Predictive Modelling|Critical Analysis & Judgement/g; // keep-british

function offenders(text: string): string[] {
  const cleaned = text
    .replace(/\$\{[^}]*\}/g, " ") // template expressions are code (enum values, identifiers)
    .replace(STORED_NAMES, " ")
    .replace(/\S+:\/\/\S+/g, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ");
  return cleaned.match(new RegExp(BRITISH.source, "gi")) ?? [];
}

function jsonStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => jsonStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => jsonStrings(v, out));
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith("-seed.ts")) out.push(p);
  }
  return out;
}

test("en.json: every English UI string is American English", () => {
  const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en.json"), "utf8"));
  const bad = jsonStrings(en).flatMap((s) => offenders(s).map((w) => `${w}: ${s.slice(0, 80)}`));
  assert.deepEqual(bad, [], `British spellings in en.json:\n${bad.join("\n")}`);
});

test("SDC IDP content is American English", () => {
  const idp = JSON.parse(readFileSync(join(ROOT, "src/lib/reports/sdc-hipo/idp-content.json"), "utf8"));
  const bad = jsonStrings(idp).flatMap((s) => offenders(s).map((w) => `${w}: ${s.slice(0, 80)}`));
  assert.deepEqual(bad, [], `British spellings in idp-content.json:\n${bad.join("\n")}`);
});

test("prose string literals in src are American English", () => {
  const bad: string[] = [];
  const literal = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const file of walk(join(ROOT, "src"))) {
    const rel = relative(ROOT, file);
    if (rel.startsWith("src/data/") || rel.includes("/i18n/locales/")) continue;
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || line.includes("keep-british")) return;
      for (const m of line.matchAll(literal)) {
        const s = m[1] ?? m[2] ?? "";
        if (s.split(/\s+/).filter(Boolean).length < 3) continue;
        for (const w of offenders(s)) bad.push(`${rel}:${i + 1} [${w}] ${s.slice(0, 70)}`);
      }
    });
  }
  assert.deepEqual(bad, [], `British spellings in src string literals:\n${bad.join("\n")}`);
});

test("the guard itself catches British forms and accepts American ones", () => {
  assert.deepEqual(offenders("The centre organised a programme of behavioural modelling."), ["centre", "organised", "programme", "behavioural", "modelling"]); // keep-british
  assert.deepEqual(offenders("The center organized a program of behavioral modeling, rounded to the center."), []);
  assert.deepEqual(offenders("Planning & Prioritisation sits beside Sound Judgement in the stored framework."), []);
});
