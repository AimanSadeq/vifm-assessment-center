// Deterministic date formatting for CLIENT components.
//
// `Date#toLocaleDateString()` with no fixed locale/timezone renders differently
// on the server (its locale/TZ) than in the browser, which triggers a React
// hydration mismatch ("Text content did not match"). These helpers format in
// UTC with fixed month names, so SSR and client output are identical.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** DD Mon YYYY in UTC, e.g. "17 Jun 2026". Returns "-" for empty/invalid input. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** DD Mon YYYY, HH:MM in UTC. Returns "-" for empty/invalid input. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDate(iso)}, ${hh}:${mm} UTC`;
}
