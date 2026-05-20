"use client";

import { useRef, useState, useTransition } from "react";
import { Users, Loader2, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  bulkUpsertReflectParticipants,
  bulkUpsertReflectRaters,
} from "@/lib/reflect/actions";
import {
  parseCsvOrTsv,
  maybeDropHeader,
} from "./csv";

type Props = {
  engagementId: string;
};

type ParticipantResult = {
  inserted: number;
  errors: string[];
} | null;

type RaterResult = {
  inserted: number;
  unmatched: number;
  unmatched_emails: string[];
  errors: string[];
} | null;

const PARTICIPANT_HEADERS = ["full_name", "email", "role_title", "business_unit", "level_tier", "manager_email", "language_preference"];
const RATER_HEADERS = ["participant_email", "rater_role", "full_name", "email", "language_preference"];

// ──────────────────────────────────────────────────────────────
// Normalisers — accept the variants consultants will realistically
// type and coerce them to the canonical enum values. Without this,
// "Senior Manager", "direct-report", "Peer", "Arabic" all fail
// validation even though the intent is unambiguous.
// ──────────────────────────────────────────────────────────────

function normaliseRaterRole(raw: string | undefined | null): string {
  if (!raw) return "peer";
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["self"].includes(k)) return "self";
  if (["manager", "line_manager"].includes(k)) return "manager";
  if (["peer", "peers", "colleague"].includes(k)) return "peer";
  if (["direct_report", "direct_reports", "report", "dr"].includes(k)) return "direct_report";
  if (["skip_level", "skip_level_manager", "skip", "skip_lvl"].includes(k)) return "skip_level";
  if (["other", "internal_client", "cross_functional"].includes(k)) return "other";
  return k; // let Zod surface a clean error if it's still off
}

function normaliseLevelTier(raw: string | undefined | null): string {
  if (!raw) return "manager";
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["exec", "executive", "c_suite", "csuite", "c_level"].includes(k)) return "exec";
  if (["senior_mgr", "senior_manager", "snr_mgr", "sr_mgr", "department_head", "vp", "director"].includes(k)) return "senior_mgr";
  if (["manager", "team_lead", "section_head", "line_manager"].includes(k)) return "manager";
  if (["individual_contributor", "ic", "senior_ic", "senior_individual_contributor"].includes(k)) return "individual_contributor";
  if (["all", "any"].includes(k)) return "all";
  return k;
}

function normaliseLanguage(raw: string | undefined | null): string {
  if (!raw) return "en";
  const k = raw.trim().toLowerCase();
  if (["en", "english", "eng"].includes(k)) return "en";
  if (["ar", "arabic", "arabe", "ara"].includes(k)) return "ar";
  return k;
}

