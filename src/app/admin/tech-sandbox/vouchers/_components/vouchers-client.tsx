"use client";
// Admin - Option 2: voucher codes the CLIENT self-distributes. Two methods only:
//  - Single-use codes: N anonymous codes (one per delegate).
//  - One shared seat-pool code: one code, N seats.
// Named-delegate issuance (one personal link each) lives under Option 1 - the
// direct-issuance panel (AdminClient).
//
// Two scopes:
//  - Full function assessment (default) - the certified blueprint.
//  - Custom (pick-and-choose) - a shorter "trial" sitting built from a subset of
//    the function's knowledge skills and/or hands-on tasks. Indicative only (no
//    credential), carried to the redeemed session via custom_config (00141).
//
// Every generated voucher also surfaces a copyable redeem LINK (code pre-filled)
// so a delegate clicks through and starts without typing the code.
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, ChevronLeft, ChevronRight, Building2, Users, Loader2, Upload } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoucherClientEmailCard } from "@/components/shared/voucher-client-email-card";
import { emailVoucherLinksToDelegatesAction } from "@/lib/vouchers/email-actions";
import type { CustomBuilderData, FunctionRow } from "@/lib/technical-sandbox/service";
import type { VoucherRow } from "@/lib/technical-sandbox/vouchers";
import type { SavedCustomAssessment } from "@/lib/technical-sandbox/custom-assessments";
import {
  generateVouchersAction,
  setVoucherStatusAction,
  emailVoucherCodesAction,
  getCustomBuilderDataAction,
  saveCustomAssessmentAction,
  listCustomAssessmentsAction,
  deleteCustomAssessmentAction,
} from "../../actions";

type Mode = "single" | "pool";
type Scope = "full" | "custom";

const ENGINE_LABEL: Record<string, string> = {
  spreadsheet: "Spreadsheet",
  advanced_spreadsheet: "Advanced spreadsheet",
  logic_input: "Calculation",
  sql: "SQL",
  python: "Python",
};

