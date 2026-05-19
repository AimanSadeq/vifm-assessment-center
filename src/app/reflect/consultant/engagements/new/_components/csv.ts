// Tiny CSV helpers for the wizard's bulk-paste flows.
// Tab-separated values are also supported so consultants can paste
// directly from Excel/Google Sheets without converting.

export function parseCsvOrTsv(text: string): string[][] {
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (!trimmed) return [];
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  // Detect separator from first line
  const separator = lines[0].includes("\t") ? "\t" : ",";

  return lines.map((line) => {
    if (separator === "\t") {
      return line.split("\t").map((c) => c.trim());
    }
    // Simple CSV split that tolerates commas inside double quotes.
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          cells.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

// Strip a header row only when its first cell looks like one of the
// expected header names. Avoids losing a row when the consultant
// pasted data without headers.
export function maybeDropHeader(rows: string[][], expectedHeaders: string[]): string[][] {
  if (rows.length === 0) return rows;
  const firstCell = rows[0][0]?.toLowerCase() ?? "";
  if (expectedHeaders.some((h) => firstCell === h.toLowerCase())) {
    return rows.slice(1);
  }
  return rows;
}
