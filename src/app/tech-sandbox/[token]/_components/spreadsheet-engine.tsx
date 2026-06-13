"use client";
// Interactive spreadsheet engine (FP&A 1.1 / 1.2) powered by Univer (Apache-2.0).
// Loaded client-only. Builds the worksheet from engineConfig.rows, then on
// autosave/submit reads each editable cell's value + formula via the facade and
// returns { cells: { ref: { value, formula, isArrayFormula } } }.
//
// Runtime browser QA is still required (see PENDING-ACTIONS). It is wired to the
// documented Univer 0.5 facade API and gated by `npm run build`.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "@univerjs/preset-sheets-core/lib/index.css";
import { expandRange } from "@/lib/technical-sandbox/validators";

interface Row {
  r: number;
  A?: string | number;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  ref?: string;
  editable?: boolean;
  hint?: string;
  kind?: string;
}
export interface SpreadsheetConfig {
  sheetName?: string;
  rows?: Row[];
  editable?: string[];
}
export interface SpreadsheetHandle {
  readWork: () => { cells: Record<string, { value?: number | string | null; formula?: string | null; isArrayFormula?: boolean }> };
}
export interface SpreadsheetProps {
  config: SpreadsheetConfig;
  locale: "en" | "ar";
}

const COLS = ["A", "B", "C", "D", "E", "F", "G"];

function refToRowCol(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = m[1].split("").reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { row: Number(m[2]) - 1, col };
}

export const SpreadsheetEngine = forwardRef<SpreadsheetHandle, SpreadsheetProps>(
  function SpreadsheetEngine({ config }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Univer facade workbook API instance (typed loosely; lib is dynamic).
    const apiRef = useRef<{ getActiveWorkbook: () => unknown } | null>(null);
    const disposeRef = useRef<null | (() => void)>(null);

    const editableRefs = (config.editable ?? []).flatMap((e) =>
      e.includes(":") ? expandRange(e) : [e],
    );

    useImperativeHandle(ref, () => ({
      readWork() {
        const cells: Record<string, { value?: number | string | null; formula?: string | null; isArrayFormula?: boolean }> = {};
        try {
          const api = apiRef.current as {
            getActiveWorkbook: () => { getActiveSheet: () => { getRange: (a1: string) => { getValue: () => unknown; getFormula?: () => string } } };
          } | null;
          const sheet = api?.getActiveWorkbook()?.getActiveSheet();
          if (!sheet) return { cells };
          for (const r of editableRefs) {
            const range = sheet.getRange(r);
            const value = range.getValue() as number | string | null;
            const formula = (range.getFormula?.() ?? "") as string;
            cells[r] = {
              value: typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : value,
              formula: formula || null,
              isArrayFormula: /\bTABLE\s*\(/i.test(formula) || /^\{=/.test(formula),
            };
          }
        } catch {
          /* facade not ready */
        }
        return { cells };
      },
    }));

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const [{ createUniver, LocaleType }, { UniverSheetsCorePreset }, enUS] =
          await Promise.all([
            import("@univerjs/presets"),
            import("@univerjs/preset-sheets-core"),
            import("@univerjs/preset-sheets-core/locales/en-US"),
          ]);
        if (cancelled || !containerRef.current) return;
        const enLocale = ((enUS as { default?: unknown }).default ?? enUS) as never;

        // Build the cellData matrix from the row spec.
        const cellData: Record<number, Record<number, { v?: number | string; f?: string }>> = {};
        let maxRow = 0;
        for (const row of config.rows ?? []) {
          const r = row.r - 1;
          maxRow = Math.max(maxRow, r);
          for (const colLetter of COLS) {
            const val = (row as unknown as Record<string, unknown>)[colLetter];
            if (val === undefined || val === null) continue;
            const c = COLS.indexOf(colLetter);
            cellData[r] = cellData[r] ?? {};
            cellData[r][c] = { v: val as number | string };
          }
        }

        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: { [LocaleType.EN_US]: enLocale },
          presets: [UniverSheetsCorePreset({ container: containerRef.current })],
        });
        univerAPI.createWorkbook({
          id: "tech-sandbox",
          sheets: {
            sheet1: {
              id: "sheet1",
              name: config.sheetName ?? "Model",
              rowCount: Math.max(maxRow + 5, 40),
              columnCount: 8,
              cellData,
            },
          },
        });
        apiRef.current = univerAPI as unknown as { getActiveWorkbook: () => unknown };
        disposeRef.current = () => {
          try {
            (univerAPI as unknown as { dispose?: () => void }).dispose?.();
          } catch {
            /* ignore */
          }
        };
      })();
      return () => {
        cancelled = true;
        disposeRef.current?.();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Editable cells: {editableRefs.join(", ") || "(none)"}
        </div>
        <div ref={containerRef} className="h-[460px] w-full rounded-md border border-border" />
      </div>
    );
  },
);
