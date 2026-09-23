/**
 * Types and labels for the voucher register, kept free of server imports so the
 * client-side table can use them without pulling the service client into the
 * browser bundle.
 */

export type RegisterService =
  | "arc"
  | "technical"
  | "fluent"
  | "cognitive"
  | "persona"
  | "prehire"
  | "role_readiness"
  | "bundle";

export const REGISTER_SERVICES: RegisterService[] = [
  "arc",
  "technical",
  "fluent",
  "cognitive",
  "persona",
  "prehire",
  "role_readiness",
  "bundle",
];

export const REGISTER_SERVICE_LABEL: Record<RegisterService, string> = {
  arc: "AI Readiness Compass",
  technical: "Techno",
  fluent: "Fluent",
  cognitive: "Logica",
  persona: "Persona",
  prehire: "Pre-Hire",
  role_readiness: "Role Readiness",
  bundle: "Bundle",
};

/**
 * Where a voucher stands, derived from usage and expiry rather than trusted
 * from a status column, because two of the eight tables have no status column
 * and the others do not agree on their vocabulary.
 */
export type RegisterStatus = "unused" | "partly_redeemed" | "fully_redeemed" | "expired" | "revoked";

export const REGISTER_STATUS_LABEL: Record<RegisterStatus, string> = {
  unused: "Not redeemed",
  partly_redeemed: "Partly redeemed",
  fully_redeemed: "Fully redeemed",
  expired: "Expired",
  revoked: "Revoked",
};

export type VoucherRegisterRow = {
  id: string;
  service: RegisterService;
  code: string;
  label: string | null;
  /** What the code is for within its service - a function, a role, a requisition, a bundle. */
  scope: string | null;
  company: string;
  seats: number;
  redeemed: number;
  status: RegisterStatus;
  issuedBy: string;
  issuedByRole: string | null;
  issuedAt: string;
  expiresAt: string | null;
  isSample: boolean;
};

export type VoucherRegister = {
  rows: VoucherRegisterRow[];
  /** Services whose table could not be read in this environment. */
  unavailable: RegisterService[];
  loadedAt: string;
};
