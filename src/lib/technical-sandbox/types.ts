// ─────────────────────────────────────────────────────────────
// Technical sandbox portal — shared types (engine payloads, work,
// checkpoints, results). Mirrors the jsonb columns on
// technical_skill_blocks and technical_sandbox_responses (00077).
// ─────────────────────────────────────────────────────────────

export type EngineType =
  | "spreadsheet"
  | "advanced_spreadsheet"
  | "logic_input"
  | "sql"
  | "python";

export type ProficiencyTier = "basic" | "intermediate" | "advanced";

// ── Checkpoints (the validator contract; one weighted check each) ──
export type CheckpointKind =
  | "cell_value"
  | "is_array_formula"
  | "logic_value"
  | "sql_result_match";

export interface CheckpointBase {
  id: string;
  kind: CheckpointKind;
  weight: number;
  label_en?: string;
  label_ar?: string;
}
export interface CellValueCheckpoint extends CheckpointBase {
  kind: "cell_value";
  target: string; // e.g. "B12"
  expected: number;
  tolerance?: number;
}
export interface ArrayFormulaCheckpoint extends CheckpointBase {
  kind: "is_array_formula";
  target: string; // a cell "C9" or a range "C9:E11"
}
export interface LogicValueCheckpoint extends CheckpointBase {
  kind: "logic_value";
  field: string;
  expected: number;
  tolerance?: number;
}
export interface SqlResultMatchCheckpoint extends CheckpointBase {
  kind: "sql_result_match";
  ordered?: boolean;
}
export type Checkpoint =
  | CellValueCheckpoint
  | ArrayFormulaCheckpoint
  | LogicValueCheckpoint
  | SqlResultMatchCheckpoint;

// ── Candidate work (autosaved / submitted), shape per engine ──
export interface SpreadsheetCell {
  value?: number | string | null;
  formula?: string | null;
  isArrayFormula?: boolean;
}
export interface SpreadsheetWork {
  cells: Record<string, SpreadsheetCell>;
}
export interface LogicInputWork {
  fields: Record<string, number | string | null>;
}
export interface SqlWork {
  query: string;
}
export type SandboxWork =
  | SpreadsheetWork
  | LogicInputWork
  | SqlWork
  | Record<string, unknown>;

// ── Master solution (jsonb) ──
export interface SpreadsheetMaster {
  cells: Record<string, number>;
}
export interface LogicInputMaster {
  fields: Record<string, number>;
}
export interface SqlMaster {
  master_query: string;
}

// ── Validation output ──
export interface CheckpointResult {
  id: string;
  kind: CheckpointKind;
  weight: number;
  passed: boolean;
  detail?: string;
  label_en?: string;
  label_ar?: string;
}
export interface BlockScore {
  scorePct: number;
  tier: ProficiencyTier;
  checkpointResults: CheckpointResult[];
}
