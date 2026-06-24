"use client";
// Logic Input Field Array engine (e.g. FP&A 2.1 Price-Volume-Mix). Renders the
// scenario read-only and collects numeric answers into { fields: {...} }.
import { useState } from "react";

interface Field {
  id: string;
  label_en: string;
  label_ar?: string;
  type?: string;
}
interface Product {
  name: string;
  budget_price: number;
  budget_vol: number;
  actual_price: number;
  actual_vol: number;
}
export interface LogicInputProps {
  config: {
    scenario?: {
      products?: Product[];
      budget_revenue?: number;
      actual_revenue?: number;
      total_variance?: number;
      note_en?: string;
      note_ar?: string;
    };
    fields?: Field[];
  };
  locale: "en" | "ar";
  initialWork?: { fields?: Record<string, number | string | null> };
  onChange: (work: { fields: Record<string, number | string | null> }) => void;
}

export function LogicInputEngine({ config, locale, initialWork, onChange }: LogicInputProps) {
  const [fields, setFields] = useState<Record<string, number | string | null>>(
    initialWork?.fields ?? {},
  );
  const ar = locale === "ar";
  const scenario = config.scenario;

  function update(id: string, raw: string) {
    const next = { ...fields, [id]: raw === "" ? null : Number(raw) };
    setFields(next);
    onChange({ fields: next });
  }

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      {scenario?.note_en && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {ar ? scenario.note_ar ?? scenario.note_en : scenario.note_en}
        </p>
      )}
      {scenario?.products && scenario.products.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="p-2 text-start">Product</th>
                <th className="p-2 text-end">Budget Price</th>
                <th className="p-2 text-end">Budget Vol</th>
                <th className="p-2 text-end">Actual Price</th>
                <th className="p-2 text-end">Actual Vol</th>
              </tr>
            </thead>
            <tbody>
              {scenario.products.map((p) => (
                <tr key={p.name} className="border-t border-border">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2 text-end">{p.budget_price}</td>
                  <td className="p-2 text-end">{p.budget_vol}</td>
                  <td className="p-2 text-end">{p.actual_price}</td>
                  <td className="p-2 text-end">{p.actual_vol}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/50 text-xs">
              <tr>
                <td className="p-2 font-medium">
                  Budget {scenario.budget_revenue} · Actual {scenario.actual_revenue} · Total Variance{" "}
                  {scenario.total_variance}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(config.fields ?? []).map((f) => (
          <label key={f.id} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{ar ? f.label_ar ?? f.label_en : f.label_en}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={fields[f.id] ?? ""}
              onChange={(e) => update(f.id, e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
