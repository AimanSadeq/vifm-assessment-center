// Counts of currently-seeded demo data, for the admin Demo-data panel. Tolerant:
// a missing table (un-applied migration) counts as 0 rather than throwing.

import { createServiceClient } from "@/lib/supabase/server";
import { DEMO_ORG_NAME, type DemoServiceCount } from "./constants";
import { DEMO_SERVICE_MODULES } from "./services";

type Sb = ReturnType<typeof createServiceClient>;

async function count(sb: Sb, table: string, col: string, val: string): Promise<number> {
  try {
    const { count: n } = await sb.from(table).select("id", { count: "exact", head: true }).eq(col, val);
    return n ?? 0;
  } catch {
    return 0;
  }
}

export type DemoStatus = { orgPresent: boolean; organizationId: string | null; counts: DemoServiceCount[] };

export async function getDemoStatus(): Promise<DemoStatus> {
  const sb = createServiceClient();
  const [orgRow, araRow] = await Promise.all([
    sb.from("organizations").select("id").eq("name", DEMO_ORG_NAME).maybeSingle(),
    sb.from("ara_organizations").select("id").eq("name", DEMO_ORG_NAME).maybeSingle(),
  ]);
  const orgId = (orgRow.data?.id as string) ?? null;
  const araId = (araRow.data?.id as string) ?? null;
  const counts: DemoServiceCount[] = [];
  if (orgId) {
    counts.push({ service: "ac", label: "Assessment Center engagements", count: await count(sb, "engagements", "organization_id", orgId) });
    counts.push({ service: "prehire", label: "Pre-Hire requisitions", count: await count(sb, "prehire_requisitions", "organization_id", orgId) });
    counts.push({ service: "fluent", label: "Fluent placement results", count: await count(sb, "eng_fluent_results", "organization_id", orgId) });
    const org = { organizationId: orgId, araOrganizationId: araId ?? "" };
    for (const m of DEMO_SERVICE_MODULES) {
      try {
        const c = await m.count(sb, org);
        if (c) counts.push(c);
      } catch {
        /* a module's count is best-effort */
      }
    }
  }
  return { orgPresent: !!orgId, organizationId: orgId, counts };
}
