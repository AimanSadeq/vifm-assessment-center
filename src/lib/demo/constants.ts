// One-click demo-data tool (BD pitch aid). Everything seeded is tagged so the
// matching purge can find and remove it without touching real client data:
//  - org-scoped rows hang off the demo organization (found by DEMO_SENTINEL in
//    its name, present in BOTH org stores);
//  - non-org-scoped rows carry a sentinel in a name/email field.
// The demo org is a fictional GCC bank so the screens read realistically.

export const DEMO_SENTINEL = "Caliber Demo";
export const DEMO_ORG_NAME = "Najm Capital (Caliber Demo)";
export const DEMO_ORG_NAME_AR = "نجم كابيتال (عرض كاليبر)";
export const DEMO_INDUSTRY = "Banking";
export const DEMO_COUNTRY = "Saudi Arabia";

// Sentinels for rows that are not organization-scoped.
export const DEMO_EMAIL_DOMAIN = "caliber-demo.local"; // demo people (candidates, assessor)
export const DEMO_TAG = "[Demo]"; // prefix on global rows (exercises, etc.)

export type DemoServiceCount = { service: string; label: string; count: number; note?: string };
export type DemoSeedOutcome = { service: string; label: string; created: number; note?: string };
