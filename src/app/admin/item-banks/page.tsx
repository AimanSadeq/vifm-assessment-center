import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, ShieldCheck, ShieldAlert, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadBankReadiness, type BankReadiness, type UnitReadiness } from "@/lib/bank-readiness/readiness";
import { ReopenButton } from "./_components/reopen-button";

export const dynamic = "force-dynamic";

/** Banks whose approved/live pool can be sent back to review (have a status gate). */
const REOPENABLE = new Set(["persona", "logica", "techno", "prehire", "fluent", "arc"]);

const TIER_CHIP: Record<string, string> = {
  certified: "bg-emerald-50 text-emerald-700",
  reviewed: "bg-[#5391D5]/10 text-[#5391D5]",
  indicative: "bg-amber-50 text-amber-700",
};

function unitState(u: UnitReadiness): "ready" | "partial" | "empty" {
  if (u.approved >= u.target) return "ready";
  if (u.approved > 0) return "partial";
  return "empty";
}
const UNIT_TONE: Record<string, { bar: string; text: string }> = {
  ready: { bar: "bg-emerald-500", text: "text-emerald-700" },
  partial: { bar: "bg-amber-500", text: "text-amber-700" },
  empty: { bar: "bg-rose-400", text: "text-rose-600" },
};

/**
 * How a bank actually serves at deal time - the three honest states:
 *  - "live"    → generates items live from the LLM (no vetted form).
 *  - "review"  → serves a FIXED seeded set, but its items are NOT all SME-approved
 *                yet (results are provisional). Not the same as "vetted".
 *  - "vetted"  → serves a fixed set whose items ARE SME-approved (or a bank with no
 *                per-item gate, i.e. the canonical seeded framework).
 * The old badge collapsed "review" into "vetted" - claiming approval that had not
 * happened. This separates them.
 */
function serveState(b: BankReadiness): "live" | "review" | "vetted" | "framework" {
  if (b.servesLive) return "live";
  // No per-item review gate (e.g. the AC behavioural framework seed): it is the
  // canonical hand-authored framework, not an SME-approved question bank. Say so
  // honestly rather than claiming "vetted".
  if (!b.hasReviewGate) return "framework";
  // A gated bank is only "vetted" once every item it holds is SME-approved; below
  // that it is fixed content still in review (results provisional).
  return b.total > 0 && b.vetted >= b.total ? "vetted" : "review";
}

/** Bank-level border tone: red = live-AI + empty, amber = live/in-review, green = vetted/framework. */
function bankState(b: BankReadiness): "ready" | "partial" | "risk" {
  const s = serveState(b);
  if (s === "live") return b.vetted === 0 ? "risk" : "partial";
  if (s === "review") return "partial";
  if (b.units) return b.units.every((u) => unitState(u) === "ready") ? "ready" : "partial";
  return "ready";
}

export default async function ItemBanksPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const banks = await loadBankReadiness();

  // Metrics count only ACTIVE banks - a retired instrument (nothing serves it) is
  // not a deal-time risk and should not drag the readiness numbers.
  const active = banks.filter((b) => !b.retired);
  const scramble = active.filter((b) => b.servesLive).length;
  const inReview = active.filter((b) => serveState(b) === "review").length;
  const trulyVetted = active.filter((b) => serveState(b) === "vetted").length;
  // Only count approvals from banks that actually have an SME gate - an un-gated
  // seed framework (AC) has no per-item approval, so its items are not "SME-approved".
  const totalApproved = active.filter((b) => b.hasReviewGate).reduce((s, b) => s + b.vetted, 0);

  const metric = (value: string, label: string, tone = "text-[#010131]") => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <BackLink href="/admin" label="Admin" history />
      <header>
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#010131]">
          <Boxes className="h-6 w-6 text-[#5391D5]" /> Item-bank readiness
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What a candidate would actually get at deal time: live-AI generated, fixed-but-unreviewed, or SME-approved content. &ldquo;Vetted&rdquo; means an SME has approved every item - not merely that the bank never uses live-AI.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric(`${scramble}`, "Banks generating items live at deal time", scramble > 0 ? "text-rose-600" : "text-emerald-700")}
        {metric(`${inReview}`, "Banks serving fixed content still in review", inReview > 0 ? "text-amber-600" : "text-emerald-700")}
        {metric(`${trulyVetted}/${active.length}`, "Banks fully SME-approved (vetted)", trulyVetted === active.length ? "text-emerald-700" : "text-[#010131]")}
        {metric(`${totalApproved}`, "SME-approved items (gated banks)", totalApproved > 0 ? "text-[#010131]" : "text-amber-600")}
      </div>

      {scramble > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{scramble} bank{scramble === 1 ? "" : "s"}</strong> still mint questions live from the LLM at sitting time - no SME sees an item before a candidate, and two candidates can get non-equated forms. These are the &ldquo;problem question&rdquo; risk at deal time; fill them to a vetted bank first.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {banks.map((b) => {
          const st = bankState(b);
          return (
            <div
              key={b.key}
              className={`rounded-xl border bg-card p-4 shadow-sm ${b.retired ? "border-slate-200 opacity-70" : st === "risk" ? "border-rose-200" : st === "partial" ? "border-amber-200" : "border-emerald-200"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[#010131]">{b.label}</span>
                {b.retired ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    Retired · not served
                  </span>
                ) : (
                  <>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TIER_CHIP[b.tier] ?? ""}`}>{b.tier}</span>
                    {(() => {
                      const s = serveState(b);
                      if (s === "live")
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                            <ShieldAlert className="h-3 w-3" /> Live-AI at deal time
                          </span>
                        );
                      if (s === "review")
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <ShieldAlert className="h-3 w-3" /> Fixed content · in review
                          </span>
                        );
                      if (s === "framework")
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <ShieldCheck className="h-3 w-3" /> Seeded framework · no item gate
                          </span>
                        );
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> Fixed vetted content
                        </span>
                      );
                    })()}
                    {b.hasReviewGate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        <CheckCircle2 className="h-3 w-3" /> SME review gate
                      </span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {b.vetted} vetted{b.total !== b.vetted ? ` / ${b.total} total` : ""}
                    </span>
                  </>
                )}
              </div>

              {!b.retired && b.units && b.units.length > 0 && (
                <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {b.units.map((u) => {
                    const s = unitState(u);
                    const tone = UNIT_TONE[s];
                    const pct = Math.min(100, u.target > 0 ? Math.round((u.approved / u.target) * 100) : 0);
                    return (
                      <div key={u.unit} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 truncate text-xs text-foreground" title={u.unit}>{u.unit}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`w-12 shrink-0 text-right text-[11px] tabular-nums ${tone.text}`}>{u.approved}/{u.target}</span>
                        {u.total > u.approved && (
                          <span className="w-20 shrink-0 text-right text-[10px] text-amber-500" title="drafted / in review - not yet SME-approved">+{u.total - u.approved} in review</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-2.5 text-xs text-muted-foreground">{b.note}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {b.console && (
                  <Link href={b.console} className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline">
                    Manage bank <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {!b.retired && b.vetted > 0 && REOPENABLE.has(b.key) && <ReopenButton bankKey={b.key} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-500" /> at target</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-500" /> partial</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-rose-400" /> empty</span>
        <span className="ml-auto">Target = vetted items per domain/subtest/pillar before a bank is deal-ready.</span>
      </div>
    </div>
  );
}
