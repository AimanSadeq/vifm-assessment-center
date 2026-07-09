/**
 * Admin-configurable assessment time limits (migration 00083).
 *
 * One keyed table, `assessment_timers`, holds the time limit for every
 * assessment. `scope` is the key:
 *   - type-level:  'quiz', 'fluent'
 *   - per-instance: 'ara:<assessmentId>', 'tech_domain:<key>', 'tech_function:<id>'
 * `minutes === null` means "no time limit". Every reader is tolerant of the
 * table being absent (migration not applied) and falls back to a code default.
 */
import { createServiceClient } from "@/lib/supabase/server";

/** Code defaults used when a scope row is absent or the table is not migrated. */
export const TIMER_DEFAULTS = {
  quiz: 5,
  fluent: 15,
  // The reviewed bank serves a fixed 9-item form per subtest (up to 36 for the
  // full 4-subtest battery), so the default is generous enough not to auto-fail a
  // full sitting; admins can tune per scope in `assessment_timers`. Backstop only.
  cognitive: 40,
} as const;

/** Resolved value: a positive minute count, or null for "no time limit". */
export type TimerMinutes = number | null;

/**
 * The time limit (minutes) for a scope. Returns `fallback` when the row is
 * absent or the table is not migrated; returns null when the admin set "no
 * limit" for that scope.
 */
export async function getTimerMinutes(scope: string, fallback: TimerMinutes): Promise<TimerMinutes> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("assessment_timers")
      .select("minutes")
      .eq("scope", scope)
      .maybeSingle();
    if (error || !data) return fallback;
    return data.minutes == null ? null : Number(data.minutes);
  } catch {
    return fallback;
  }
}

/** Batch read several scopes at once (for an admin settings page). */
export async function getTimersMap(scopes: string[]): Promise<Record<string, TimerMinutes>> {
  const out: Record<string, TimerMinutes> = {};
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("assessment_timers").select("scope, minutes").in("scope", scopes);
    for (const r of (data as { scope: string; minutes: number | null }[] | null) ?? []) {
      out[r.scope] = r.minutes == null ? null : Number(r.minutes);
    }
  } catch {
    /* not migrated - empty, callers fall back to defaults */
  }
  return out;
}

/**
 * Upsert a timer for a scope. `minutes` null = no limit. Service-role write;
 * callers must gate on admin first. Returns ok/error. Tolerant of the table
 * being absent (returns an error the caller can surface).
 */
export async function setTimerMinutes(scope: string, minutes: TimerMinutes): Promise<{ ok: boolean; error?: string }> {
  const clean = minutes == null ? null : Math.max(1, Math.min(600, Math.round(minutes)));
  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("assessment_timers")
      .upsert({ scope, minutes: clean, updated_at: new Date().toISOString() }, { onConflict: "scope" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "save failed" };
  }
}
