"use client";
// Collapsible card for the distribution options (direct link / vouchers). Header
// toggles; content is kept mounted (hidden) so form state survives a collapse.
import { useState, type ReactNode } from "react";
import { ChevronDown, Link2, Ticket, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { link: Link2, ticket: Ticket };
const TONES: Record<string, { border: string; chip: string }> = {
  blue: { border: "border-[#5391D5]", chip: "bg-[#5391D5]/10 text-[#5391D5]" },
  green: { border: "border-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
};

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  tone = "blue",
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: "link" | "ticket";
  tone?: "blue" | "green";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = icon ? ICONS[icon] : null;
  const t = TONES[tone] ?? TONES.blue;

  return (
    <div className={`overflow-hidden rounded-xl border bg-card transition ${open ? t.border : "border-border"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start transition hover:bg-muted/40"
      >
        {Icon && (
          <span className={`inline-flex shrink-0 rounded-lg p-2 ${t.chip}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-foreground" : ""}`}
        />
      </button>
      <div className={open ? "border-t border-border p-4" : "hidden"}>{children}</div>
    </div>
  );
}
