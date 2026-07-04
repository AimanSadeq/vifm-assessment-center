"use client";

import { useMemo, useState } from "react";
import { Search, GitCommit, User, MessageSquareQuote, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Shapes mirror scripts/generate-fix-register.mjs output.
export type FixEntry = {
  hash: string;
  short: string;
  date: string;
  author: string;
  requester: string | null;
  type: string;
  title: string;
  explanation: string;
  service: string;
};
export type FixService = {
  key: string;
  label: string;
  blurb: string;
  count: number;
  entries: FixEntry[];
};

const TYPE_META: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-rose-600 text-white" },
  security: { label: "Security", cls: "bg-amber-100 text-amber-800 border border-amber-200" },
  audit: { label: "Audit", cls: "bg-sky-100 text-sky-800 border border-sky-200" },
  fix: { label: "Fix", cls: "bg-slate-100 text-slate-700 border border-slate-200" },
  feature: { label: "Feature", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  change: { label: "Change", cls: "bg-slate-100 text-slate-600 border border-slate-200" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.change;

const TYPE_FILTERS = ["all", "critical", "security", "audit", "fix", "feature", "change"] as const;

export function FixRegisterClient({ services }: { services: FixService[] }) {
  const [service, setService] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return services
      .filter((s) => service === "all" || s.key === service)
      .map((s) => ({
        ...s,
        entries: s.entries.filter((e) => {
          if (type !== "all" && e.type !== type) return false;
          if (!q) return true;
          return (
            e.title.toLowerCase().includes(q) ||
            e.explanation.toLowerCase().includes(q) ||
            (e.requester ?? "").toLowerCase().includes(q) ||
            e.author.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((s) => s.entries.length > 0);
  }, [services, service, type, q]);

  const shown = filtered.reduce((n, s) => n + s.entries.length, 0);

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 space-y-3 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fixes, explanations, requester, author..."
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#5391D5]/40"
              aria-label="Search the fix register"
            />
          </div>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by service"
          >
            <option value="all">All services ({services.length})</option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({s.count})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((tf) => {
            const active = type === tf;
            const label = tf === "all" ? "All types" : typeMeta(tf).label;
            return (
              <button
                key={tf}
                onClick={() => setType(tf)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-[#010131] text-white"
                    : "border border-input bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-muted-foreground">{shown} shown</span>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No fixes match these filters.
        </p>
      )}

      {/* Per-service sections */}
      <div className="space-y-6">
        {filtered.map((s) => (
          <section key={s.key} className="rounded-xl border bg-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-[#010131]">{s.label}</h2>
                <p className="text-xs text-muted-foreground">{s.blurb}</p>
              </div>
              <span className="rounded-full bg-[#5391D5]/10 px-2.5 py-0.5 text-xs font-semibold text-[#2b6cb0]">
                {s.entries.length}{s.entries.length !== s.count ? ` / ${s.count}` : ""} entries
              </span>
            </header>
            <ul className="divide-y">
              {s.entries.map((e) => (
                <li key={e.hash}>
                  <EntryRow entry={e} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: FixEntry }) {
  const [open, setOpen] = useState(false);
  const meta = typeMeta(entry.type);
  const hasBody = entry.explanation.length > 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <time className="mt-0.5 w-[86px] shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{entry.date}</time>
        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.cls)}>{meta.label}</span>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => hasBody && setOpen((o) => !o)}
            className={cn("group flex w-full items-start gap-1.5 text-left", hasBody ? "cursor-pointer" : "cursor-default")}
            aria-expanded={hasBody ? open : undefined}
          >
            {hasBody && (
              <ChevronRight className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
            )}
            <span className={cn("text-sm font-medium text-[#111232]", !hasBody && "ms-5")}>{entry.title}</span>
          </button>

          <div className="ms-5 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {entry.author}</span>
            {entry.requester && (
              <span className="inline-flex items-center gap-1 text-[#2b6cb0]">
                <MessageSquareQuote className="h-3 w-3" /> Requested by {entry.requester}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-mono"><GitCommit className="h-3 w-3" /> {entry.short}</span>
          </div>

          {hasBody && open && (
            <pre className="ms-5 mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-[#26324a]">{entry.explanation}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
