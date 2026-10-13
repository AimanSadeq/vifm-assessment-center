/**
 * Unit tests for the minimal .xlsx reader.
 * Run: npx tsx --test src/lib/xlsx/read.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readXlsxSheet } from "./read.ts";
import { buildXlsx } from "./write.ts";

const NS = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`;
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** A hand-written workbook in the shape Excel saves: shared strings, styles, formulas. */
async function excelLike(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="/xl/workbook.xml"/></Relationships>`);
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook ${NS} xmlns:r="${REL}"><sheets><sheet name="Read me" sheetId="1" r:id="rId7"/><sheet name="Q &amp; A" sheetId="2" r:id="rId3"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId3" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
      `<Relationship Id="rId7" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId9" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0"?><sst ${NS} count="4" uniqueCount="4">` +
      `<si><t>first</t></si>` +
      `<si><t/></si>` +
      `<si><r><rPr><b/></rPr><t xml:space="preserve">rich </t></r><r><t>text</t></r><rPh sb="0" eb="1"><t>ignored</t></rPh></si>` +
      `<si><t>Tom &amp; Jerry&#x2019;s_x000D_</t></si></sst>`,
  );
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`);
  zip.file(
    "xl/worksheets/sheet2.xml",
    `<?xml version="1.0"?><worksheet ${NS}><cols><col min="1" max="3" width="9"/></cols><sheetData>` +
      `<row r="2" spans="1:5"><c r="A2" s="1" t="s"><v>2</v></c><c r="C2" s="1"/><c r="E2"><v>42</v></c></row>` +
      `<row r="5"><c r="B5" t="b"><v>1</v></c><c r="C5" t="str"><f>A2&amp;"!"</f><v>rich text!</v></c><c r="D5" t="inlineStr"><is><t>inline &lt;b&gt;</t></is></c><c r="F5" t="s"><v>3</v></c></row>` +
      `<row r="6"><c t="s"><v>1</v></c><c><v>1.5</v></c></row>` +
      `</sheetData><conditionalFormatting sqref="A1"><cfRule type="expression" priority="1"><formula>A1</formula></cfRule></conditionalFormatting></worksheet>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

test("a sheet is found by name and read with gaps, shared, rich and inline strings", async () => {
  const grid = await readXlsxSheet(await excelLike(), "Q & A");
  assert.ok(grid);
  assert.deepEqual(grid[0], []);
  assert.deepEqual(grid[1], ["rich text", "", "", "", "42"]);
  assert.deepEqual(grid[2], []);
  assert.deepEqual(grid[4], ["", "TRUE", "rich text!", "inline <b>", "", "Tom & Jerry’s\r"]);
  assert.deepEqual(grid[5], ["", "1.5"]); // cells without refs follow on from the last column
  assert.equal(grid.length, 6);
  const readMe = await readXlsxSheet(await excelLike(), "Read me");
  assert.deepEqual(readMe, [["first"]]);
});

test("an unknown sheet gives null and a non-workbook throws", async () => {
  assert.equal(await readXlsxSheet(await excelLike(), "Scenarios"), null);
  await assert.rejects(readXlsxSheet(Buffer.from("plain text"), "Scenarios"), /not an Excel workbook/);
});

test("reads back what the writer makes", async () => {
  const buf = await buildXlsx([{ name: "People", header: ["Name", "Score"], rows: [["Sarah \"S\" <A&B>", 12], [null, 3.5]] }]);
  assert.deepEqual(await readXlsxSheet(buf, "People"), [["Name", "Score"], ['Sarah "S" <A&B>', "12"], ["", "3.5"]]);
});
