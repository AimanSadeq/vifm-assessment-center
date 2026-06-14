// Framework showcase (server component): all 9 domains and their functions, with
// active (live) functions expanded to show pillars -> competencies/skill blocks
// and a "Preview" action. For demonstrating the breadth to a client, then
// drilling into the live one.
import type { OverviewDomain } from "@/lib/technical-sandbox/service";
import { PreviewButton } from "./preview-button";

const ENGINE_LABEL: Record<string, string> = {
  spreadsheet: "Spreadsheet",
  advanced_spreadsheet: "Spreadsheet (data table)",
  logic_input: "Calculation input",
  sql: "SQL",
  python: "Python",
};

export function FrameworkOverview({ domains }: { domains: OverviewDomain[] }) {
  const activeCount = domains.reduce(
    (n, d) => n + d.functions.filter((f) => f.status === "active").length,
    0,
  );
  const totalCount = domains.reduce((n, d) => n + d.functions.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {domains.length} domains · {totalCount} functions · {activeCount} live now (the rest are
        on the roadmap). Live functions show their competencies and can be previewed.
      </p>

      {domains.map((d) => (
        <div key={d.key} className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#5391D5]">
            {d.nameEn}
          </h3>
          <ul className="space-y-2">
            {d.functions.map((f) => (
              <li key={f.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">
                    <span className="font-mono text-xs text-muted-foreground">{f.nodeId}</span>{" "}
                    {f.nameEn}
                  </span>
                  {f.status === "active" ? (
                    <span className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Live
                      </span>
                      <PreviewButton functionId={f.id} />
                    </span>
                  ) : (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </div>

                {f.status === "active" && f.pillars.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-s-2 border-[#5391D5]/30 ps-3">
                    {f.pillars.map((p) => (
                      <div key={p.nameEn}>
                        <div className="text-xs font-medium text-foreground">{p.nameEn}</div>
                        <ul className="ms-2 mt-0.5 space-y-0.5">
                          {p.blocks.map((b) => (
                            <li key={b.nameEn} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>• {b.nameEn}</span>
                              <span className="text-[10px]">
                                {ENGINE_LABEL[b.engineType] ?? b.engineType}
                                {b.frameworkRef ? ` · ${b.frameworkRef}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
