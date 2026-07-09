"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type DonutDatum = { name: string; value: number; color: string };

/** Donut of proposal counts by status, with the total in the centre. */
export function PipelineDonut({ data, total }: { data: DonutDatum[]; total: number }) {
  const nonZero = data.filter((d) => d.value > 0);
  if (total === 0 || nonZero.length === 0) {
    return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No proposals yet</div>;
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
            {nonZero.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [`${Number(v)} proposal${Number(v) === 1 ? "" : "s"}`, n]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-[#010131]">{total}</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Proposals</span>
      </div>
    </div>
  );
}
