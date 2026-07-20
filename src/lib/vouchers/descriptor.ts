// Static description of each service's voucher engine. The shared core
// (core.ts) dispatches off a descriptor; each service supplies a provision()
// callback. This registry is the single place that enumerates all instruments -
// add a service here, never by cloning a vouchers.ts file.

export type VoucherDescriptor = {
  /** stable key, e.g. "fluent" | "ara" | "persona" */
  key: string;
  /** canonical code prefix for makeVoucherCode, e.g. "ENG" | "ARC" | "PER" */
  codePrefix: string;
  /** the *_vouchers table */
  table: string;
  /**
   * The *_voucher_redemptions audit table, or null where redeeming provisions
   * a domain row directly instead of a generic redemption record. Metadata for
   * humans and future tooling - the shared core does not read it (each
   * service's provision() callback writes its own redemption), so keep it
   * ACCURATE: this registry is documented as the single place that enumerates
   * the voucher engines, and a wrong table name here sat unnoticed for weeks
   * precisely because nothing consumed it.
   */
  redemptionsTable: string | null;
  /** atomic seat-claim RPC (takes { p_code }) */
  claimRpc: string;
  /** atomic seat-release RPC (takes { p_code }); every service now has one */
  releaseRpc: string | null;
  /** public redeem route, e.g. "/ac/fluent/redeem" */
  redeemPath: string;
};

export const VOUCHER_DESCRIPTORS = {
  ara: {
    key: "ara", codePrefix: "ARC", table: "ara_vouchers", redemptionsTable: "ara_voucher_redemptions",
    claimRpc: "ara_voucher_claim", releaseRpc: "ara_voucher_release_seat", redeemPath: "/ara/redeem",
  },
  persona: {
    key: "persona", codePrefix: "PER", table: "persona_vouchers", redemptionsTable: "persona_voucher_redemptions",
    claimRpc: "persona_voucher_claim", releaseRpc: "persona_voucher_release_seat", redeemPath: "/ac/persona/redeem",
  },
  cognitive: {
    key: "cognitive", codePrefix: "LOG", table: "cognitive_vouchers", redemptionsTable: "cognitive_voucher_redemptions",
    claimRpc: "cognitive_voucher_claim", releaseRpc: "cognitive_voucher_release_seat", redeemPath: "/ac/cognitive/redeem",
  },
  fluent: {
    key: "fluent", codePrefix: "ENG", table: "eng_fluent_vouchers", redemptionsTable: "eng_fluent_voucher_redemptions",
    claimRpc: "eng_fluent_voucher_claim", releaseRpc: "eng_fluent_voucher_release_seat", redeemPath: "/ac/fluent/redeem",
  },
  technical: {
    key: "technical", codePrefix: "TEC", table: "technical_sandbox_vouchers", redemptionsTable: "technical_sandbox_voucher_redemptions",
    claimRpc: "technical_sandbox_voucher_claim", releaseRpc: "technical_sandbox_voucher_release", redeemPath: "/tech-sandbox/redeem",
  },
  prehire: {
    key: "prehire", codePrefix: "HIRE", table: "prehire_vouchers", redemptionsTable: "prehire_voucher_redemptions",
    claimRpc: "prehire_voucher_claim", releaseRpc: "prehire_voucher_release", redeemPath: "/prehire/redeem",
  },
  roleReadiness: {
    // No redemptions table: redeeming an RR voucher provisions an rr_candidates
    // row directly (src/lib/role-readiness/vouchers.ts), which carries the
    // redeemer's identity + access token. The previous value here named
    // "rr_voucher_redemptions" - a table that has never existed.
    key: "roleReadiness", codePrefix: "RR", table: "rr_vouchers", redemptionsTable: null,
    claimRpc: "rr_claim_voucher_seat", releaseRpc: "rr_release_voucher_seat", redeemPath: "/role-readiness/redeem",
  },
} as const satisfies Record<string, VoucherDescriptor>;

export type VoucherServiceKey = keyof typeof VOUCHER_DESCRIPTORS;
