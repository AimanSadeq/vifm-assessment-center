"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, Check, CheckCheck } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  loadMyNotificationsAction,
} from "@/lib/notifications/publish";
import type { Notification } from "@/types/database";

type Props = {
  emptyState?: string;
};

/** Relative time formatter without bringing in a date-fns dependency. */
function buildRelativeTime(t: (key: string, vars?: Record<string, string | number>) => string) {
  return (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return t("notifications.time.justNow");
    const m = Math.floor(s / 60);
    if (m < 60) return t("notifications.time.minutesAgo", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("notifications.time.hoursAgo", { n: h });
    const d = Math.floor(h / 24);
    if (d < 7) return t("notifications.time.daysAgo", { n: d });
    const w = Math.floor(d / 7);
    if (w < 5) return t("notifications.time.weeksAgo", { n: w });
    return fmtDate(iso);
  };
}

export function NotificationBellClient({
  emptyState,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const relativeTime = buildRelativeTime(t);
  const resolvedEmptyState = emptyState ?? t("notifications.emptyState");
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [available, setAvailable] = useState(true);
  const [, startTransition] = useTransition();
  const [optimisticRead, setOptimisticRead] = useState<Set<string>>(new Set());
  const [bulkRead, setBulkRead] = useState(false);

  // Load on mount + whenever the popover opens (cheap refresh).
  useEffect(() => {
    let cancelled = false;
    loadMyNotificationsAction().then((result) => {
      if (cancelled) return;
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setAvailable(result.available);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const disabled = !available;
  const visibleUnread = bulkRead
    ? 0
    : Math.max(0, unreadCount - optimisticRead.size);

  const handleClickItem = (n: Notification) => {
    if (n.read_at === null && !optimisticRead.has(n.id)) {
      setOptimisticRead((s) => new Set(s).add(n.id));
      startTransition(async () => {
        const result = await markNotificationReadAction(n.id);
        if ("error" in result && result.error) {
          // roll back the optimistic flag
          setOptimisticRead((s) => {
            const next = new Set(s);
            next.delete(n.id);
            return next;
          });
        } else {
          router.refresh();
        }
      });
    }
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    setBulkRead(true);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if ("error" in result && result.error) {
        setBulkRead(false);
        toast.error(typeof result.error === "string" ? result.error : t("notifications.markAllReadFail"));
        return;
      }
      router.refresh();
    });
  };

  const Icon = visibleUnread > 0 ? BellRing : Bell;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={
            visibleUnread > 0
              ? t("notifications.ariaLabelWithUnread", { count: visibleUnread })
              : t("notifications.ariaLabel")
          }
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon className="h-5 w-5" />
          {visibleUnread > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold leading-none">
              {visibleUnread > 9 ? "9+" : visibleUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">{t("notifications.header")}</p>
          {visibleUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {resolvedEmptyState}
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            <ul className="divide-y">
              {notifications.map((n) => {
                const isUnread =
                  n.read_at === null && !optimisticRead.has(n.id) && !bulkRead;
                const item = (
                  <div
                    className={`px-3 py-2.5 cursor-pointer hover:bg-muted/50 ${
                      isUnread ? "bg-accent/5" : ""
                    }`}
                    onClick={() => handleClickItem(n)}
                  >
                    <div className="flex items-start gap-2">
                      {isUnread && (
                        <span className="inline-block h-2 w-2 rounded-full bg-accent shrink-0 mt-1.5" />
                      )}
                      <div className={isUnread ? "flex-1" : "flex-1 ms-4"}>
                        <p className={`text-sm leading-snug ${isUnread ? "font-semibold" : ""}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                      {!isUnread && (
                        <Check className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className="block">
                        {item}
                      </Link>
                    ) : (
                      item
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
