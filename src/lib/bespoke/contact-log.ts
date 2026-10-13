// Contact log per bundle person (00237): every invitation or reminder email the
// platform sends, and every manual chase (phone, WhatsApp, the client) an
// admin records. Feeds the follow-up list.

import { createServiceClient } from "@/lib/supabase/server";
import { normaliseEmail } from "./roster";

import { type ContactChannel, type ContactKind, type ContactHistoryRow } from "./contact-log-shared";

export * from "./contact-log-shared";

export type ContactEntry = {
  rosterId: string | null;
  candidateId: string | null;
  email: string;
  kind: ContactKind;
  channel: ContactChannel | null;
  note: string | null;
  ok?: boolean;
};

export async function logContacts(bundleId: string, entries: ContactEntry[], actorId: string | null): Promise<{ ok: true; count: number } | { error: string }> {
  if (entries.length === 0) return { ok: true, count: 0 };
  if (entries.length > 2000) return { error: "Up to 2,000 people at a time." };
  const sb = createServiceClient();
  const { error } = await sb.from("bundle_contact_log").insert(
    entries.map((e) => ({
      bespoke_service_id: bundleId,
      roster_id: e.rosterId,
      bundle_candidate_id: e.candidateId,
      email_norm: normaliseEmail(e.email),
      kind: e.kind,
      channel: e.channel,
      note: e.note?.trim() ? e.note.trim().slice(0, 500) : null,
      ok: e.ok ?? true,
      created_by: actorId,
    })),
  );
  if (error) return { error: error.message };
  return { ok: true, count: entries.length };
}

/** Contact history for one person (newest first). */
export async function loadContactHistory(bundleId: string, email: string): Promise<ContactHistoryRow[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_contact_log")
      .select("id, email_norm, kind, channel, note, ok, created_at, created_by")
      .eq("bespoke_service_id", bundleId)
      .eq("email_norm", normaliseEmail(email))
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as Array<Omit<ContactHistoryRow, "by"> & { created_by: string | null }>;
    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await sb.from("profiles").select("id, full_name, email").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name || p.email || "");
    }
    return rows.map(({ created_by, ...r }) => ({ ...r, by: created_by ? names.get(created_by) ?? null : null }));
  } catch {
    return [];
  }
}
