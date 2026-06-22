// Per-service demo-data module. Each service implements this so the seeder,
// purge and status panel can iterate a registry instead of hard-coding every
// service. seed/purge/count receive the demo org ids (both stores) + the shared
// service-role client. All three are best-effort + tolerant.

import type { createServiceClient } from "@/lib/supabase/server";
import type { DemoSeedOutcome, DemoServiceCount } from "../constants";

export type DemoSb = ReturnType<typeof createServiceClient>;
export type DemoOrgIds = { organizationId: string; araOrganizationId: string };

export type DemoServiceModule = {
  id: string;
  label: string;
  /** Create one realistic demo example tied to the demo org. Idempotent
   *  (skip/no-op if this service already has demo rows). */
  seed: (sb: DemoSb, org: DemoOrgIds) => Promise<DemoSeedOutcome>;
  /** Remove this service's demo rows (FK-safe). Returns a short note. */
  purge: (sb: DemoSb, org: DemoOrgIds) => Promise<string>;
  /** Count this service's seeded demo rows for the status panel, or null. */
  count: (sb: DemoSb, org: DemoOrgIds) => Promise<DemoServiceCount | null>;
};
