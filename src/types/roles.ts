export const USER_ROLES = [
  "admin",
  "lead_assessor",
  "associate_assessor",
  "candidate",
  "client",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
