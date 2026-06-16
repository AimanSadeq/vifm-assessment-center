"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LucideIcon } from "lucide-react";

/**
 * Header badge showing the signed-in user's name (from the Supabase session),
 * falling back to a role label only until the user resolves / if absent. Mirrors
 * the sidebar footer's identity read; used in the assessor + client portal headers
 * so they show who is logged in rather than a static "Assessor" / "Client" label.
 */
export function CurrentUserBadge({
  Icon,
  fallbackLabel,
  iconWrapClass = "bg-primary/10",
  iconClass = "text-primary",
}: {
  Icon: LucideIcon;
  fallbackLabel: string;
  iconWrapClass?: string;
  iconClass?: string;
}) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setName((u.user_metadata?.full_name as string) || u.email || null);
    });
  }, []);

  return (
    <div className="hidden md:flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconWrapClass}`}>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <span className="text-sm text-muted-foreground">{name ?? fallbackLabel}</span>
    </div>
  );
}
