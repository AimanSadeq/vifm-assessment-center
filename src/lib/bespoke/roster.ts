// Bundle roster (00233): the approved people for a roster-gated bundle.
// One row per (bundle, lower-cased email); bundle_candidate_id is set when the
// person starts, which is what limits each person to one sitting.

import { createServiceClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normaliseEmail = (e: string) => (e || "").trim().toLowerCase();

export type RosterInput = {
  email: string;
  fullName: string;
  grade: number | null;
  position: string | null;
  businessUnit: string | null;
  employeeId: string | null;
  isTester: boolean;
  extra: Record<string, string>;
};

export type RosterRow = {
  id: string;
  email_norm: string;
  full_name: string;
  grade: number | null;
  position: string | null;
  business_unit: string | null;
  employee_id: string | null;
  is_tester: boolean;
  extra: Record<string, string>;
  bundle_candidate_id: string | null;
};

/** Split pasted CSV or tab-separated text (Excel paste) into cells. */
function splitRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  return lines.map((line) => {
    if (sep === "\t") return line.split("\t").map((c) => c.trim());
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { cells.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  });
}

// Header synonyms, matched after lower-casing and collapsing spaces/underscores.
const COLS: Record<keyof Omit<RosterInput, "extra">, string[]> = {
  email: ["email", "email address", "work email", "e-mail"],
  fullName: ["name", "full name", "employee name", "employee english", "candidate"],
  grade: ["grade"],
  position: ["position", "job title", "title", "role"],
  businessUnit: ["business unit", "bu", "department", "function"],
  employeeId: ["employee id", "person", "employee number", "staff id", "id"],
  isTester: ["tester", "is tester", "pilot"],
};
const norm = (h: string) => h.toLowerCase().replace(/[_\s]+/g, " ").trim();

/** Parse a roster paste. The first row must be a header with at least an email
 *  and a name column; unknown columns (e.g. Gender) are kept in `extra`. */
export function parseRoster(text: string): { rows: RosterInput[]; errors: string[] } {
  const grid = splitRows(text);
  const errors: string[] = [];
  if (grid.length < 2) return { rows: [], errors: ["Paste a header row and at least one person."] };
  const header = grid[0].map(norm);
  const idx = {} as Record<keyof typeof COLS, number>;
  for (const [k, names] of Object.entries(COLS) as [keyof typeof COLS, string[]][]) {
    idx[k] = header.findIndex((h) => names.includes(h));
  }
  if (idx.email < 0 || idx.fullName < 0) {
    return { rows: [], errors: ["The header row needs an Email column and a Name column."] };
  }
  const known = new Set(Object.values(idx).filter((i) => i >= 0));
  const rows: RosterInput[] = [];
  const seen = new Set<string>();
  grid.slice(1).forEach((cells, n) => {
    const line = n + 2;
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const email = normaliseEmail(cell(idx.email));
    const fullName = cell(idx.fullName).replace(/\s+/g, " ");
    if (!EMAIL_RE.test(email)) { errors.push(`Row ${line}: "${cell(idx.email)}" is not a valid email.`); return; }
    if (fullName.length < 2) { errors.push(`Row ${line}: missing name.`); return; }
    if (seen.has(email)) { errors.push(`Row ${line}: ${email} appears more than once.`); return; }
    seen.add(email);
    const g = cell(idx.grade);
    const grade = g === "" ? null : Number.parseInt(g, 10);
    if (g !== "" && !Number.isFinite(grade)) { errors.push(`Row ${line}: grade "${g}" is not a number.`); return; }
    const extra: Record<string, string> = {};
    grid[0].forEach((h, i) => { if (!known.has(i) && h.trim() && cell(i)) extra[h.trim().slice(0, 40)] = cell(i).slice(0, 200); });
    rows.push({
      email, fullName: fullName.slice(0, 200), grade: grade as number | null,
      position: cell(idx.position) || null, businessUnit: cell(idx.businessUnit) || null,
      employeeId: cell(idx.employeeId) || null,
      isTester: /^(y|yes|true|1)$/i.test(cell(idx.isTester)), extra,
    });
  });
  return { rows, errors };
}

/** Add or update roster rows (matched on email). People who have already
 *  started keep their link to their sitting. Never deletes. */
export async function upsertRoster(bundleId: string, rows: RosterInput[]): Promise<{ ok: true; count: number } | { error: string }> {
  if (rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 2000) return { error: "Up to 2,000 people per import." };
  const sb = createServiceClient();
  const { error } = await sb.from("bundle_roster").upsert(
    rows.map((r) => ({
      bespoke_service_id: bundleId,
      email_norm: r.email,
      full_name: r.fullName,
      grade: r.grade,
      position: r.position,
      business_unit: r.businessUnit,
      employee_id: r.employeeId,
      is_tester: r.isTester,
      extra: r.extra,
    })),
    { onConflict: "bespoke_service_id,email_norm" },
  );
  if (error) return { error: error.message };
  return { ok: true, count: rows.length };
}

/** Remove a person who has not started yet. */
export async function removeRosterEntry(bundleId: string, rosterId: string): Promise<{ ok: true } | { error: string }> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("bundle_roster")
    .delete()
    .eq("id", rosterId)
    .eq("bespoke_service_id", bundleId)
    .is("bundle_candidate_id", null)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "This person has already started and cannot be removed." };
  return { ok: true };
}

export async function loadRoster(bundleId: string): Promise<RosterRow[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_roster")
      .select("id, email_norm, full_name, grade, position, business_unit, employee_id, is_tester, extra, bundle_candidate_id")
      .eq("bespoke_service_id", bundleId)
      .order("full_name");
    return (data ?? []) as RosterRow[];
  } catch {
    return [];
  }
}

export async function findRosterEntry(bundleId: string, email: string): Promise<RosterRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("bundle_roster")
    .select("id, email_norm, full_name, grade, position, business_unit, employee_id, is_tester, extra, bundle_candidate_id")
    .eq("bespoke_service_id", bundleId)
    .eq("email_norm", normaliseEmail(email))
    .maybeSingle<RosterRow>();
  return data ?? null;
}

/** Link a person to their new sitting, only if they have none yet (race-safe). */
export async function claimRosterEntry(rosterId: string, candidateId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("bundle_roster")
    .update({ bundle_candidate_id: candidateId })
    .eq("id", rosterId)
    .is("bundle_candidate_id", null)
    .select("id");
  return !!data && data.length > 0;
}

export async function rosterEntryForCandidate(candidateId: string): Promise<RosterRow | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_roster")
      .select("id, email_norm, full_name, grade, position, business_unit, employee_id, is_tester, extra, bundle_candidate_id")
      .eq("bundle_candidate_id", candidateId)
      .maybeSingle<RosterRow>();
    return data ?? null;
  } catch {
    return null;
  }
}
