"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROPOSAL_SERVICES, DEFAULT_PAYMENT_TERMS, defaultTerms } from "@/lib/proposals/constants";
import { computeLineItems, computeTotals, formatMoney, type ScopeItem } from "@/lib/proposals/pricing";
import { createProposalAction, updateProposalAction } from "../actions";
import type { Proposal } from "@/lib/proposals/service";

export type ClientOption = {
  name: string;
  region: string | null;
  sector: string | null;
  acId: string | null;
  araId: string | null;
};
export type BundleOption = {
  id: string;
  name: string;
  serviceKeys: string[];
  scopeNotes: Record<string, string>; // service -> human scope note derived from service_config
};

export function ProposalBuilder({
  clients,
  bundles,
  rates,
  existing,
}: {
  clients: ClientOption[];
  bundles: BundleOption[];
  rates: Record<string, number>;
  existing?: Proposal;
}) {
  const router = useRouter();

  const seed = (svc: string) =>
    existing?.scope.find((s) => s.service === svc);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [clientName, setClientName] = useState(existing?.clientName ?? "");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? "");
  const [currency] = useState(existing?.currency ?? "USD");
  const [seats, setSeats] = useState<Record<string, number>>(
    Object.fromEntries(PROPOSAL_SERVICES.map((s) => [s.key, seed(s.key)?.seats ?? 0])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(PROPOSAL_SERVICES.map((s) => [s.key, seed(s.key)?.scopeNote ?? ""])),
  );
  const [discountPct, setDiscountPct] = useState(existing?.discountPct ?? 0);
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? "");
  const [introNote, setIntroNote] = useState(existing?.introNote ?? "");
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? DEFAULT_PAYMENT_TERMS);
  const [terms, setTerms] = useState(existing?.terms ?? "");
  const [bundleId, setBundleId] = useState<string>(existing?.bundleId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.name === clientName) ?? null;

  function applyBundle(id: string) {
    setBundleId(id);
    const b = bundles.find((x) => x.id === id);
    if (!b) return;
    setSeats((prev) => {
      const next = { ...prev };
      for (const svc of PROPOSAL_SERVICES) next[svc.key] = b.serviceKeys.includes(svc.key) ? Math.max(prev[svc.key] || 0, 1) : 0;
      return next;
    });
    setNotes((prev) => ({ ...prev, ...b.scopeNotes }));
    if (!title.trim()) setTitle(`${b.name} - Talent Intelligence Proposal`);
  }

  // Apply one cohort size across all currently-selected services.
  function applyCohort(n: number) {
    setSeats((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, (v || 0) > 0 || n > 0 ? n : v])));
  }

  const scope: ScopeItem[] = useMemo(
    () =>
      PROPOSAL_SERVICES.filter((s) => (seats[s.key] || 0) > 0).map((s) => ({
        service: s.key,
        label: s.label,
        seats: seats[s.key],
        scopeNote: notes[s.key]?.trim() || null,
        methodologySlug: s.methodologySlug,
      })),
    [seats, notes],
  );

  const lineItems = useMemo(() => computeLineItems(scope, rates), [scope, rates]);
  const totals = useMemo(() => computeTotals(lineItems, discountPct), [lineItems, discountPct]);
  const money = (n: number) => formatMoney(n, currency);
  const missingRates = scope.filter((s) => !rates[s.service]).map((s) => s.label);

  async function save() {
    setBusy(true);
    setError(null);
    const input = {
      title: title.trim(),
      clientName: clientName.trim(),
      organizationId: selectedClient?.acId ?? null,
      araOrganizationId: selectedClient?.araId ?? null,
      clientRegion: selectedClient?.region ?? null,
      clientSector: selectedClient?.sector ?? null,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      currency,
      bundleId: bundleId || null,
      scope,
      discountPct,
      validUntil: validUntil || null,
      introNote: introNote.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      terms: (terms.trim() || defaultTerms(clientName.trim() || "the client", currency)),
    };
    let id: string;
    if (existing) {
      const res = await updateProposalAction(existing.id, input);
      setBusy(false);
      if ("error" in res) return setError(res.error);
      id = existing.id;
    } else {
      const res = await createProposalAction(input);
      setBusy(false);
      if ("error" in res) return setError(res.error);
      id = res.id;
    }
    router.push(`/admin/proposals/${id}`);
    router.refresh();
  }

  const canSave = title.trim() && clientName.trim() && scope.length > 0 && !busy;

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-foreground">Proposal basics</h2>
        <label className="block text-sm">
          <span className="text-muted-foreground">Proposal title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leadership Assessment Programme 2026"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Client</span>
            <input list="proposal-clients" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client organization"
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            <datalist id="proposal-clients">
              {clients.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Prefill from a bundle (optional)</span>
            <select value={bundleId} onChange={(e) => applyBundle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
              <option value="">- none -</option>
              {bundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Contact name</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Contact email</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </label>
        </div>
      </section>

      {/* Services + seats */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-foreground">Services &amp; participants</h2>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Apply cohort size
            <input type="number" min={0} className="w-20 rounded border border-border px-2 py-1 text-sm"
              onChange={(e) => applyCohort(Number(e.target.value) || 0)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Set participants per service (0 excludes it). Pricing = participants × the per-service rate.</p>
        <div className="space-y-2">
          {PROPOSAL_SERVICES.map((s) => {
            const on = (seats[s.key] || 0) > 0;
            const rate = rates[s.key] ?? 0;
            return (
              <div key={s.key} className={`rounded-md border p-3 ${on ? "border-[#5391D5]/40 bg-[#5391D5]/5" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[7rem] text-sm font-medium text-foreground">{s.label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Participants
                    <input type="number" min={0} value={seats[s.key] || 0}
                      onChange={(e) => setSeats((p) => ({ ...p, [s.key]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-20 rounded border border-border px-2 py-1 text-sm" />
                  </label>
                  <span className="text-xs text-muted-foreground">Rate: {rate > 0 ? money(rate) : <span className="text-amber-600">not set</span>}</span>
                  {on && <span className="ml-auto text-sm font-semibold tabular-nums text-[#010131]">{money(rate * (seats[s.key] || 0))}</span>}
                </div>
                {on && (
                  <input value={notes[s.key] ?? ""} onChange={(e) => setNotes((p) => ({ ...p, [s.key]: e.target.value }))}
                    placeholder="Scope note (optional) - e.g. Logica: numerical + verbal"
                    className="mt-2 w-full rounded border border-border bg-card px-2.5 py-1.5 text-xs" />
                )}
              </div>
            );
          })}
        </div>
        {missingRates.length > 0 && (
          <p className="text-xs text-amber-700">
            No rate set for {missingRates.join(", ")} - they price at 0. <a href="/admin/proposals/rates" className="underline">Set rates</a>.
          </p>
        )}
      </section>

      {/* Commercials */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-foreground">Commercials</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Discount %</span>
            <input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Valid until</span>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </label>
          <div className="rounded-md border border-border bg-muted/40 p-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">- {money(totals.discount)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-[#010131]"><span>Total</span><span className="tabular-nums">{money(totals.total)}</span></div>
          </div>
        </div>
      </section>

      {/* Narrative */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-foreground">Narrative &amp; terms</h2>
        <label className="block text-sm">
          <span className="text-muted-foreground">Executive summary (optional - a default is used if blank)</span>
          <textarea value={introNote} onChange={(e) => setIntroNote(e.target.value)} rows={3}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Payment terms</span>
          <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Terms &amp; conditions (optional - a default is used if blank)</span>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3}
            placeholder="Leave blank to use the standard VIFM confidentiality + data-protection terms."
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!canSave}
          className="rounded-md bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-50">
          {busy ? "Saving…" : existing ? "Save changes" : "Create proposal"}
        </button>
        {scope.length === 0 && <span className="text-xs text-muted-foreground">Add at least one service with participants.</span>}
      </div>
    </div>
  );
}
