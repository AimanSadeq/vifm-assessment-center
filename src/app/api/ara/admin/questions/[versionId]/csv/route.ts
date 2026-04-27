import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ara/admin/questions/[versionId]/csv
 *
 * Streams a CSV of every question in the version. Column order and naming
 * match `importAraQuestionsCsv` so admins can export, edit in a spreadsheet,
 * and re-import into a new draft version without manual schema fixes.
 *
 * Auth: admin only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    await requireRole("admin");
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const sb = createServiceClient();

  const { data: version } = await sb
    .from("ara_question_bank_versions")
    .select("version_number, version_label")
    .eq("id", params.versionId)
    .maybeSingle<Pick<AraQuestionBankVersion, "version_number" | "version_label">>();

  if (!version) {
    return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
  }

  const { data: questions } = await sb
    .from("ara_questions")
    .select("*")
    .eq("version_id", params.versionId)
    .order("pillar_id", { ascending: true })
    .order("display_order", { ascending: true })
    .returns<AraQuestion[]>();

  const csv = serializeQuestionsCsv(questions ?? []);
  const filename = `ara-questions-v${version.version_number}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      // Excel reads UTF-8 CSV correctly when the BOM is present, so we
      // prepend it. Without the BOM, Excel mangles Arabic text on Windows.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const COLUMNS = [
  "pillar_id",
  "question_number",
  "question_text_en",
  "question_text_ar",
  "question_type",
  "options_en",
  "options_ar",
  "score_map",
  "help_text_en",
  "help_text_ar",
  "region",
  "sector",
  "layer",
  "display_order",
] as const;

function serializeQuestionsCsv(rows: AraQuestion[]): string {
  const header = COLUMNS.join(",");
  const lines = rows.map((q) => {
    const cells = [
      q.pillar_id,
      String(q.question_number),
      q.question_text_en ?? "",
      q.question_text_ar ?? "",
      q.question_type,
      q.options_en != null ? JSON.stringify(q.options_en) : "",
      q.options_ar != null ? JSON.stringify(q.options_ar) : "",
      q.score_map != null ? JSON.stringify(q.score_map) : "",
      q.help_text_en ?? "",
      q.help_text_ar ?? "",
      q.region ?? "both",
      q.sector ?? "all",
      String(q.layer ?? 1),
      String(q.display_order ?? 0),
    ];
    return cells.map(csvEscape).join(",");
  });
  // Prepend a UTF-8 BOM so Excel on Windows opens Arabic columns correctly.
  return "\uFEFF" + [header, ...lines].join("\r\n") + "\r\n";
}

/**
 * Quote a CSV cell when it contains characters that would break the
 * delimited format (comma, double-quote, CR, or LF). Embedded double
 * quotes are escaped per RFC 4180 by doubling them.
 */
function csvEscape(value: string): string {
  if (value === "") return "";
  const needsQuotes = /[",\r\n]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
