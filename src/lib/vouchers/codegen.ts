// Single source of truth for human-typed voucher codes across all instruments.
// Unambiguous charset (no 0/O/1/I) so codes are easy to read aloud and type.
// Each service used to copy this block into its own vouchers.ts.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Human-friendly, unguessable code, e.g. makeVoucherCode("ARC") -> "VIFM-ARC-7K3M-9QX2". */
export function makeVoucherCode(prefix: string): string {
  return `VIFM-${prefix}-${randomBlock(4)}-${randomBlock(4)}`;
}

// A VIFM voucher code anywhere inside a pasted string, e.g. "VIFM-ARC-WRB4-SPH9".
const CODE_IN_TEXT = /VIFM-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}/;

/**
 * Clean a code as the delegate pasted it. Copying a linked code out of an
 * email often brings extra text with it: Outlook appends the link target in
 * square brackets ("VIFM-ARC-WRB4-SPH9 [caliber.viftraining.com]"), other
 * clients add angle brackets, quotes, a trailing full stop or a non-breaking
 * space, and some turn the hyphens into en dashes. When a VIFM code is in
 * there, return just the code; otherwise fall back to the trimmed text with
 * any bracketed tail removed.
 */
export function normalizeCode(code: string): string {
  const up = String(code ?? "")
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ");
  const hit = up.match(CODE_IN_TEXT);
  if (hit) return hit[0];
  return up.replace(/\[[^\]]*\]|<[^>]*>/g, " ").trim();
}
