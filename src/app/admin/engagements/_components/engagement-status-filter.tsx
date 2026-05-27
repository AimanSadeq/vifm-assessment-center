"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  counts: { all: number; draft: number; active: number; completed: number };
  activeFilter: string;
};

const FILTERS = [
  { key: "all", labelKey: "adminEngagements.filter.all", variant: "outline" as const },
  { key: "draft", labelKey: "adminEngagements.filter.draft", variant: "secondary" as const },
  { key: "active", labelKey: "adminEngagements.filter.active", variant: "default" as const },
  { key: "completed", labelKey: "adminEngagements.filter.completed", variant: "outline" as const },
];

export function EngagementStatusFilter({ counts, activeFilter }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex gap-2">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === "all" ? "/admin/engagements" : `/admin/engagements?status=${f.key}`}
        >
          <Badge
            variant={f.variant}
            className={cn(
              "text-xs cursor-pointer transition-opacity",
              activeFilter === f.key ? "ring-2 ring-primary/30" : "opacity-60 hover:opacity-100"
            )}
          >
            {t(f.labelKey)} ({counts[f.key as keyof typeof counts]})
          </Badge>
        </Link>
      ))}
    </div>
  );
}
