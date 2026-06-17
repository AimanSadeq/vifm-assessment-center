// Shared loader: competency id -> framework definition (description). Used to
// surface "what this competency means" on the Persona result + report. Service
// role read; tolerant (returns {} on any error).
import { createServiceClient } from "@/lib/supabase/server";

export async function loadCompetencyDefinitions(): Promise<Record<string, string>> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("competencies").select("id, description");
    const out: Record<string, string> = {};
    for (const c of data ?? []) {
      if (c.description) out[c.id as string] = String(c.description);
    }
    return out;
  } catch {
    return {};
  }
}
