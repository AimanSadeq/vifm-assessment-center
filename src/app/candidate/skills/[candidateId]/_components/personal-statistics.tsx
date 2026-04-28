"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Domain palette matches the H1 DomainTallyCard tones so admins and
// candidates see the same colour for the same VIFM domain everywhere.
const DOMAIN_COLOURS: Record<string, string> = {
  THINKING: "#5391D5",
  RESULTS:  "#047857",
  PEOPLE:   "#c2410c",
  SELF:     "#6d28d9",
};

const DOMAIN_FALLBACK = "#6b7280";

const PROGRESS_COLOURS = {
  assessed: "#5391D5",
  notAssessed: "#e5e7eb",
};

export type DomainRollup = {
  name: string;
  count: number;
  avgScore: number | null;
};

export type PersonalStatisticsProps = {
  assessed: number;
  notAssessed: number;
  byDomain: DomainRollup[];
};

export function PersonalStatistics({
  assessed,
  notAssessed,
  byDomain,
}: PersonalStatisticsProps) {
  const total = assessed + notAssessed;
  const progressData =
    total === 0
      ? [{ name: "Awaiting first assessment", value: 1, _placeholder: true }]
      : [
          { name: "Assessed", value: assessed },
          { name: "Not Assessed", value: notAssessed },
        ];

  // Filter out empty domains so the category donut only shows what's actually
  // in this role profile (some profiles intentionally skip domains).
  const categoryData = byDomain.filter((d) => d.count > 0);

  // Bar chart data — null avgScore means "no data yet"; we render the bar at
  // 0 with a tooltip note. Keeping all 4 bars on the X-axis lets the user
  // see at a glance that "Average Score" exists for every domain in the role.
  const barData = byDomain.map((d) => ({
    name: d.name,
    score: d.avgScore ?? 0,
    hasData: d.avgScore !== null,
  }));

  const anyAssessed = assessed > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Personal Statistics
        </p>
        <p className="text-[11px] text-muted-foreground">
          Based on consensus ratings from your assessment
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Donut 1 — Assessment Progress */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">Assessment Progress</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            How much of your role profile has been assessed.
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={progressData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={anyAssessed && notAssessed > 0 ? 2 : 0}
                  stroke="none"
                >
                  {progressData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        "_placeholder" in entry
                          ? PROGRESS_COLOURS.notAssessed
                          : entry.name === "Assessed"
                            ? PROGRESS_COLOURS.assessed
                            : PROGRESS_COLOURS.notAssessed
                      }
                    />
                  ))}
                </Pie>
                {anyAssessed && (
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(value, name) => [`${value} skills`, String(name)]}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PROGRESS_COLOURS.assessed }} />
              Assessed {assessed}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PROGRESS_COLOURS.notAssessed }} />
              Not Assessed {notAssessed}
            </span>
          </div>
        </div>

        {/* Donut 2 — Skills by Category */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">Skills by Domain</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            How your role profile is distributed across the VIFM framework.
          </p>
          <div className="h-44">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                No competencies in this profile.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={DOMAIN_COLOURS[entry.name] ?? DOMAIN_FALLBACK} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(value, name) => [`${value} skills`, String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
            {categoryData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: DOMAIN_COLOURS[d.name] ?? DOMAIN_FALLBACK }}
                />
                {d.name} {d.count}
              </span>
            ))}
          </div>
        </div>

        {/* Bar — Average Score by Domain */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">Average Score by Domain</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            Your average BARS score (1–5) per VIFM domain. 0 = not yet assessed.
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} fontSize={10} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(value, _name, props) => {
                    const hasData = (props?.payload as { hasData?: boolean } | undefined)?.hasData;
                    if (!hasData) return ["Not yet assessed", "Score"];
                    return [typeof value === "number" ? value.toFixed(1) : String(value), "Score"];
                  }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={DOMAIN_COLOURS[entry.name] ?? DOMAIN_FALLBACK} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
