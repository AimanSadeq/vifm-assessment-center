"use client";
// Interactive spreadsheet engine (FP&A 1.1 / 1.2) powered by Univer (Apache-2.0).
// Loaded client-only. Builds the worksheet from engineConfig.rows, then reads
// each editable cell's value + formula from the workbook SNAPSHOT and returns
// { cells: { ref: { value, formula, isArrayFormula } } }.
//
// NOTE: next/dynamic does NOT forward refs, so the parent gets the reader via the
// onRegister callback prop (not a React ref).
import { useEffect, useRef, useState } from "react";
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
type CellWork = { value?: number | string | null; formula?: string | null; isArrayFormula?: boolean };
export type SpreadsheetReader = () => { cells: Record<string, CellWork> };
export interface SpreadsheetProps {
  config: SpreadsheetConfig;
  locale: "en" | "ar";
  /** Parent registers the work reader here (refs aren't forwarded through next/dynamic). */
  onRegister?: (reader: SpreadsheetReader) => void;
}

const COLS = ["A", "B", "C", "D", "E", "F", "G"];

function refToRowCol(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = m[1].split("").reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { row: Number(m[2]) - 1, col };
}

export function SpreadsheetEngine({ config, onRegister }: SpreadsheetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Univer facade workbook API instance (typed loosely; lib is dynamic).
    const apiRef = useRef<{ getActiveWorkbook: () => unknown } | null>(null);
    const disposeRef = useRef<null | (() => void)>(null);
    const [initError, setInitError] = useState<string | null>(null);

    const editableRefs = (config.editable ?? []).flatMap((e) =>
      e.includes(":") ? expandRange(e) : [e],
    );

    // Read editable cells from the workbook SNAPSHOT (has both v and f reliably).
    const readWork: SpreadsheetReader = () => {
      const cells: Record<string, CellWork> = {};
      try {
        const api = apiRef.current as {
          getActiveWorkbook: () => {
            save: () => {
              sheetOrder: string[];
              sheets: Record<string, { cellData?: Record<number, Record<number, { v?: unknown; f?: string }>> }>;
            };
          };
        } | null;
        const snap = api?.getActiveWorkbook()?.save();
        if (!snap) return { cells };
        const sheet = snap.sheets[snap.sheetOrder[0]];
        const cellData = sheet?.cellData ?? {};
        for (const r of editableRefs) {
          const rc = refToRowCol(r);
          const cell = rc ? cellData[rc.row]?.[rc.col] : undefined;
          const rawV = cell?.v;
          const formula = (cell?.f ?? "") as string;
          const value =
            typeof rawV === "string" && rawV.trim() !== "" && Number.isFinite(Number(rawV))
              ? Number(rawV)
              : (rawV as number | string | null | undefined) ?? null;
          cells[r] = {
            value,
            formula: formula || null,
            isArrayFormula: /\bTABLE\s*\(/i.test(formula) || /^\{=/.test(formula),
          };
        }
      } catch {
        /* facade not ready */
      }
      return { cells };
    };

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const [{ createUniver, LocaleType, defaultTheme }, { UniverSheetsCorePreset }, enUS] =
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
            theme: defaultTheme,
            presets: [UniverSheetsCorePreset({ container: containerRef.current })],
          });
          // name + sheetOrder are required for the sheet to render.
          univerAPI.createWorkbook({
            id: "tech-sandbox",
            name: config.sheetName ?? "Model",
            sheetOrder: ["sheet1"],
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
          // Diagnostic: if no canvas/DOM renders into the container shortly after
          // init, surface a clear hint instead of a silent blank.
          setTimeout(() => {
            if (!cancelled && containerRef.current && containerRef.current.childElementCount === 0) {
              setInitError(
                "Spreadsheet initialised but did not render (no canvas). Likely a CSS/theme load issue.",
              );
            }
          }, 1800);
          disposeRef.current = () => {
            try {
              (univerAPI as unknown as { dispose?: () => void }).dispose?.();
            } catch {
              /* ignore */
            }
          };
        } catch (e) {
          if (!cancelled) setInitError(e instanceof Error ? e.message : String(e));
        }
      })();
      return () => {
        cancelled = true;
        disposeRef.current?.();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Hand the reader to the parent (next/dynamic drops refs).
    useEffect(() => {
      onRegister?.(readWork);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Editable cells: {editableRefs.join(", ") || "(none)"}
        </div>
        {initError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            Spreadsheet failed to load: {initError}
          </div>
        )}
        <div ref={containerRef} className="h-[460px] w-full rounded-md border border-border" />
      </div>
    );
}
