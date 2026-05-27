"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Sparkles, AlertCircle } from "lucide-react";
import {
  bulkAssignRoleProfilesAction,
  type BulkAssignRowResult,
} from "../actions";

type ProfileOption = { id: string; name_en: string };
const FALLBACK_NONE = "__none__";

type ParsedRow = {
  email: string;
  roleProfileId: string | null;
  /** Free-text identifier from the CSV (raw column 2) - kept for debugging */
  rawProfile: string;
};

/**
 * Parses a CSV string into rows. The accepted columns are:
 *   - "email" + "role_profile_id" (UUID), OR
 *   - "email" + "role_profile" (matched by name_en, case-insensitive)
 *
 * Skips empty lines and obvious header rows ("email,role_profile_id").
 */
function parseCsv(
  text: string,
  profileLookup: Map<string, string>,
  tr: (key: string, vars?: Record<string, string | number>) => string
): { rows: ParsedRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Strip a header row if present
  if (lines.length > 0 && /email/i.test(lines[0]) && /role|profile/i.test(lines[0])) {
    lines.shift();
  }

  const rows: ParsedRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(",").map((c: string) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2) {
      warnings.push(tr("adminRoleProfiles.bulkAssign.warnColumns", { line: i + 1, got: cells.length }));
      continue;
    }
    const [email, raw] = cells;
    if (!email) {
      warnings.push(tr("adminRoleProfiles.bulkAssign.warnMissingEmail", { line: i + 1 }));
      continue;
    }
    let roleProfileId: string | null = null;
    if (raw) {
      // Treat empty string / "none" / "unassigned" as clear
      if (/^(none|unassigned|null|-)$/i.test(raw)) {
        roleProfileId = null;
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
        roleProfileId = raw;
      } else {
        const matched = profileLookup.get(raw.toLowerCase());
        if (!matched) {
          warnings.push(
            tr("adminRoleProfiles.bulkAssign.warnNoMatch", { line: i + 1, raw })
          );
          continue;
        }
        roleProfileId = matched;
      }
    }
    rows.push({ email, roleProfileId, rawProfile: raw });
  }
  return { rows, warnings };
}

const STATUS_TONE: Record<
  BulkAssignRowResult["status"],
  { bg: string; fg: string; border: string }
> = {
  updated: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  no_candidate: { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" },
  no_change: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  error: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

export function BulkAssignClient({ profiles }: { profiles: ProfileOption[] }) {
  const { t } = useTranslation();
  const profileLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.name_en.toLowerCase(), p.id);
    return m;
  }, [profiles]);

  const [csvText, setCsvText] = useState("");
  const [defaultProfileId, setDefaultProfileId] = useState<string>(FALLBACK_NONE);
  const [results, setResults] = useState<BulkAssignRowResult[] | null>(null);
  const [summary, setSummary] = useState<
    | { updated: number; noCandidate: number; noChange: number; errors: number }
    | null
  >(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File | null) => {
    if (!file) return;
    file.text().then((text) => setCsvText(text));
  };

  const handleApply = () => {
    setResults(null);
    setSummary(null);
    setWarnings([]);

    const parsed = parseCsv(csvText, profileLookup, t);
    setWarnings(parsed.warnings);

    if (parsed.rows.length === 0) {
      toast.error(t("adminRoleProfiles.bulkAssign.errNoRows"));
      return;
    }

    // If the user picked a "default" profile, use it for rows that didn't
    // specify one (raw column blank). Helps when the CSV is just a list of
    // emails.
    const defaultId = defaultProfileId === FALLBACK_NONE ? null : defaultProfileId;
    const rows = parsed.rows.map((r) => ({
      email: r.email,
      roleProfileId: r.rawProfile ? r.roleProfileId : defaultId,
    }));

    startTransition(async () => {
      const result = await bulkAssignRoleProfilesAction({ rows });
      if ("error" in result) {
        toast.error(t("adminRoleProfiles.bulkAssign.errValidation"));
        return;
      }
      setResults(result.results);
      setSummary(result.summary);
      const tone =
        result.summary.errors > 0
          ? toast.error
          : result.summary.noCandidate > 0
            ? toast.warning
            : toast.success;
      tone(
        t("adminRoleProfiles.bulkAssign.toastSummary", {
          updated: result.summary.updated,
          unmatched: result.summary.noCandidate,
          errors: result.summary.errors,
        })
      );
    });
  };

  const exampleCsv = profiles[0]
    ? `email,role_profile_id\nahmed.mansoori@example.com,${profiles[0].id}\nfatima@example.com,${profiles[0].name_en}`
    : `email,role_profile_id\nahmed.mansoori@example.com,<paste-uuid>\nfatima@example.com,<role-profile-name>`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminRoleProfiles.bulkAssign.csvInput")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-[1fr,auto] gap-3 items-start">
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={exampleCsv}
              rows={10}
              className="font-mono text-xs"
            />
            <div className="flex flex-col gap-2 min-w-[200px]">
              <label
                htmlFor="csv-file"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Upload className="h-4 w-4" />
                {t("adminRoleProfiles.bulkAssign.uploadCsv")}
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("adminRoleProfiles.bulkAssign.pasteHint")}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("adminRoleProfiles.bulkAssign.defaultProfileLabel")}
            </p>
            <Select value={defaultProfileId} onValueChange={setDefaultProfileId}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder={t("adminRoleProfiles.bulkAssign.defaultProfilePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FALLBACK_NONE}>{t("adminRoleProfiles.bulkAssign.defaultProfileNone")}</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleApply}
              disabled={pending || !csvText.trim()}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {pending ? t("adminRoleProfiles.bulkAssign.applying") : t("adminRoleProfiles.bulkAssign.applyAssignments")}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {t("adminRoleProfiles.bulkAssign.nonBlankLines", {
                count: csvText.split(/\r?\n/).filter((l) => l.trim()).length,
              })}
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs space-y-0.5">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("adminRoleProfiles.bulkAssign.parseWarnings", { count: warnings.length })}
              </p>
              {warnings.slice(0, 6).map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              {warnings.length > 6 && (
                <p>{t("adminRoleProfiles.bulkAssign.andMore", { count: warnings.length - 6 })}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {summary && results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4" />
              {t("adminRoleProfiles.bulkAssign.resultsTitle")}
              <Badge variant="default" className="bg-emerald-600">{t("adminRoleProfiles.bulkAssign.badgeUpdated", { count: summary.updated })}</Badge>
              <Badge variant="secondary">{t("adminRoleProfiles.bulkAssign.badgeNoChange", { count: summary.noChange })}</Badge>
              <Badge variant="outline" className="border-amber-300 text-amber-800">{t("adminRoleProfiles.bulkAssign.badgeUnmatched", { count: summary.noCandidate })}</Badge>
              {summary.errors > 0 && (
                <Badge variant="destructive">{t("adminRoleProfiles.bulkAssign.badgeErrors", { count: summary.errors })}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminRoleProfiles.bulkAssign.colEmail")}</TableHead>
                  <TableHead>{t("adminRoleProfiles.bulkAssign.colCandidate")}</TableHead>
                  <TableHead>{t("adminRoleProfiles.bulkAssign.colStatus")}</TableHead>
                  <TableHead>{t("adminRoleProfiles.bulkAssign.colDetail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => {
                  const tone = STATUS_TONE[r.status];
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell className="text-sm">
                        {r.candidateName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
                        >
                          {t(`adminRoleProfiles.bulkAssign.statusLabel.${r.status}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.message ?? (r.candidateId ? `id: ${r.candidateId.slice(0, 8)}…` : "-")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
