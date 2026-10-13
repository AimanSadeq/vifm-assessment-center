// Minimal .xlsx reader on JSZip: one named sheet as a grid of cell strings.
// Shared strings, inline strings, numbers, booleans and error values; formulas
// give their cached value and styles are ignored (so dates read as serial
// numbers). Enough for admin uploads of workbooks we designed ourselves.

import JSZip from "jszip";

/** rows[r][c] is the text of the cell in row r + 1, column c + 1 ("" when empty). */
export type XlsxGrid = string[][];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** OOXML escapes characters XML cannot hold as _xHHHH_ (and a literal "_x" as _x005F_x). */
const decodeOoxml = (s: string) => s.replace(/_x([0-9a-fA-F]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[2] ?? m[3] ?? "");
  return out;
}

/** An attribute by local name, whatever namespace prefix the writer used (r:id, x:r). */
function attr(a: Record<string, string>, local: string): string | undefined {
  if (local in a) return a[local];
  const k = Object.keys(a).find((x) => x.endsWith(`:${local}`));
  return k === undefined ? undefined : a[k];
}

/** Concatenated <t> text of a string item, leaving out phonetic runs (<rPh>), as Excel shows it. */
function stringItemText(xml: string): string {
  const body = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let out = "";
  for (const m of body.matchAll(/<(?:\w+:)?t(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) out += m[1] ?? "";
  return decodeOoxml(decodeXml(out));
}

function colIndex(ref: string): number {
  const letters = /^[A-Za-z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n; // 1-based; 0 when the ref has no column
}

/** Resolve a relationship target against the part that owns the .rels file. */
function resolveTarget(baseDir: string, target: string): string {
  const parts = (target.startsWith("/") ? target.slice(1) : `${baseDir}${target}`).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);
const relsOf = (path: string) => `${dirOf(path)}_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`;

async function text(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  return f ? f.async("string") : null;
}

async function relationships(zip: JSZip, partPath: string): Promise<Array<{ id: string; type: string; target: string }>> {
  const xml = await text(zip, relsOf(partPath));
  if (!xml) return [];
  return Array.from(xml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)).map((m) => {
    const a = attrs(m[1]);
    return { id: a.Id ?? "", type: a.Type ?? "", target: resolveTarget(dirOf(partPath), a.Target ?? "") };
  });
}

async function openWorkbook(zip: JSZip) {
  const root = await relationships(zip, "");
  const wbPath = root.find((r) => r.type.endsWith("/officeDocument"))?.target ?? "xl/workbook.xml";
  const wbXml = await text(zip, wbPath);
  if (!wbXml) throw new Error("This file is not an Excel workbook (.xlsx).");
  const rels = await relationships(zip, wbPath);
  const byId = new Map(rels.map((r) => [r.id, r]));
  const sheets = Array.from(wbXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)).map((m) => {
    const a = attrs(m[1]);
    return { name: a.name ?? "", path: byId.get(attr(a, "id") ?? "")?.target ?? "" };
  });
  const sst = rels.find((r) => r.type.endsWith("/sharedStrings"))?.target ?? `${dirOf(wbPath)}sharedStrings.xml`;
  return { sheets, sst };
}

/**
 * Read one sheet by name. Returns null when the workbook has no sheet of that
 * name; throws when the file is not a readable .xlsx.
 */
export async function readXlsxSheet(buffer: ArrayBuffer | Uint8Array | Buffer, sheetName: string): Promise<XlsxGrid | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("This file is not an Excel workbook (.xlsx).");
  }
  const { sheets, sst } = await openWorkbook(zip);
  const sheet = sheets.find((s) => s.name === sheetName);
  if (!sheet) return null;
  const xml = await text(zip, sheet.path);
  if (xml == null) throw new Error(`The sheet '${sheetName}' is missing from the file.`);

  const sstXml = await text(zip, sst);
  const shared = sstXml ? Array.from(sstXml.matchAll(/<(?:\w+:)?si\b(?:[^>]*?\/>|[^>]*>([\s\S]*?)<\/(?:\w+:)?si>)/g)).map((m) => stringItemText(m[1] ?? "")) : [];

  const start = xml.search(/<(?:\w+:)?sheetData\b/);
  const end = xml.search(/<\/(?:\w+:)?sheetData>/);
  const data = start < 0 ? "" : xml.slice(start, end < 0 ? undefined : end);

  const grid: XlsxGrid = [];
  let row = 0;
  let col = 0;
  // Walk the <row> and <c> start tags in order; a cell's body runs to its own </c>.
  const tag = /<(?:\w+:)?(row|c)\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(data))) {
    const a = attrs(m[2]);
    if (m[1] === "row") {
      const r = Number(a.r);
      row = Number.isInteger(r) && r > 0 ? r : row + 1;
      col = 0;
      continue;
    }
    let body = "";
    if (!m[3]) {
      const close = /<\/(?:\w+:)?c>/g;
      close.lastIndex = tag.lastIndex;
      const c = close.exec(data);
      body = data.slice(tag.lastIndex, c ? c.index : data.length);
      tag.lastIndex = c ? close.lastIndex : data.length;
    }
    const ref = a.r ?? "";
    const ci = colIndex(ref);
    col = ci > 0 ? ci : col + 1;
    const rr = Number(/\d+$/.exec(ref)?.[0]);
    const r = Number.isInteger(rr) && rr > 0 ? rr : Math.max(row, 1);

    const type = a.t ?? "n";
    let value = "";
    if (type === "inlineStr") {
      const is = /<(?:\w+:)?is\b(?:[^>]*?\/>|[^>]*>([\s\S]*?)<\/(?:\w+:)?is>)/.exec(body);
      value = is ? stringItemText(is[1] ?? "") : "";
    } else {
      const v = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body);
      const raw = v ? decodeXml(v[1]) : "";
      if (raw === "") value = "";
      else if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "b") value = raw.trim() === "1" ? "TRUE" : "FALSE";
      else if (type === "str") value = decodeOoxml(raw);
      else value = raw; // n (number, as written), e (error text such as #N/A), d (ISO date)
    }
    if (value === "") continue;
    while (grid.length < r) grid.push([]);
    const line = grid[r - 1];
    while (line.length < col) line.push("");
    line[col - 1] = value;
  }
  return grid;
}
