"use client";

import { Badge } from "@/components/ui/badge";

type Candidate = {
  name: string;
  performance: number;
  potential: number;
  recommendation: string | null;
};

type Props = {
  data: Candidate[];
};

const GRID_LABELS = [
  ["Enigma", "Growth Employee", "Future Star"],
  ["Under Performer", "Core Employee", "High Performer"],
  ["Risk", "Average Performer", "Trusted Professional"],
];

const GRID_COLORS = [
  ["bg-amber-50 border-amber-200", "bg-blue-50 border-blue-200", "bg-emerald-50 border-emerald-200"],
  ["bg-red-50 border-red-200", "bg-slate-50 border-slate-200", "bg-blue-50 border-blue-200"],
  ["bg-red-100 border-red-300", "bg-amber-50 border-amber-200", "bg-slate-50 border-slate-200"],
];

function getBox(performance: number, potential: number): [number, number] {
  const row = performance >= 4 ? 0 : performance >= 2.5 ? 1 : 2;
  const col = potential >= 4 ? 2 : potential >= 2.5 ? 1 : 0;
  return [row, col];
}

export function NineBoxGrid({ data }: Props) {
  // Bucket candidates into 3x3 grid
  const grid: Candidate[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => [])
  );

  for (const c of data) {
    const [row, col] = getBox(c.performance, c.potential);
    grid[row][col].push(c);
  }

  return (
    <div className="space-y-2">
      {/* Axis labels */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span className="w-20 text-right font-medium">Performance</span>
        <div className="flex-1" />
      </div>

      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between w-20 text-xs text-right text-muted-foreground py-1">
          <span>High (4-5)</span>
          <span>Medium (2.5-4)</span>
          <span>Low (1-2.5)</span>
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-rows-3 gap-1.5">
          {grid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-1.5">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className={`border rounded-lg p-2 min-h-[80px] ${GRID_COLORS[ri][ci]}`}
                >
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    {GRID_LABELS[ri][ci]}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cell.map((c) => (
                      <Badge
                        key={c.name}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {c.name.length > 15 ? c.name.slice(0, 15) + "..." : c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-2">
        <div className="w-20" />
        <div className="flex-1 grid grid-cols-3 text-xs text-center text-muted-foreground">
          <span>Low (1-2.5)</span>
          <span>Medium (2.5-4)</span>
          <span>High (4-5)</span>
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground font-medium">Potential</div>
    </div>
  );
}
