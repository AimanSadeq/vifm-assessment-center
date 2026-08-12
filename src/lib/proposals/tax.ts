/**
 * Proposal tax treatment (client review, 2026-08-12): a proposal can add VAT on
 * top of the commercial total (5% UAE / 15% KSA) or carry a 15% withholding-tax
 * note (KSA WHT is deducted at source by the client, so it never ADDS to the
 * total - it renders as an explicit gross-of-WHT note instead).
 *
 * Stored in the licence_data bag as `taxMode` (no migration needed). The DB
 * `total` column stays PRE-TAX (ARR/dashboard metrics must not inflate); VAT is
 * computed at render time in the HTML/Word builders.
 */

export type TaxMode = "none" | "vat5" | "vat15" | "wht15";

export function resolveTaxMode(v: unknown): TaxMode {
  return v === "vat5" || v === "vat15" || v === "wht15" ? v : "none";
}

/** The headline rate for the mode (0 for none). */
export function taxRatePct(mode: TaxMode): number {
  if (mode === "vat5") return 5;
  if (mode === "vat15" || mode === "wht15") return 15;
  return 0;
}

export function isVat(mode: TaxMode): boolean {
  return mode === "vat5" || mode === "vat15";
}

/** VAT amount on a pre-tax total, rounded to cents. 0 for none/WHT modes. */
export function vatAmount(total: number, mode: TaxMode): number {
  if (!isVat(mode)) return 0;
  return Math.round(total * taxRatePct(mode)) / 100;
}

/** Pre-tax total + VAT (equals the pre-tax total for none/WHT modes). */
export function totalWithVat(total: number, mode: TaxMode): number {
  return Math.round((total + vatAmount(total, mode)) * 100) / 100;
}