export function VouchersClient({
  functions,
  vouchers,
  talentLens = null,
}: {
  functions: FunctionRow[];
  vouchers: VoucherRow[];
  talentLens?: "acquisition" | "development" | null;
}) {
  const fnName = new Map(functions.map((f) => [f.id, `${f.nodeId ?? ""} ${f.nameEn}`.trim()]));
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("single");
  const [scope, setScope] = useState<Scope>("full");
  const [count, setCount] = useState(20);
  const [organizationName, setOrganizationName] = useState("");
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [mcqPct, setMcqPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rowEmailing, setRowEmailing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState<"client" | "delegates" | null>(null);
  const [delegateText, setDelegateText] = useState("");
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState<string | null>(null);

  // ── Custom (pick-and-choose) scope state ──
  const [builder, setBuilder] = useState<CustomBuilderData | null>(null);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [blockIds, setBlockIds] = useState<Set<string>>(new Set());

  // ── Saved (reusable) custom designs ──
  const [savedDesigns, setSavedDesigns] = useState<SavedCustomAssessment[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [pickId, setPickId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // A saved design queued to apply once the builder data for its function lands.
  const pendingDesignRef = useRef<SavedCustomAssessment | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redeemUrl = (code: string) => `${origin}/tech-sandbox/redeem?code=${code}`;

  // Lazy-load the function's skills + tasks when Custom scope is active. When a
  // saved design is queued for this function, apply ITS selection; otherwise
  // default both selections to "all" each time a fresh function's data lands.
  useEffect(() => {
    if (scope !== "custom" || !functionId) return;
    if (builder && builder.functionId === functionId) return;
    let cancelled = false;
    setBuilderBusy(true);
    setBuilderError(null);
    getCustomBuilderDataAction(functionId).then((res) => {
      if (cancelled) return;
      setBuilderBusy(false);
      if ("error" in res) return setBuilderError(res.error);
      if (!res.data) return setBuilderError("Could not load this function's skills and tasks.");
      setBuilder(res.data);
      const pending = pendingDesignRef.current;
      if (pending && pending.functionId === functionId) {
        setSkills(new Set(pending.skills));
        setBlockIds(new Set(pending.blockIds));
        setMcqPct(pending.mcqPct);
        setLabel(pending.name);
        setLoadedId(pending.id);
        pendingDesignRef.current = null;
      } else {
        setSkills(new Set(res.data.skills));
        setBlockIds(new Set(res.data.pillars.flatMap((p) => p.blocks.map((b) => b.id))));
        setLoadedId(null); // manual function change drops any loaded design
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scope, functionId, builder]);

  // Keep the saved-design picker populated for the selected function while in
  // Custom scope (silently empty when migration 00166 isn't applied).
  useEffect(() => {
    if (scope !== "custom" || !functionId) return;
    let cancelled = false;
    listCustomAssessmentsAction(functionId).then((res) => {
      if (cancelled || "error" in res) return;
      setSavedDesigns(res.designs);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, functionId]);

  async function refreshSaved() {
    const res = await listCustomAssessmentsAction(functionId);
    if (!("error" in res)) setSavedDesigns(res.designs);
  }

  async function saveDesign(asNew: boolean) {
    setSaving(true);
    setSaveMsg(null);
    const res = await saveCustomAssessmentAction({
      id: asNew ? null : loadedId,
      name: label.trim(),
      functionId,
      skills: [...skills],
      blockIds: [...blockIds],
      mcqPct,
      talentLens,
    });
    setSaving(false);
    if ("error" in res) {
      setSaveMsg({ ok: false, text: res.error });
      return;
    }
    setLoadedId(res.id);
    setSaveMsg({ ok: true, text: "Saved - reuse it any time from “Saved assessments”." });
    await refreshSaved();
  }

  function loadDesign(id: string) {
    const d = savedDesigns.find((x) => x.id === id);
    if (!d) return;
    setScope("custom");
    setNewCodes(null);
    setSaveMsg({ ok: true, text: `Loaded “${d.name}”.` });
    if (builder && builder.functionId === d.functionId) {
      // Builder already loaded for this function - apply the selection now.
      setSkills(new Set(d.skills));
      setBlockIds(new Set(d.blockIds));
      setMcqPct(d.mcqPct);
      setLabel(d.name);
      setLoadedId(d.id);
    } else {
      // Queue it; the builder-load effect applies it once the data lands.
      pendingDesignRef.current = d;
      setFunctionId(d.functionId);
    }
  }

  async function removeDesign(id: string) {
    const res = await deleteCustomAssessmentAction({ id });
    if ("error" in res) {
      setSaveMsg({ ok: false, text: res.error });
      return;
    }
    if (loadedId === id) setLoadedId(null);
    setPickId((cur) => (cur === id ? "" : cur));
    setSavedDesigns((prev) => prev.filter((x) => x.id !== id));
  }

  const allBlockIds = useMemo(
    () => (builder ? builder.pillars.flatMap((p) => p.blocks.map((b) => b.id)) : []),
    [builder],
  );

  const toggleIn = (set: Set<string>, key: string): Set<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const knowledgeOn = scope === "custom" && mcqPct > 0 && skills.size > 0;
  const handsOnCount = scope === "custom" ? blockIds.size : 0;
  // A custom sitting must assess something.
  const customValid = scope === "full" || handsOnCount > 0 || knowledgeOn;

  const customSummary = (() => {
    if (scope !== "custom") return null;
    const parts: string[] = [];
    if (knowledgeOn) parts.push(`${skills.size} knowledge skill${skills.size === 1 ? "" : "s"} at ${mcqPct}%`);
    if (handsOnCount > 0)
      parts.push(`${handsOnCount} hands-on task${handsOnCount === 1 ? "" : "s"} at ${knowledgeOn ? 100 - mcqPct : 100}%`);
    if (parts.length === 0) return "Nothing selected yet.";
    return parts.join(" + ");
  })();

  // Robust copy: the async Clipboard API only exists in a secure context
  // (HTTPS or localhost). Over plain HTTP / a LAN IP, navigator.clipboard is
  // undefined, so we fall back to a hidden-textarea + execCommand copy that
  // works everywhere. Returns whether the copy actually landed.
  async function writeClipboard(text: string): Promise<boolean> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function copy(key: string, text: string) {
    const ok = await writeClipboard(text);
    if (!ok) {
      setError("Could not copy automatically - select the link text and copy it manually.");
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setNewCodes(null);
    const customConfig =
      scope === "custom"
        ? { skills: [...skills], blockIds: [...blockIds], title: label || null }
        : null;
    const res = await generateVouchersAction({
      functionId,
      count: mode === "single" ? count : 1,
      organizationName: organizationName || undefined,
      label: label || undefined,
      maxUsesPerCode: mode === "pool" ? count : 1,
      expiresAt: expiresAt || undefined,
      mcqPct,
      talentLens,
      customConfig,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setNewCodes(res.codes);
  }

  async function toggle(id: string, status: string) {
    await setVoucherStatusAction({ id, status: status === "active" ? "disabled" : "active" });
    window.location.reload();
  }

  async function emailRow(code: string) {
    setRowEmailing(code);
    setEmailMsg(null);
    const res = await emailVoucherCodesAction({ codes: [code] });
    setRowEmailing(null);
    if ("error" in res) return setEmailMsg({ ok: false, text: res.error });
    setEmailMsg({ ok: res.sent > 0, text: res.sent > 0 ? `Emailed ${res.results[0]?.email}.` : (res.results[0]?.error ?? "Send failed.") });
  }

  function importEmailsFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const found = (text.match(/[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[^\s,;:<>"'()[\]]+/g) ?? [])
        .map((e) => e.trim())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (!found.length) { setDelegateMsg("No email addresses found in that file."); return; }
      const existing = delegateText.split(/\r?\n/).map((l) => l.split(",")[0]?.trim().toLowerCase()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...found.map((e) => e.toLowerCase())]));
      setDelegateText(merged.join("\n"));
      setDelegateMsg(`Loaded ${found.length} email(s) from ${file.name}.`);
    };
    reader.onerror = () => setDelegateMsg("Could not read that file.");
    reader.readAsText(file);
  }

  async function sendToDelegates() {
    const parsed = delegateText
      .split(/\r?\n/)
      .map((line) => { const [email, ...rest] = line.split(","); return { email: (email ?? "").trim(), name: rest.join(",").trim() || undefined }; })
      .filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email));
    if (!parsed.length) { setDelegateMsg("Add at least one valid email."); return; }
    setDelegateBusy(true);
    setDelegateMsg(null);
    setError(null);
    const customConfig = scope === "custom" ? { skills: [...skills], blockIds: [...blockIds], title: label || null } : null;
    const res = await generateVouchersAction({
      functionId, count: parsed.length, organizationName: organizationName || undefined,
      label: label || undefined, maxUsesPerCode: 1, expiresAt: expiresAt || undefined, mcqPct, talentLens, customConfig,
    });
    if ("error" in res) { setDelegateBusy(false); setError(res.error); return; }
    const codes = res.codes;
    setNewCodes(codes);
    const recipients = parsed.map((d, i) => ({ email: d.email, name: d.name, link: codes[i] ? redeemUrl(codes[i]) : "" })).filter((r) => r.link);
    const mail = await emailVoucherLinksToDelegatesAction({ serviceLabel: "Techno®", recipients });
    setDelegateBusy(false);
    if ("error" in mail) { setError(mail.error); return; }
    setDelegateMsg(`Generated ${codes.length} and emailed ${mail.sent} of ${mail.total} delegate(s).`);
    setDelegateText("");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue Techno® vouchers</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Step 1 of 3 · Function, scope and who it's for"}
            {step === 2 && "Step 2 of 3 · How should the vouchers reach people?"}
            {step === 3 && target === "client" && "Step 3 of 3 · Generate and send to the client"}
            {step === 3 && target === "delegates" && "Step 3 of 3 · Email a link to each delegate"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {["Setup", "Delivery", "Issue"].map((s, i) => {
              const n = i + 1;
              return (
                <span key={s} className="flex items-center gap-2">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${step === n ? "bg-[#010131] text-white" : step > n ? "bg-[#5391D5] text-white" : "bg-muted text-muted-foreground"}`}>{n}</span>
                  <span className={step === n ? "font-medium text-foreground" : "text-muted-foreground"}>{s}</span>
                  {n < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </span>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
        {step === 1 && (
        <>
        <div className="space-y-4">
          {/* Standard identity fields - the same top row on every voucher page */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 space-y-1.5">
              <Label className="text-xs">{mode === "single" ? "How many codes" : "Seats in link"}</Label>
              <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="flex-1 min-w-[12rem] space-y-1.5">
              <Label className="text-xs">Client / organization</Label>
              <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Tag to a client org" />
            </div>
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-xs">Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ADNOC FP&A pilot" />
            </div>
            <div className="w-44 space-y-1.5">
              <Label className="text-xs">Expires (optional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>

          {/* Techno options - the per-service controls, folded into the same dashed callout every page uses */}
          <div className="space-y-3 rounded-lg border border-dashed border-[#5391D5]/50 bg-[#5391D5]/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
                <SlidersHorizontal className="h-4 w-4 text-[#5391D5]" /> Techno options
              </div>
              <span className="rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[11px] font-medium text-[#5391D5]">swaps per service</span>
            </div>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Function</span>
            <select value={functionId} onChange={(e) => setFunctionId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground">
              {functions.map((f) => (
                <option key={f.id} value={f.id}>{f.nodeId} · {f.nameEn}</option>
              ))}
            </select>
          </label>

          {/* Test scope - full blueprint vs a shorter custom (trial) sitting. */}
          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Test scope</span>
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setScope("full")}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${scope === "full" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                Full function assessment
              </button>
              <button
                type="button"
                onClick={() => setScope("custom")}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${scope === "custom" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                Custom (shorter trial)
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {scope === "full"
                ? "The full certified blueprint for this function - all skills and hands-on tasks."
                : "Pick a subset of skills and tasks for a shorter trial sitting. Indicative only - a custom sitting issues no credential."}
            </span>
          </div>

          {/* Custom scope picker - skills + hands-on tasks + knowledge weight. */}
          {scope === "custom" && (
            <div className="sm:col-span-2 space-y-3 rounded-md border border-[#5391D5]/40 bg-[#5391D5]/5 p-3">
              {/* Reuse a saved design for this function (hidden until one exists
                  / when migration 00166 isn't applied). */}
              {savedDesigns.length > 0 && (
                <div className="rounded-md border border-border bg-card p-2.5">
                  <span className="text-xs font-medium text-foreground">Saved assessments</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <select
                      value={pickId}
                      onChange={(e) => setPickId(e.target.value)}
                      className="min-w-[14rem] rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground"
                    >
                      <option value="">Select a saved assessment…</option>
                      {savedDesigns.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button type="button" disabled={!pickId} onClick={() => loadDesign(pickId)} className="rounded bg-[#010131] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">Load</button>
                    <button type="button" disabled={!pickId} onClick={() => removeDesign(pickId)} className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">Delete</button>
                  </div>
                </div>
              )}
              {builderBusy ? (
                <p className="text-sm text-muted-foreground">Loading this function&apos;s skills and tasks…</p>
              ) : builderError ? (
                <p className="text-sm text-red-600">{builderError}</p>
              ) : builder ? (
                <>
                  {/* Knowledge (MCQ) skills */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">Knowledge section (MCQ)</span>
                      <span className="text-xs text-muted-foreground">{skills.size}/{builder.skills.length} skills</span>
                    </div>
                    {builder.skills.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">This function has no knowledge skills - hands-on only.</p>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {builder.skills.map((s) => {
                            const on = skills.has(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSkills((prev) => toggleIn(prev, s))}
                                className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[#5391D5] bg-[#5391D5]/10 text-[#010131]" : "text-muted-foreground hover:bg-muted"}`}
                              >
                                {on ? "✓ " : ""}{s}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex gap-2 text-xs">
                          <button type="button" onClick={() => setSkills(new Set(builder.skills))} className="text-[#5391D5] hover:underline">Select all</button>
                          <button type="button" onClick={() => setSkills(new Set())} className="text-[#5391D5] hover:underline">Clear</button>
                        </div>
                        <label className="mt-3 flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">Knowledge weight</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={mcqPct}
                            onChange={(e) => setMcqPct(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="w-24 text-right font-medium text-foreground">{mcqPct}% knowledge</span>
                        </label>
                        <p className="text-xs text-muted-foreground">Hands-on tasks carry the remaining {100 - mcqPct}%. Set to 0 to skip the knowledge section.</p>
                      </>
                    )}
                  </div>

                  {/* Hands-on tasks */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">Hands-on tasks</span>
                      <span className="text-xs text-muted-foreground">{blockIds.size}/{allBlockIds.length} tasks</span>
                    </div>
                    {allBlockIds.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">No hands-on tasks for this function.</p>
                    ) : (
                      <>
                        <div className="mt-2 flex gap-2 text-xs">
                          <button type="button" onClick={() => setBlockIds(new Set(allBlockIds))} className="text-[#5391D5] hover:underline">Select all</button>
                          <button type="button" onClick={() => setBlockIds(new Set())} className="text-[#5391D5] hover:underline">Clear</button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {builder.pillars.map((p) => (
                            <div key={p.id} className="rounded-md border border-border bg-card p-2.5">
                              <h4 className="text-xs font-semibold text-[#121232]">{p.nameEn}</h4>
                              <div className="mt-1.5 space-y-1">
                                {p.blocks.map((b) => {
                                  const on = blockIds.has(b.id);
                                  return (
                                    <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => setBlockIds((prev) => toggleIn(prev, b.id))}
                                        className="h-4 w-4 rounded border-border"
                                      />
                                      <span className="text-foreground">{b.nameEn}</span>
                                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{ENGINE_LABEL[b.engineType] ?? b.engineType}</span>
                                      {b.reviewStatus !== "approved" && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{b.reviewStatus}</span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-foreground">
                    <span className="text-muted-foreground">This trial sitting: </span>{customSummary}
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Indicative result - a custom (pick-and-choose) trial issues no credential. Use the full function assessment for a certified result.
                  </div>

                  {/* Save this design for reuse. Uses the Label field as the name. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {loadedId ? (
                      <>
                        <button type="button" onClick={() => saveDesign(false)} disabled={saving || !customValid || !label.trim()} className="rounded border border-[#5391D5] px-3 py-1.5 text-xs font-medium text-[#5391D5] hover:bg-[#5391D5]/10 disabled:opacity-50">
                          {saving ? "Saving…" : "Update saved assessment"}
                        </button>
                        <button type="button" onClick={() => saveDesign(true)} disabled={saving || !customValid || !label.trim()} className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                          Save as new
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => saveDesign(true)} disabled={saving || !customValid || !label.trim()} className="rounded border border-[#5391D5] px-3 py-1.5 text-xs font-medium text-[#5391D5] hover:bg-[#5391D5]/10 disabled:opacity-50">
                        {saving ? "Saving…" : "Save assessment for reuse"}
                      </button>
                    )}
                    {!label.trim() && (
                      <span className="text-[11px] text-muted-foreground">Add a Label below to name and save it.</span>
                    )}
                  </div>
                  {saveMsg && (
                    <p className={`text-[11px] ${saveMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{saveMsg.text}</p>
                  )}
                </>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Method</span>
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "single" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                Individual codes (one per person)
              </button>
              <button
                type="button"
                onClick={() => setMode("pool")}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "pool" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                One shared link (many seats)
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {mode === "single"
                ? "Generates N anonymous single-use codes - one per person."
                : "Generates ONE code with N seats - share the same redeem link with everyone in the group."}
            </span>
          </div>

          {/* The full-scope MCQ weight select; custom scope uses its own slider above. */}
          {scope === "full" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Knowledge (MCQ) section weight</span>
              <select
                value={mcqPct}
                onChange={(e) => setMcqPct(Number(e.target.value))}
                className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
              >
                <option value={0}>Hands-on only (no knowledge section)</option>
                <option value={20}>20% knowledge · 80% hands-on</option>
                <option value={30}>30% knowledge · 70% hands-on</option>
                <option value={40}>40% knowledge · 60% hands-on</option>
                <option value={50}>50% knowledge · 50% hands-on</option>
                <option value={60}>60% knowledge · 40% hands-on</option>
                <option value={70}>70% knowledge · 30% hands-on</option>
              </select>
              <span className="text-xs text-muted-foreground">
                The % is a <strong>score weight</strong>, not a question count. With a knowledge section, each part
                is scored 0-100, then blended by this weight. A combined sitting can issue a Technical Proficiency
                credential when both sections clear their floor and the overall bar.
              </span>
            </label>
          )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setStep(2)} disabled={!functionId} className="gap-1.5">Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
        </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Do you want the vouchers sent to the client to distribute, or emailed to each delegate directly?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => { setTarget("client"); setNewCodes(null); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Building2 className="h-4 w-4 text-[#5391D5]" /> Send to the client</div>
                <p className="mt-1 text-xs text-muted-foreground">Generate a batch, then email or copy the links to the client.</p>
              </button>
              <button type="button" onClick={() => { setTarget("delegates"); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Users className="h-4 w-4 text-[#5391D5]" /> Send to delegates</div>
                <p className="mt-1 text-xs text-muted-foreground">Upload or paste emails; each delegate gets their own link.</p>
              </button>
            </div>
            <div><Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button></div>
          </div>
        )}

        {step === 3 && target === "client" && (
        <div className="space-y-4">
        <Button
          onClick={generate}
          disabled={busy || !functionId || (scope === "custom" && (builderBusy || !customValid))}
          className="mt-3"
        >
          {busy
            ? "Generating…"
            : scope === "custom"
              ? mode === "pool"
                ? "Generate shared trial link"
                : `Generate ${count} trial code(s)`
              : mode === "single"
                ? `Generate ${count} code(s)`
                : "Generate shared link"}
        </Button>
        {scope === "custom" && !customValid && !busy && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pick at least one hands-on task, or select knowledge skills with a knowledge weight above 0.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {newCodes && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">
                {newCodes.length === 1 && mode === "pool"
                  ? "Shared link generated"
                  : `${newCodes.length} code(s) generated`}
              </span>
            </div>

            {/* Single code (shared link OR one individual code): show the full
                copyable redeem link so a delegate starts without typing the code. */}
            {newCodes.length === 1 ? (
              <div className="space-y-2">
                {/* The shareable redeem LINK is the primary action - a delegate
                    clicks it and starts without typing the code. The code itself
                    is shown only as a small reference (no copy-code button). */}
                <div className="flex items-center gap-2">
                  <input readOnly value={redeemUrl(newCodes[0])} onFocus={(e) => e.currentTarget.select()} className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
                  <button onClick={() => copy(`link-${newCodes[0]}`, redeemUrl(newCodes[0]))} className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                    {copied === `link-${newCodes[0]}` ? "Copied" : "Copy link"}
                  </button>
                </div>
                <p className="text-xs text-emerald-700">
                  Anyone with this link starts the assessment without entering a code.
                  {mode === "pool" ? ` Up to ${count} seat(s).` : ""}
                </p>
                <p className="text-[11px] text-slate-500">
                  Voucher code (for reference): <span className="font-mono text-slate-600">{newCodes[0]}</span>
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-2">
                  {/* Copy the redeem LINKS (one per line) rather than bare codes,
                      so each delegate can start without typing a code. */}
                  <button onClick={() => copy("all-links", newCodes.map(redeemUrl).join("\n"))} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                    {copied === "all-links" ? "Copied" : "Copy links"}
                  </button>
                  <button
                    onClick={() => {
                      const csv = "code,redeem_url\n" + newCodes.map((c) => `${c},${redeemUrl(c)}`).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.download = "technical-vouchers.csv";
                      link.click();
                    }}
                    className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-800"
                  >
                    Download CSV
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto font-mono text-xs text-slate-700">
                  {newCodes.map((c) => <div key={c}>{c}</div>)}
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-emerald-700">Delegates redeem at <span className="font-mono">{origin}/tech-sandbox/redeem</span></p>
          </div>
        )}
        {newCodes && newCodes.length > 0 && (
          <div className="mt-4">
            <VoucherClientEmailCard serviceLabel="Techno®" defaultOpen items={newCodes.map((c) => ({ code: c, link: redeemUrl(c) }))} />
          </div>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
        </div>
        </div>
        )}

        {step === 3 && target === "delegates" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a text/CSV file of delegate emails (or paste them, one per line as <code className="font-mono">email</code> or <code className="font-mono">email,name</code>). Each delegate gets their own single-use link emailed to them.</p>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> Upload list (CSV / TXT)
                <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" disabled={delegateBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) importEmailsFromFile(f); e.currentTarget.value = ""; }} />
              </label>
              {delegateText.trim() && <button type="button" onClick={() => { setDelegateText(""); setDelegateMsg(null); }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Clear</button>}
            </div>
            <textarea value={delegateText} onChange={(e) => setDelegateText(e.target.value)} rows={5} placeholder={"one email per line\nahmed@client.com\nsara@client.com, Sara Ali"} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" disabled={delegateBusy} />
            {delegateMsg && <div className="rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-700">{delegateMsg}</div>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={sendToDelegates} disabled={delegateBusy || !delegateText.trim() || !functionId} className="gap-1.5">{delegateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Generate &amp; email each delegate</Button>
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing vouchers</CardTitle>
        </CardHeader>
        <CardContent>
        {emailMsg && (
          <p className={`mb-3 text-xs ${emailMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{emailMsg.text}</p>
        )}
        {vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Delegate</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Used / Max</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.assignedName ? `${v.assignedName}` : "-"}{v.assignedEmail ? ` · ${v.assignedEmail}` : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fnName.get(v.functionId) ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.organizationName ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.usedCount} / {v.maxUses}</TableCell>
                  <TableCell>
                    {v.status === "active" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">active</Badge>
                    ) : (
                      <Badge variant="secondary">{v.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => copy(`row-${v.id}`, redeemUrl(v.code))}
                        className="text-xs text-[#5391D5] hover:underline"
                      >
                        {copied === `row-${v.id}` ? "Copied" : "Copy link"}
                      </button>
                      {v.assignedEmail && (
                        <button
                          onClick={() => emailRow(v.code)}
                          disabled={rowEmailing === v.code}
                          className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
                        >
                          {rowEmailing === v.code ? "Emailing…" : "Email"}
                        </button>
                      )}
                      <button onClick={() => toggle(v.id, v.status)} className="text-xs text-[#5391D5] hover:underline">
                        {v.status === "active" ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
