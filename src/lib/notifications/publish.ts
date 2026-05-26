"use server";

import { createServiceClient } from "@/lib/supabase/server";
import type { Notification, NotificationKind } from "@/types/database";

/**
 * Publishes an in-app notification to a single profile. Service-role
 * client because publishers usually run from server actions where the
 * caller's RLS would block writes for other users (e.g. when the
 * assessor finalises a wash-up, they're notifying the *candidate*).
 *
 * Failures are logged but never thrown - a notification is a nicety,
 * never block the actual save flow if publishing fails.
 */
export async function publishNotification(input: {
  profileId: string;
  kind: NotificationKind | string;
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Record<string, unknown>;
}) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("notifications").insert({
      profile_id: input.profileId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      data: input.data ?? {},
    });
    if (error) {
      console.error("[notifications.publish] insert failed:", error);
    }
  } catch (err) {
    console.error("[notifications.publish] threw:", err);
  }
}

/**
 * Fan-out to every admin profile. Used when a candidate completes a
 * quiz, a role profile is auto-extracted, etc - events the whole admin
 * team probably wants to see.
 *
 * Optional `dedupeKey` + `dedupeWindowHours` skips the publish if a
 * notification of the same `kind` with the same `data.dedupeKey` was
 * created within the window. Use it to suppress retake-spam, e.g.
 * passing `dedupeKey: "quiz_completed:<candId>:<compId>"` means a
 * candidate retaking the same quiz five times in a day produces one
 * notification, not five.
 */
export async function publishToAllAdmins(input: {
  kind: NotificationKind | string;
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  /** Defaults to 24 hours when dedupeKey is provided. */
  dedupeWindowHours?: number;
}) {
  try {
    const supabase = createServiceClient();

    if (input.dedupeKey) {
      const windowHours = input.dedupeWindowHours ?? 24;
      const cutoffIso = new Date(
        Date.now() - windowHours * 60 * 60 * 1000
      ).toISOString();
      const { data: existing, error: dupErr } = await supabase
        .from("notifications")
        .select("id")
        .eq("kind", input.kind)
        .eq("data->>dedupeKey", input.dedupeKey)
        .gte("created_at", cutoffIso)
        .limit(1);
      if (dupErr) {
        console.error("[notifications.publishToAllAdmins] dedupe check failed:", dupErr);
        // Fall through and publish anyway - better to over-notify than to
        // silently drop a notification because of a transient query error.
      } else if (existing && existing.length > 0) {
        return;
      }
    }

    const { data: admins, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (error) {
      console.error("[notifications.publishToAllAdmins] fetch failed:", error);
      return;
    }
    if (!admins || admins.length === 0) return;

    // Embed the dedupeKey inside `data` so the dedupe check above can
    // find it on subsequent calls. The recipient never sees it directly.
    const dataWithKey = input.dedupeKey
      ? { ...(input.data ?? {}), dedupeKey: input.dedupeKey }
      : (input.data ?? {});

    const rows = admins.map((a: { id: string }) => ({
      profile_id: a.id,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      data: dataWithKey,
    }));
    const { error: insertErr } = await supabase.from("notifications").insert(rows);
    if (insertErr) {
      console.error("[notifications.publishToAllAdmins] insert failed:", insertErr);
    }
  } catch (err) {
    console.error("[notifications.publishToAllAdmins] threw:", err);
  }
}

/**
 * Loader for the client bell. Returns the most recent 20 notifications
 * for the current user plus the unread count. Tolerant of the table
 * not existing yet (returns empty + disabled flag) so the bell renders
 * gracefully in fresh dev environments.
 */
export async function loadMyNotificationsAction(): Promise<
  { notifications: Notification[]; unreadCount: number; available: boolean }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === "42P01" || error.code === "42501") {
      return { notifications: [], unreadCount: 0, available: false };
    }
    console.error("[loadMyNotificationsAction] failed:", error);
    return { notifications: [], unreadCount: 0, available: false };
  }

  const notifications = (data ?? []) as Notification[];
  const unreadCount = notifications.filter((n) => n.read_at === null).length;
  return { notifications, unreadCount, available: true };
}

export async function markNotificationReadAction(notificationId: string) {
  // Uses the caller's RLS-aware client - the policy ensures a user can
  // only mark their own notifications read.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  if (error) return { error: error.message };
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { error: error.message };
  return { success: true };
}
