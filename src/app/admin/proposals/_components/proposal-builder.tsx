"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROPOSAL_SERVICES,
  PROPOSAL_SERVICE_BASIS,
  PROPOSAL_SERVICE_CATEGORY,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_LICENCE_PAYMENT_TERMS,
  defaultTerms,
  PROPOSAL_SECTION_DEFS,
  defaultSectionSelection,
} from "@/lib/proposals/constants";
import { computeLineItems, computeTotals, formatMoney, type ScopeItem } from "@/lib/proposals/pricing";
import {
  computeLicensing,
  normalizeLicensingModel,
  LICENSING_DEFAULTS,
  LICENCE_BENCHMARKS,
  type LicenceModelInput,
  type LicenceTier,
  type PricingMode,
} from "@/lib/proposals/licensing";
import {
  computeEngagement,
  normalizeEngagementModel,
  acEngagementTemplate,
  ENGAGEMENT_BASIS_LABEL,
  type EngagementBasis,
  type EngagementModelInput,
} from "@/lib/proposals/engagement";
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

  const seed = (svc: string) => existing?.scope.find((s) => s.service === svc);
  const seedProduct = (svc: string) => existing?.licensingModel?.products?.find((p) => p.key === svc);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [clientName, setClientName] = useState(existing?.clientName ?? "");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? "");
  const [currency] = useState(existing?.currency ?? "USD");

  // Default NEW proposals to licence mode (per handover); keep the editing proposal's mode.
  const [pricingMode, setPricingMode] = useState<PricingMode>(existing?.pricingMode ?? "licence");

  const [seats, setSeats] = useState<Record<string, number>>(
    Object.fromEntries(PROPOSAL_SERVICES.map((s) => [s.key, seed(s.key)?.seats ?? 0])),
  );
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>(
    Object.fromEntries(
      PROPOSAL_SERVICES.map((s) => [s.key, seedProduct(s.key)?.unitPrice ?? rates[s.key] ?? LICENCE_BENCHMARKS[s.key] ?? 0]),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(PROPOSAL_SERVICES.map((s) => [s.key, seed(s.key)?.scopeNote ?? ""])),
  );

  // Licence parameters (seeded from the editing proposal's model, else defaults).
  const lm = existing?.licensingModel;
  const [bundleDiscountPct, setBundleDiscountPct] = useState(lm?.bundleDiscountPct ?? LICENSING_DEFAULTS.bundleDiscountPct);
  const [supportPct, setSupportPct] = useState(lm?.supportPct ?? LICENSING_DEFAULTS.supportPct);
  const [implementationFee, setImplementationFee] = useState(lm?.implementationFee ?? LICENSING_DEFAULTS.implementationFee);
  const [tier, setTier] = useState<LicenceTier>(lm?.tier === "SOVEREIGN" ? "SOVEREIGN" : "SHARED");
  const [sovereignSetup, setSovereignSetup] = useState(lm?.sovereignSetup ?? LICENSING_DEFAULTS.sovereignSetup);
  const [sovereignAnnual, setSovereignAnnual] = useState(lm?.sovereignAnnual ?? LICENSING_DEFAULTS.sovereignAnnual);
  const [bufferPct, setBufferPct] = useState(lm?.bufferPct ?? LICENSING_DEFAULTS.bufferPct);
  const [upliftPct, setUpliftPct] = useState(lm?.upliftPct ?? LICENSING_DEFAULTS.upliftPct);
  const [pilotOn, setPilotOn] = useState(!!lm?.pilot);
  const [pilotCohort, setPilotCohort] = useState(lm?.pilot?.cohort ?? 0);
  const [pilotWeeks, setPilotWeeks] = useState(lm?.pilot?.durationWeeks ?? 0);
  const [pilotPrice, setPilotPrice] = useState(lm?.pilot?.price ?? 0);
  const [pilotCreditPct, setPilotCreditPct] = useState(lm?.pilot?.creditPct ?? 100);

  const [discountPct, setDiscountPct] = useState(existing?.discountPct ?? 0);
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? "");
  const [introNote, setIntroNote] = useState(existing?.introNote ?? "");
  const [paymentTerms, setPaymentTerms] = useState(
    existing?.paymentTerms ?? ((existing?.pricingMode ?? "licence") === "licence" ? DEFAULT_LICENCE_PAYMENT_TERMS : DEFAULT_PAYMENT_TERMS),
  );
  const [terms, setTerms] = useState(existing?.terms ?? "");
  const [bundleId, setBundleId] = useState<string>(existing?.bundleId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section selection (Phase 2). `selectedSections` holds the ticked titles;
  // mandatory sections are always on and are not shown as toggles.
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(existing?.sectionSelection && existing.sectionSelection.length ? existing.sectionSelection : defaultSectionSelection()),
  );
  function toggleSection(title: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  // ROI / business-case inputs (Phase 2), persisted in licence_data.roi.
  const roi0 = (existing?.licenceData as Record<string, unknown> | undefined)?.roi as
    | { avgSalary?: number; hiresPerYear?: number; accuracyGainPct?: number }
    | undefined;
  const [roiSalary, setRoiSalary] = useState<number>(Number(roi0?.avgSalary) || 0);
  const [roiHires, setRoiHires] = useState<number>(Number(roi0?.hiresPerYear) || 0);
  const [roiGainPct, setRoiGainPct] = useState<number>(Number(roi0?.accuracyGainPct) || 12);

  // Engagement (professional-services) mode: name + participants + free line items.
  type EngLine = { label: string; basis: EngagementBasis; quantity: number; unitRate: number };
  const em = existing?.engagementModel;
  const seedLines: EngLine[] =
    em?.lines && em.lines.length
      ? em.lines.map((l) => ({ label: l.label ?? "", basis: (l.basis as EngagementBasis) ?? "fixed", quantity: Number(l.quantity) || 0, unitRate: Number(l.unitRate) || 0 }))
      : (acEngagementTemplate(8).lines ?? []).map((l) => ({ label: l.label ?? "", basis: (l.basis as EngagementBasis) ?? "fixed", quantity: Number(l.quantity) || 0, unitRate: Number(l.unitRate) || 0 }));
  const [engName, setEngName] = useState<string>(em?.name ?? "Assessment Center");
  const [engParticipants, setEngParticipants] = useState<number>(Number(em?.participants) || 8);
  const [engLines, setEngLines] = useState<EngLine[]>(seedLines);
  const updateLine = (i: number, patch: Partial<EngLine>) => setEngLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setEngLines((prev) => [...prev, { label: "", basis: "fixed", quantity: 1, unitRate: 0 }]);
  const removeLine = (i: number) => setEngLines((prev) => prev.filter((_, j) => j !== i));
  function loadAcTemplate() {
    const t = acEngagementTemplate(engParticipants || 8);
    setEngName(t.name ?? "Assessment Center");
    setEngParticipants(Number(t.participants) || 8);
    setEngLines((t.lines ?? []).map((l) => ({ label: l.label ?? "", basis: (l.basis as EngagementBasis) ?? "fixed", quantity: Number(l.quantity) || 0, unitRate: Number(l.unitRate) || 0 })));
  }

  const selectedClient = clients.find((c) => c.name === clientName) ?? null;

  // Switch mode; swap the payment-terms default only if it is still a known default.
  function switchMode(m: PricingMode) {
    setPricingMode(m);
    setPaymentTerms((prev) =>
      prev.trim() === "" || prev === DEFAULT_PAYMENT_TERMS || prev === DEFAULT_LICENCE_PAYMENT_TERMS
        ? m === "licence"
          ? DEFAULT_LICENCE_PAYMENT_TERMS
          : DEFAULT_PAYMENT_TERMS
        : prev,
    );
  }

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

  // Apply one cohort size (annual volume in licence mode) across all selected services.
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

  const assembleLicensingModel = useCallback(
    (): LicenceModelInput => ({
      products: PROPOSAL_SERVICES.filter((s) => (seats[s.key] || 0) > 0).map((s) => ({
        key: s.key,
        name: s.label,
        category: PROPOSAL_SERVICE_CATEGORY[s.key] ?? "",
        basis: PROPOSAL_SERVICE_BASIS[s.key] ?? "",
        mode: "PER_UNIT" as const,
        volume: seats[s.key],
        unitPrice: unitPrices[s.key] ?? 0,
      })),
      bundleDiscountPct,
      supportPct,
      implementationFee,
      tier,
      sovereignSetup,
      sovereignAnnual,
      bufferPct,
      upliftPct,
      pilot: pilotOn ? { cohort: pilotCohort, durationWeeks: pilotWeeks, price: pilotPrice, creditPct: pilotCreditPct } : null,
    }),
    [seats, unitPrices, bundleDiscountPct, supportPct, implementationFee, tier, sovereignSetup, sovereignAnnual, bufferPct, upliftPct, pilotOn, pilotCohort, pilotWeeks, pilotPrice, pilotCreditPct],
  );

  const licensing = useMemo(() => computeLicensing(normalizeLicensingModel(assembleLicensingModel())), [assembleLicensingModel]);

  const assembleEngagementModel = useCallback(
    (): EngagementModelInput => ({
      name: engName.trim() || "Assessment Center",
      participants: engParticipants,
      discountPct,
      lines: engLines.map((l) => ({ label: l.label.trim(), basis: l.basis, quantity: l.quantity, unitRate: l.unitRate })),
    }),
    [engName, engParticipants, discountPct, engLines],
  );
  const engagement = useMemo(() => computeEngagement(normalizeEngagementModel(assembleEngagementModel())), [assembleEngagementModel]);

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
      pricingMode,
      licensingModel: pricingMode === "licence" ? assembleLicensingModel() : null,
      engagementModel: pricingMode === "engagement" ? assembleEngagementModel() : null,
      sectionSelection: Array.from(selectedSections),
      licenceData: {
        ...(existing?.licenceData ?? {}),
        roi: roiSalary > 0 && roiHires > 0 ? { avgSalary: roiSalary, hiresPerYear: roiHires, accuracyGainPct: roiGainPct } : null,
      },
      bundleId: bundleId || null,
      scope,
      discountPct,
      validUntil: validUntil || null,
      introNote: introNote.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      terms: terms.trim() || defaultTerms(clientName.trim() || "the client", currency),
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

  const isLicence = pricingMode === "licence";
  const isEngagement = pricingMode === "engagement";
  const priced = isLicence ? !!licensing : isEngagement ? !!engagement : scope.length > 0;
  const canSave = title.trim() && clientName.trim() && priced && !busy;

  const numInput = "mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm";

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

      {/* Pricing mode + services */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-foreground">Pricing model</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isLicence
                ? "Annual all-access licence to the Caliber platform (SaaS build-up)."
                : isEngagement
                  ? "Bespoke professional-services engagement (e.g. Assessment Center): fixed fees + per-participant + consultant-days + feedback."
                  : "One-off project fee: participants x the per-service rate."}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button type="button" onClick={() => switchMode("licence")}
              className={`rounded px-3 py-1.5 text-sm font-medium ${isLicence ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>Annual licence</button>
            <button type="button" onClick={() => switchMode("per_project")}
              className={`rounded px-3 py-1.5 text-sm font-medium ${pricingMode === "per_project" ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>Per project</button>
            <button type="button" onClick={() => switchMode("engagement")}
              className={`rounded px-3 py-1.5 text-sm font-medium ${isEngagement ? "bg-[#010131] text-white" : "text-muted-foreground hover:bg-muted"}`}>Engagement</button>
          </div>
        </div>

        {!isEngagement && (<>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium text-foreground">Services &amp; {isLicence ? "annual volumes" : "participants"}</h3>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Apply {isLicence ? "volume" : "cohort size"}
            <input type="number" min={0} className="w-20 rounded border border-border px-2 py-1 text-sm"
              onChange={(e) => applyCohort(Number(e.target.value) || 0)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLicence
            ? "Set the committed annual volume per service (0 excludes it) and its unit price. The a-la-carte total feeds the licence build-up below."
            : "Set participants per service (0 excludes it). Pricing = participants x the per-service rate."}
        </p>

        <div className="space-y-2">
          {PROPOSAL_SERVICES.map((s) => {
            const on = (seats[s.key] || 0) > 0;
            const rate = rates[s.key] ?? 0;
            const unit = unitPrices[s.key] ?? 0;
            return (
              <div key={s.key} className={`rounded-md border p-3 ${on ? "border-[#5391D5]/40 bg-[#5391D5]/5" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[7rem] text-sm font-medium text-foreground">{s.label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isLicence ? "Annual volume" : "Participants"}
                    <input type="number" min={0} value={seats[s.key] || 0}
                      onChange={(e) => setSeats((p) => ({ ...p, [s.key]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-24 rounded border border-border px-2 py-1 text-sm" />
                  </label>
                  {isLicence ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Unit price
                      <input type="number" min={0} value={unit}
                        onChange={(e) => setUnitPrices((p) => ({ ...p, [s.key]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-24 rounded border border-border px-2 py-1 text-sm" />
                      <span className="text-[11px] text-muted-foreground">{PROPOSAL_SERVICE_BASIS[s.key]}</span>
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">Rate: {rate > 0 ? money(rate) : <span className="text-amber-600">not set</span>}</span>
                  )}
                  {on && (
                    <span className="ml-auto text-sm font-semibold tabular-nums text-[#010131]">
                      {money((isLicence ? unit : rate) * (seats[s.key] || 0))}
                    </span>
                  )}
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
        {!isLicence && missingRates.length > 0 && (
          <p className="text-xs text-amber-700">
            No rate set for {missingRates.join(", ")} - they price at 0. <a href="/admin/proposals/rates" className="underline">Set rates</a>.
          </p>
        )}
        {isLicence && !licensing && (
          <p className="text-xs text-amber-700">Add at least one service with an annual volume and a unit price above 0 to price the licence.</p>
        )}
        </>)}

        {isEngagement && (
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Engagement name</span>
                <input value={engName} onChange={(e) => setEngName(e.target.value)} className="mt-1 w-64 rounded-md border border-border bg-card px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Participants (delegates)</span>
                <input type="number" min={0} value={engParticipants} onChange={(e) => setEngParticipants(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-32 rounded-md border border-border bg-card px-3 py-2 text-sm" />
              </label>
              <button type="button" onClick={loadAcTemplate}
                className="rounded-md border border-[#5391D5] px-3 py-2 text-sm font-medium text-[#5391D5] hover:bg-[#5391D5]/5">
                Load Assessment Center template
              </button>
            </div>

            <div className="space-y-2">
              <div className="hidden gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground sm:flex">
                <span className="flex-1">Line item</span>
                <span className="w-40">Basis</span>
                <span className="w-20 text-right">Qty</span>
                <span className="w-24 text-right">Unit rate</span>
                <span className="w-24 text-right">Amount</span>
                <span className="w-6" />
              </div>
              {engLines.map((l, i) => {
                const amount = l.basis === "fixed" ? l.unitRate : l.quantity * l.unitRate;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                    <input value={l.label} onChange={(e) => updateLine(i, { label: e.target.value })} placeholder="e.g. Assessor days"
                      className="min-w-[10rem] flex-1 rounded border border-border bg-card px-2.5 py-1.5 text-sm" />
                    <select value={l.basis} onChange={(e) => updateLine(i, { basis: e.target.value as EngagementBasis })}
                      className="w-40 rounded border border-border bg-card px-2 py-1.5 text-sm">
                      {(Object.keys(ENGAGEMENT_BASIS_LABEL) as EngagementBasis[]).map((b) => (
                        <option key={b} value={b}>{ENGAGEMENT_BASIS_LABEL[b]}</option>
                      ))}
                    </select>
                    <input type="number" min={0} value={l.basis === "fixed" ? 1 : l.quantity} disabled={l.basis === "fixed"}
                      onChange={(e) => updateLine(i, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-20 rounded border border-border bg-card px-2 py-1.5 text-right text-sm disabled:opacity-50" />
                    <input type="number" min={0} value={l.unitRate}
                      onChange={(e) => updateLine(i, { unitRate: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-24 rounded border border-border bg-card px-2 py-1.5 text-right text-sm" />
                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-[#010131]">{money(amount)}</span>
                    <button type="button" onClick={() => removeLine(i)} className="w-6 text-muted-foreground hover:text-red-600" aria-label="Remove line">×</button>
                  </div>
                );
              })}
              <button type="button" onClick={addLine} className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">+ Add line</button>
            </div>

            {engagement ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(engagement.subtotal)}</span></div>
                {engagement.hasDiscount && <div className="flex justify-between text-muted-foreground"><span>Discount ({discountPct}%)</span><span className="tabular-nums">- {money(engagement.discountAmount)}</span></div>}
                <div className="mt-1 flex justify-between border-t border-border pt-1 text-base font-semibold text-[#010131]"><span>Total ({engParticipants} delegates)</span><span className="tabular-nums">{money(engagement.total)}</span></div>
              </div>
            ) : (
              <p className="text-xs text-amber-700">Add at least one line with an amount above 0 to price the engagement.</p>
            )}
          </div>
        )}
      </section>

      {/* Licence parameters */}
      {isLicence && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-medium text-foreground">Licence parameters</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Committed-licence discount %</span>
              <input type="number" min={0} max={100} value={bundleDiscountPct}
                onChange={(e) => setBundleDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Support &amp; SLA %</span>
              <input type="number" min={0} max={100} value={supportPct}
                onChange={(e) => setSupportPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Implementation (one-time)</span>
              <input type="number" min={0} value={implementationFee}
                onChange={(e) => setImplementationFee(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Usage buffer %</span>
              <input type="number" min={0} max={100} value={bufferPct}
                onChange={(e) => setBufferPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Renewal uplift % / year</span>
              <input type="number" min={0} max={100} value={upliftPct}
                onChange={(e) => setUpliftPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Deployment tier</span>
              <select value={tier} onChange={(e) => setTier(e.target.value === "SOVEREIGN" ? "SOVEREIGN" : "SHARED")} className={numInput}>
                <option value="SHARED">Shared cloud</option>
                <option value="SOVEREIGN">Sovereign (dedicated in-country)</option>
              </select>
            </label>
            {tier === "SOVEREIGN" && (
              <>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Sovereign setup (one-time)</span>
                  <input type="number" min={0} value={sovereignSetup}
                    onChange={(e) => setSovereignSetup(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Sovereign annual</span>
                  <input type="number" min={0} value={sovereignAnnual}
                    onChange={(e) => setSovereignAnnual(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
                </label>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 border-t border-border pt-3 text-sm text-foreground">
            <input type="checkbox" checked={pilotOn} onChange={(e) => setPilotOn(e.target.checked)} />
            Offer a fixed-price pilot (alternative entry path)
          </label>
          {pilotOn && (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block text-sm">
                <span className="text-muted-foreground">Pilot cohort</span>
                <input type="number" min={0} value={pilotCohort} onChange={(e) => setPilotCohort(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Duration (weeks)</span>
                <input type="number" min={0} value={pilotWeeks} onChange={(e) => setPilotWeeks(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Pilot fee</span>
                <input type="number" min={0} value={pilotPrice} onChange={(e) => setPilotPrice(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Conversion credit %</span>
                <input type="number" min={0} max={100} value={pilotCreditPct} onChange={(e) => setPilotCreditPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
              </label>
            </div>
          )}
        </section>
      )}

      {/* Commercials */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium text-foreground">Commercials</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {!isLicence && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Discount %</span>
              <input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className={numInput} />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-muted-foreground">Valid until</span>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={numInput} />
          </label>
          {isLicence ? (
            <div className="sm:col-span-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              {licensing ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground"><span>A-la-carte retail</span><span className="tabular-nums">{money(licensing.alaCarteTotal)}</span></div>
                  {licensing.hasBundleDiscount && (
                    <div className="flex justify-between text-muted-foreground"><span>Committed-licence discount ({bundleDiscountPct}%)</span><span className="tabular-nums">- {money(licensing.discountAmount)}</span></div>
                  )}
                  <div className="flex justify-between text-foreground"><span>Committed annual licence</span><span className="tabular-nums">{money(licensing.annualLicence)}</span></div>
                  {licensing.hasSupport && (
                    <div className="flex justify-between text-muted-foreground"><span>Support &amp; SLA ({supportPct}%)</span><span className="tabular-nums">{money(licensing.supportAmount)}</span></div>
                  )}
                  {licensing.isSovereign && licensing.sovereignAnnual > 0 && (
                    <div className="flex justify-between text-muted-foreground"><span>Sovereign annual</span><span className="tabular-nums">{money(licensing.sovereignAnnual)}</span></div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 font-medium text-[#010131]"><span>Annual recurring</span><span className="tabular-nums">{money(licensing.annualRecurring)}</span></div>
                  {licensing.hasOneTime && (
                    <div className="flex justify-between text-muted-foreground"><span>One-time (implementation{licensing.isSovereign && licensing.sovereignSetup > 0 ? " + sovereign setup" : ""})</span><span className="tabular-nums">{money(licensing.oneTimeTotal)}</span></div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-[#010131]"><span>Year-1 investment</span><span className="tabular-nums">{money(licensing.year1Subtotal)}</span></div>
                  <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Year 2 (recurring)</span><span className="tabular-nums">{money(licensing.year2Recurring)}</span></div>
                    <div className="flex justify-between"><span>Year 3 (recurring)</span><span className="tabular-nums">{money(licensing.year3Recurring)}</span></div>
                    <div className="flex justify-between font-medium text-foreground"><span>3-year TCO</span><span className="tabular-nums">{money(licensing.tco3)}</span></div>
                  </div>
                  {licensing.hasBuffer && (
                    <p className="pt-1 text-[11px] text-muted-foreground">Includes a {bufferPct}% usage buffer; excess billed quarterly in arrears at unit prices.</p>
                  )}
                  {licensing.pilot && (
                    <p className="text-[11px] text-muted-foreground">Pilot: {money(licensing.pilot.price)} - {pilotCreditPct}% ({money(licensing.pilot.creditAmount)}) credited on conversion within 90 days.</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Price at least one service above to see the licence build-up.</p>
              )}
            </div>
          ) : isEngagement ? (
            <div className="rounded-md border border-border bg-muted/40 p-2 text-sm">
              {engagement ? (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(engagement.subtotal)}</span></div>
                  {engagement.hasDiscount && <div className="flex justify-between text-muted-foreground"><span>Discount ({discountPct}%)</span><span className="tabular-nums">- {money(engagement.discountAmount)}</span></div>}
                  <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-[#010131]"><span>Engagement total</span><span className="tabular-nums">{money(engagement.total)}</span></div>
                </>
              ) : (
                <p className="text-muted-foreground">Add priced lines above to see the engagement total.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/40 p-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">- {money(totals.discount)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-[#010131]"><span>Total</span><span className="tabular-nums">{money(totals.total)}</span></div>
            </div>
          )}
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

      {/* Business case (ROI) */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-medium text-foreground">Business case (optional)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Adds an indicative-return paragraph to the executive summary. Leave the salary or hires at 0 to omit it.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Avg. annual salary</span>
            <input type="number" min={0} value={roiSalary} onChange={(e) => setRoiSalary(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Hires per year</span>
            <input type="number" min={0} value={roiHires} onChange={(e) => setRoiHires(Math.max(0, Number(e.target.value) || 0))} className={numInput} />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Selection-accuracy gain %</span>
            <input type="number" min={0} max={100} value={roiGainPct} onChange={(e) => setRoiGainPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={numInput} />
          </label>
        </div>
      </section>

      {/* Sections to include */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-medium text-foreground">Sections to include</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Required sections always appear. Untick a recommended section or tick an optional one to tailor the document.</p>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {PROPOSAL_SECTION_DEFS.map((s) => {
            const mandatory = s.tier === "mandatory";
            const checked = mandatory || selectedSections.has(s.title);
            return (
              <label key={s.title} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${checked ? "border-[#5391D5]/40 bg-[#5391D5]/5" : "border-border"}`}>
                <input type="checkbox" checked={checked} disabled={mandatory} onChange={() => toggleSection(s.title)} />
                <span className="text-foreground">{s.title}</span>
                <span className={`ml-auto text-[10px] uppercase tracking-wide ${mandatory ? "text-slate-400" : s.tier === "recommended" ? "text-[#5391D5]" : "text-amber-600"}`}>
                  {mandatory ? "required" : s.tier}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!canSave}
          className="rounded-md bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-50">
          {busy ? "Saving…" : existing ? "Save changes" : "Create proposal"}
        </button>
        {!priced && <span className="text-xs text-muted-foreground">Add at least one {isLicence ? "service with a volume and unit price" : isEngagement ? "priced engagement line" : "service with participants"}.</span>}
      </div>
    </div>
  );
}
