// Shared voucher types used by the consolidated redeem engine (core.ts) and the
// shared redeem component. Per-service tables/columns stay; this is the common
// vocabulary over them.

export type VoucherLanguage = "en" | "ar";

/** Everything the redeemer supplies at the public redeem form. */
export type RedeemerInput = {
  code: string;
  redeemerName: string;
  redeemerEmail: string;
  /** Required by some services (ARC/Fluent for insights), optional for others. */
  companyName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** A service's provision() step returns a token (+ any extras the runner needs). */
export type ProvisionOk = { ok: true; token: string } & Record<string, unknown>;
export type ProvisionErr = { ok: false; error: string };
export type ProvisionResult = ProvisionOk | ProvisionErr;

/** What core.redeemViaDescriptor returns to the caller. */
export type RedeemOutcome =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; error: string };