export function StepPeople({ engagementId }: Props) {
  const [pCsv, setPCsv] = useState("");
  const [pResult, setPResult] = useState<ParticipantResult>(null);
  const [pPending, startPTransition] = useTransition();

  const [rCsv, setRCsv] = useState("");
  const [rResult, setRResult] = useState<RaterResult>(null);
  const [rPending, startRTransition] = useTransition();

  // Refs for the hidden file pickers — labels can't be inside a parent
  // <Button>, so we use refs to fire .click() from the visible buttons.
  const pFileRef = useRef<HTMLInputElement | null>(null);
  const rFileRef = useRef<HTMLInputElement | null>(null);

  const readFileIntoTextarea = async (
    file: File,
    setter: (text: string) => void
  ) => {
    try {
      const text = await file.text();
      // Normalise line endings + strip BOM (Excel-saved CSVs ship UTF-8 BOM)
      const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
      setter(cleaned);
    } catch (err) {
      console.error("[reflect:file-upload] failed", err);
    }
  };

  const submitParticipants = () => {
    setPResult(null);
    const raw = parseCsvOrTsv(pCsv);
    const rows = maybeDropHeader(raw, PARTICIPANT_HEADERS);
    if (rows.length === 0) {
      setPResult({ inserted: 0, errors: ["No rows detected. Paste at least one participant row."] });
      return;
    }
    const parsed = rows.map((r) => ({
      full_name: r[0] ?? "",
      email: (r[1] ?? "").toLowerCase(),
      role_title: r[2] ?? null,
      business_unit: r[3] ?? null,
      // Normalise spelling — accept "Senior Manager", "senior-mgr", "Senior_Mgr" etc.
      level_tier: normaliseLevelTier(r[4]),
      manager_email: r[5] ? r[5].toLowerCase() : null,
      language_preference: normaliseLanguage(r[6]),
    }));

    startPTransition(async () => {
      const res = await bulkUpsertReflectParticipants({
        engagement_id: engagementId,
        rows: parsed,
      });
      if (!res.ok) {
        setPResult({ inserted: 0, errors: [res.error ?? "Import failed"] });
        return;
      }
      setPResult({ inserted: res.inserted ?? 0, errors: [] });
    });
  };

  const submitRaters = () => {
    setRResult(null);
    const raw = parseCsvOrTsv(rCsv);
    const rows = maybeDropHeader(raw, RATER_HEADERS);
    if (rows.length === 0) {
      setRResult({ inserted: 0, unmatched: 0, unmatched_emails: [], errors: ["No rows detected."] });
      return;
    }
    const parsed = rows.map((r) => ({
      participant_email: (r[0] ?? "").toLowerCase(),
      rater_role: normaliseRaterRole(r[1]),
      full_name: r[2] ?? "",
      email: (r[3] ?? "").toLowerCase(),
      language_preference: normaliseLanguage(r[4]),
    }));

    startRTransition(async () => {
      const res = await bulkUpsertReflectRaters({
        engagement_id: engagementId,
        rows: parsed,
      });
      if (!res.ok) {
        setRResult({ inserted: 0, unmatched: 0, unmatched_emails: [], errors: [res.error ?? "Import failed"] });
        return;
      }
      setRResult({
        inserted: res.inserted ?? 0,
        unmatched: res.unmatched_count ?? 0,
        unmatched_emails: res.unmatched_emails ?? [],
        errors: [],
      });
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          Participants &amp; raters
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk-paste participants first, then raters. Both accept comma-separated or tab-separated values (paste directly from Excel works).
        </p>
      </div>

      {/* Participants */}
      <section className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">1. Participants</h3>
            <p className="text-xs text-muted-foreground">The people being assessed.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={pFileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFileIntoTextarea(f, setPCsv);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pFileRef.current?.click()}
              className="text-xs"
            >
              <Upload className="h-3.5 w-3.5 me-1.5" />
              Upload CSV file
            </Button>
          </div>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
          full_name, email, role_title, business_unit, level_tier, manager_email, language_preference
        </div>
        <Textarea
          placeholder={"Aiman Sadeq,aiman@example.com,Head of Treasury,Finance,senior_mgr,ceo@example.com,en\nFatima Al-Saud,fatima@example.com,VP People,HR,senior_mgr,ceo@example.com,ar"}
          rows={6}
          value={pCsv}
          onChange={(e) => setPCsv(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <Button onClick={submitParticipants} disabled={pPending || !pCsv.trim()}>
            {pPending ? (
              <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" /> Importing…
              </>
            ) : (
              "Import participants"
            )}
          </Button>
          {pResult && pResult.errors.length === 0 && pResult.inserted > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {pResult.inserted} added
            </span>
          )}
          {pResult && pResult.errors.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {pResult.errors[0]}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Valid <code className="text-[10px]">level_tier</code>: exec, senior_mgr, manager, individual_contributor, all. Valid <code className="text-[10px]">language_preference</code>: en, ar.
        </p>
      </section>

      {/* Raters */}
      <section className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">2. Raters</h3>
            <p className="text-xs text-muted-foreground">The people giving 360° feedback to each participant.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={rFileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFileIntoTextarea(f, setRCsv);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => rFileRef.current?.click()}
              className="text-xs"
            >
              <Upload className="h-3.5 w-3.5 me-1.5" />
              Upload CSV file
            </Button>
          </div>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
          participant_email, rater_role, full_name, email, language_preference
        </div>
        <Textarea
          placeholder={"aiman@example.com,manager,CEO Ahmad,ceo@example.com,en\naiman@example.com,peer,VP Marketing,vp.mkt@example.com,en\naiman@example.com,direct_report,Analyst One,analyst1@example.com,ar"}
          rows={6}
          value={rCsv}
          onChange={(e) => setRCsv(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <Button onClick={submitRaters} disabled={rPending || !rCsv.trim()}>
            {rPending ? (
              <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" /> Importing…
              </>
            ) : (
              "Import raters"
            )}
          </Button>
          {rResult && rResult.errors.length === 0 && rResult.inserted > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {rResult.inserted} added
            </span>
          )}
          {rResult && rResult.unmatched > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {rResult.unmatched} unmatched (participant email not found)
            </span>
          )}
          {rResult && rResult.errors.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {rResult.errors[0]}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Valid <code className="text-[10px]">rater_role</code>: self, manager, peer, direct_report, skip_level, other. The <code className="text-[10px]">participant_email</code> must match an email you imported above.
        </p>
      </section>
    </div>
  );
}
