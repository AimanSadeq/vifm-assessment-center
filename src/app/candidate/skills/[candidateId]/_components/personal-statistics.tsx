"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Recharts' ResponsiveContainer caches its internal width/height from
  // the first measurement of its parent. On initial hydration the
  // parent grid cell often reports 0px before flexbox/grid layout
  // settles, so the container caches 0×0 and the chart paths render
  // empty even after a later resize event. Bumping a `chartKey` after
  // a short delay fully remounts the chart subtree so it remeasures
  // from a settled layout.
  const [chartKey, setChartKey] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setChartKey(1), 100);
    return () => window.clearTimeout(id);
  }, []);
  const total = assessed + notAssessed;
  // `kind` is a locale-stable discriminator so the Cell fill below picks
  // the right colour under both en and ar - comparing the localized
  // `name` directly miscolours the donut in Arabic (both slices grey).
  const progressData: Array<{
    name: string;
    value: number;
    kind: "assessed" | "notAssessed" | "placeholder";
  }> =
    total === 0
      ? [{ name: t("candidateSkills.notYetAssessed"), value: 1, kind: "placeholder" }]
      : [
          { name: t("candidateSkills.stats.legendAssessed"), value: assessed, kind: "assessed" },
          { name: t("candidateSkills.stats.legendNotAssessed"), value: notAssessed, kind: "notAssessed" },
        ];

  // Filter out empty domains so the category donut only shows what's actually
  // in this role profile (some profiles intentionally skip domains).
  const categoryData = byDomain.filter((d) => d.count > 0);

  // Bar chart data - null avgScore means "no data yet"; we render the bar at
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
          {t("candidateSkills.stats.eyebrow")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("candidateSkills.stats.subtitle")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Donut 1 - Assessment Progress */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">{t("candidateSkills.stats.progressTitle")}</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t("candidateSkills.stats.progressBlurb")}
          </p>
          <div className="h-44">
            <ResponsiveContainer key={chartKey} width="100%" height="100%">
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
                        entry.kind === "assessed"
                          ? PROGRESS_COLOURS.assessed
                          : PROGRESS_COLOURS.notAssessed
                      }
                    />
                  ))}
                </Pie>
                {anyAssessed && (
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(value, name) => [`${value} ${t("candidateSkills.stats.skillsLabel")}`, String(name)]}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PROGRESS_COLOURS.assessed }} />
              {t("candidateSkills.stats.legendAssessed")} {assessed}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PROGRESS_COLOURS.notAssessed }} />
              {t("candidateSkills.stats.legendNotAssessed")} {notAssessed}
            </span>
          </div>
        </div>

        {/* Donut 2 - Skills by Category */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">{t("candidateSkills.stats.byDomainTitle")}</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t("candidateSkills.stats.byDomainBlurb")}
          </p>
          <div className="h-44">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                {t("candidateSkills.stats.noProfileSkills")}
              </div>
            ) : (
              <ResponsiveContainer key={chartKey} width="100%" height="100%">
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
                    formatter={(value, name) => [`${value} ${t("candidateSkills.stats.skillsLabel")}`, String(name)]}
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
                {t(`domainNames.${d.name}`)} {d.count}
              </span>
            ))}
          </div>
        </div>

        {/* Bar - Average Score by Domain */}
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm font-semibold mb-1">{t("candidateSkills.stats.avgByDomainTitle")}</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t("candidateSkills.stats.avgByDomainBlurb")}
          </p>
          <div className="h-44">
            <ResponsiveContainer key={chartKey} width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{
                  top: 4,
                  // Flip the negative inset based on locale: under LTR the
                  // Y-axis sits on the left and we tighten the left margin;
                  // under RTL the Y-axis sits on the right and we mirror.
                  right: isAr ? -16 : 4,
                  bottom: 0,
                  left: isAr ? 4 : -16,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(name) => t(`domainNames.${name}`)}
                  reversed={isAr}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  orientation={isAr ? "right" : "left"}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(value, _name, props) => {
                    const hasData = (props?.payload as { hasData?: boolean } | undefined)?.hasData;
                    if (!hasData) return [t("candidateSkills.stats.tooltipNotYetAssessed"), t("candidateSkills.stats.scoreLabel")];
                    return [typeof value === "number" ? value.toFixed(1) : String(value), t("candidateSkills.stats.scoreLabel")];
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
