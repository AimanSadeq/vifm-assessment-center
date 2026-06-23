"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

// A card whose body collapses behind a header (chevron toggle). Header stays
// visible when collapsed. Used to make editor sections + the voucher panel
// individually expand/collapse.
export function CollapsibleCard({
  title,
  icon: Icon,
  defaultOpen = true,
  subtitle,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl p-5 text-left hover:bg-muted/40"
      >
        <span className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-[#5391D5]" />} {title}
          </span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  );
}
