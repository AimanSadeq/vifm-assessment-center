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

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
