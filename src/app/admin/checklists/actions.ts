"use server";

/**
 * Ticking an engagement checklist item. Admins may tick any; a consultant may
 * tick the checklist of an AI Readiness assessment or a Reflect 360
 * engagement they own. Automatic items are computed, so a tick on one is only
 * ever a person's word that the record cannot see; it is stored and shown as
 * manual.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { CHECKLISTS, isChecklistService } from "@/lib/checklists/definitions";
import { canManageChecklist } from "@/lib/checklists/load";

export async function setChecklistItemAction(values: {
  service: string;
  subjectId: string;
  itemKey: string;
  done: boolean;
  note?: string;
}) {
  const caller = await getCurrentCaller();
  if (!caller) return { error: "Sign in first." };
  if (!isChecklistService(values.service)) return { error: "Unknown service." };
  const service = values.service;
  if (!CHECKLISTS[service].items.some((i) => i.key === values.itemKey)) return { error: "Unknown checklist item." };

  const sb = createServiceClient();
  if (caller.role !== "admin") {
    let consultantId: string | null = null;
    if (service === "arc") {
      const { data: a } = await sb.from("ara_assessments").select("consultant_id").eq("id", values.subjectId).maybeSingle();
      consultantId = (a?.consultant_id as string | null) ?? null;
    } else if (service === "reflect") {
      const { data: e } = await sb.from("reflect_engagements").select("consultant_id").eq("id", values.subjectId).maybeSingle();
      consultantId = (e?.consultant_id as string | null) ?? null;
    }
    if (!canManageChecklist(caller, service, { consultantId })) {
      return { error: service === "arc" || service === "reflect" ? "You can only tick the checklist of an engagement you own." : "Only admins can tick this checklist." };
    }
  }

  let name: string | null = null;
  if (!caller.isDev) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", caller.uid).maybeSingle();
    name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }
  const note = (values.note ?? "").trim() || null;
  const { error } = await sb.from("service_checklist_items").upsert(
    {
      service_key: service,
      subject_id: values.subjectId,
      item_key: values.itemKey,
      done_at: values.done ? new Date().toISOString() : null,
      done_by: values.done && !caller.isDev ? caller.uid : null,
      done_by_name: values.done ? name ?? "VIFM" : null,
      note,
    },
    { onConflict: "service_key,subject_id,item_key" }
  );
  if (error) {
    if (/service_checklist_items/.test(error.message)) return { error: "Apply migration 00231 first." };
    if (/service_key_check/.test(error.message)) return { error: "Apply migration 00232 first." };
    return { error: error.message };
  }
  return { ok: true };
}
