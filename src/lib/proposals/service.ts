// Proposal persistence (service-role). Admin CRUD + a token read for the client
// portal. Pricing is recomputed from the CURRENT rate card on create/update and
// snapshotted onto the row, so a later rate change never retro-alters an issued
// proposal. Tolerant: returns [] / null if migration 00174 isn't applied yet.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import {
  clampPct,
  computeLineItems,
  computeTotals,
  type LineItem,
  type ScopeItem,
} from "./pricing";
import {
  computeLicensing,
  normalizeLicensingModel,
  type LicenceModelInput,
  type NormalizedLicenceModel,
  type PricingMode,
} from "./licensing";
import {
  computeEngagement,
  normalizeEngagementModel,
  resolveDataResidency,
  dataResidencyLineLabel,
  withEngagementResidency,
  type EngagementModelInput,
  type NormalizedEngagementModel,
} from "./engagement";
import { proposalService, PROPOSAL_SECTION_TITLES } from "./constants";
import { sanitizeRichHtml } from "./rich-text";

export type ProposalStatus = "draft" | "issued" | "won" | "lost";

export type Proposal = {
  id: string;
  title: string;
  organizationId: string | null;
  araOrganizationId: string | null;
  bundleId: string | null;
  clientName: string;
  clientRegion: string | null;
  clientSector: string | null;
  clientCity: string | null;
  clientCountry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  currency: string;
  status: ProposalStatus;
  pricingMode: PricingMode;
  licensingModel: LicenceModelInput | null;
  engagementModel: EngagementModelInput | null;
  scope: ScopeItem[];
  lineItems: LineItem[];
  subtotal: number;
  discountPct: number;
  total: number;
  validUntil: string | null;
  introNote: string | null;
  terms: string | null;
  paymentTerms: string | null;
  sectionSelection: string[] | null;
  revisionOfId: string | null;
  licenceData: Record<string, unknown>;
  accessToken: string;
  createdAt: string;
  issuedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
};

export type ProposalRate = { serviceKey: string; unitRate: number; currency: string; label: string | null };

/**
 * Which statuses a CLIENT token link may serve. Allowlist (not a `!== "draft"`
 * blocklist): only a live/accepted offer is client-facing. `draft` (WIP) and
 * `lost` (dead / withdrawn / superseded-by-a-revision) never serve - so marking a
 * proposal `lost` REVOKES its client link, the only revoke lever the module has.
 */
export function isProposalClientVisible(p: { status: ProposalStatus }): boolean {
  return p.status === "issued" || p.status === "won";
}

/** True once a proposal's validity date has passed (date-only, pinned to noon UTC
 *  like the render, so it never drifts a day with the server timezone). */
export function isProposalExpired(p: { validUntil: string | null }): boolean {
  if (!p.validUntil) return false;
  const until = new Date(`${p.validUntil.slice(0, 10)}T12:00:00Z`).getTime();
  return Number.isFinite(until) && until < Date.now();
}

/** Whether a client should be shown an EXPIRED notice. Only an OUTSTANDING `issued`
 *  offer expires - a `won` deal is closed, so its original offer-validity date is
 *  moot AND the renewal flow deliberately re-points a won client at this page long
 *  after that date (a 12-month anniversary vs a 30-day offer window). */
export function isProposalOfferExpired(p: { status: ProposalStatus; validUntil: string | null }): boolean {
  return p.status === "issued" && isProposalExpired(p);
}

function missing(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205" || err?.code === "PGRST204";
}

/** A missing COLUMN (not a missing table) - lets a write peel newer columns and
 *  retry. Distinct from missing() so a genuinely absent table still fails loud. */
function isMissingColumn(err: { code?: string } | null): boolean {
  return err?.code === "PGRST204" || err?.code === "42703";
}

// ── Rate card ──
export async function loadRates(): Promise<ProposalRate[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("proposal_rates")
    .select("service_key, unit_rate, currency, label")
    .order("label");
  if (error || !data) return [];
  return data.map((r) => ({
    serviceKey: r.service_key as string,
    unitRate: Number(r.unit_rate ?? 0),
    currency: (r.currency as string) ?? "USD",
    label: (r.label as string | null) ?? null,
  }));
}

/** service_key -> unit_rate, for the pricing engine. */
export async function rateMap(): Promise<Record<string, number>> {
  const rates = await loadRates();
  return Object.fromEntries(rates.map((r) => [r.serviceKey, r.unitRate]));
}

export async function setRate(serviceKey: string, unitRate: number, currency: string, updatedBy?: string | null) {
  const svc = createServiceClient();
  const { error } = await svc.from("proposal_rates").upsert(
    {
      service_key: serviceKey,
      unit_rate: Math.max(0, Number(unitRate) || 0),
      currency: currency || "USD",
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "service_key" },
  );
  if (error) return { error: error.message };
  return { ok: true as const };
}

// ── Proposals ──
function rowToProposal(r: Record<string, unknown>): Proposal {
  return {
    id: r.id as string,
    title: r.title as string,
    organizationId: (r.organization_id as string | null) ?? null,
    araOrganizationId: (r.ara_organization_id as string | null) ?? null,
    bundleId: (r.bundle_id as string | null) ?? null,
    clientName: r.client_name as string,
    clientRegion: (r.client_region as string | null) ?? null,
    clientSector: (r.client_sector as string | null) ?? null,
    clientCity: (r.client_city as string | null) ?? null,
    clientCountry: (r.client_country as string | null) ?? null,
    contactName: (r.contact_name as string | null) ?? null,
    contactEmail: (r.contact_email as string | null) ?? null,
    currency: (r.currency as string) ?? "USD",
    status: (r.status as ProposalStatus) ?? "draft",
    pricingMode: (r.pricing_mode as PricingMode) ?? "per_project",
    licensingModel: (r.licensing_model as LicenceModelInput | null) ?? null,
    engagementModel: (r.engagement_model as EngagementModelInput | null) ?? null,
    scope: Array.isArray(r.scope) ? (r.scope as ScopeItem[]) : [],
    lineItems: Array.isArray(r.line_items) ? (r.line_items as LineItem[]) : [],
    subtotal: Number(r.subtotal ?? 0),
    discountPct: Number(r.discount_pct ?? 0),
    total: Number(r.total ?? 0),
    validUntil: (r.valid_until as string | null) ?? null,
    introNote: (r.intro_note as string | null) ?? null,
    terms: (r.terms as string | null) ?? null,
    paymentTerms: (r.payment_terms as string | null) ?? null,
    sectionSelection: Array.isArray(r.section_selection) ? (r.section_selection as string[]) : null,
    revisionOfId: (r.revision_of_id as string | null) ?? null,
    licenceData: (r.licence_data as Record<string, unknown> | null) ?? {},
    accessToken: r.access_token as string,
    createdAt: r.created_at as string,
    issuedAt: (r.issued_at as string | null) ?? null,
    sentAt: (r.sent_at as string | null) ?? null,
    sentTo: (r.sent_to as string | null) ?? null,
  };
}

export type ProposalInput = {
  title: string;
  organizationId?: string | null;
  araOrganizationId?: string | null;
  bundleId?: string | null;
  clientName: string;
  clientRegion?: string | null;
  clientSector?: string | null;
  clientCity?: string | null;
  clientCountry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  currency: string;
  pricingMode?: PricingMode;
  licensingModel?: LicenceModelInput | null;
  engagementModel?: EngagementModelInput | null;
  sectionSelection?: string[] | null;
  licenceData?: Record<string, unknown> | null;
  revisionOfId?: string | null;
  scope: ScopeItem[];
  discountPct: number;
  validUntil?: string | null;
  introNote?: string | null;
  terms?: string | null;
  paymentTerms?: string | null;
  createdBy?: string | null;
};

/** Compute the priced snapshot (line items + totals) from the current rate card. */
async function price(scope: ScopeItem[], discountPct: number) {
  const items = computeLineItems(scope, await rateMap());
  const totals = computeTotals(items, discountPct);
  return { items, ...totals };
}

type PricedSnapshot = {
  pricingMode: PricingMode;
  licence: NormalizedLicenceModel | null;
  engagement: NormalizedEngagementModel | null;
  scope: ScopeItem[];
  lineItems: LineItem[];
  subtotal: number;
  discountPct: number;
  total: number;
};

/** Resolve the priced snapshot for either mode. In licence mode the licence
 *  build-up drives scope/line_items/rollups (so every scope-driven PDF section
 *  keeps working); per-project keeps seats x rate-card. Returns an error string
 *  when a licence proposal has nothing priced. */
async function buildPricedSnapshot(input: ProposalInput): Promise<PricedSnapshot | { error: string }> {
  const mode: PricingMode =
    input.pricingMode === "licence"
      ? "licence"
      : input.pricingMode === "engagement"
        ? "engagement"
        : input.pricingMode === "combined"
          ? "combined"
          : "per_project";

  // Optional data-residency cost (proposal-level, stored in licenceData). It is a
  // real line item in the pricing model: a pre-subtotal line for per-project +
  // engagement (discountable like any line), and a one-time build-up line for
  // licence (a bundle discount on infrastructure would be wrong).
  const dataResidencyFee = Math.max(0, Number((input.licenceData as Record<string, unknown> | null | undefined)?.dataResidencyFee) || 0);
  const drResidency = resolveDataResidency((input.licenceData as Record<string, unknown> | null | undefined)?.dataResidency);
  const drLineLabel = dataResidencyLineLabel(drResidency);

  if (mode === "combined") {
    // A services block (per-project seats x rate OR an annual licence) PLUS one or
    // more engagements, itemised together with one combined total. Each block keeps
    // its own discount; data residency is added exactly once (on the services block).
    const rawServicesMode = (input.licenceData as Record<string, unknown> | null | undefined)?.combinedServicesMode;
    const servicesMode = rawServicesMode === "licence" ? "licence" : rawServicesMode === "none" ? "none" : "per_project";

    // Data residency sits on the SERVICES block once: a per-project line item (in the
    // discountable subtotal) or baked into the licence Year-1 (never both, never on
    // the engagement).
    const drLine = { service: "data_residency", label: drLineLabel, seats: 1, unitRate: dataResidencyFee, subtotal: dataResidencyFee };
    let licence: NormalizedLicenceModel | null = null;
    let servicesScope: ScopeItem[] = [];
    let servicesLineItems: LineItem[] = [];
    let servicesSubtotal = 0;
    let servicesTotal = 0;
    if (servicesMode === "licence") {
      licence = normalizeLicensingModel(input.licensingModel);
      const c = computeLicensing(licence);
      if (c) {
        servicesScope = c.products.map((pr) => ({
          service: pr.key, label: pr.name, seats: pr.volume, scopeNote: null,
          methodologySlug: proposalService(pr.key)?.methodologySlug ?? null,
        }));
        servicesLineItems = c.products.map((pr) => ({ service: pr.key, label: pr.name, seats: pr.volume, unitRate: pr.unitPrice, subtotal: pr.lineTotal }));
        servicesSubtotal = c.alaCarteTotal;
        servicesTotal = c.year1Subtotal + dataResidencyFee; // residency as a one-time licence line (render shows it)
      } else {
        licence = null;
      }
    } else if (servicesMode === "per_project") {
      const base = await price(input.scope, input.discountPct);
      const items = dataResidencyFee > 0 ? [...base.items, drLine] : base.items;
      const t = computeTotals(items, input.discountPct || 0);
      servicesScope = input.scope;
      servicesLineItems = items;
      servicesSubtotal = t.subtotal;
      servicesTotal = t.total;
    }

    // Engagement block - NO residency injection here (it is on the services block).
    const engagement = normalizeEngagementModel(input.engagementModel);
    const eng = computeEngagement(engagement);
    const engagementTotal = eng?.total ?? 0;
    const engagementSubtotal = eng?.subtotal ?? 0;

    if (servicesTotal === 0 && engagementTotal === 0) {
      return { error: "Add at least one priced service or a priced engagement before saving a combined proposal." };
    }

    const engScopeRow: ScopeItem[] = eng ? [{ service: "engagement", label: eng.name, seats: eng.participants, scopeNote: null, methodologySlug: null }] : [];
    const engLineItems: LineItem[] = eng ? eng.lines.map((l) => ({ service: "engagement", label: l.label, seats: l.quantity, unitRate: l.unitRate, subtotal: l.lineTotal })) : [];
    return {
      pricingMode: mode,
      licence,
      engagement,
      scope: [...servicesScope, ...engScopeRow],
      lineItems: [...servicesLineItems, ...engLineItems],
      subtotal: servicesSubtotal + engagementSubtotal,
      discountPct: clampPct(input.discountPct || 0),
      total: servicesTotal + engagementTotal, // residency already inside servicesTotal
    };
  }

  if (mode === "engagement") {
    // Compute from the residency-injected model so the data-residency line flows
    // through subtotal / discount / total; store the ORIGINAL model (without the
    // residency line) so a builder edit does not duplicate it (it re-injects fresh).
    const computed = computeEngagement(
      normalizeEngagementModel(withEngagementResidency(input.engagementModel, drLineLabel, dataResidencyFee)),
    );
    if (!computed) return { error: "Add at least one priced line (amount above 0) before saving an engagement proposal." };
    const engagement = normalizeEngagementModel(input.engagementModel) ?? normalizeEngagementModel(withEngagementResidency(input.engagementModel, drLineLabel, dataResidencyFee));
    // A single synthetic scope row so the participant-driven PDF sections work;
    // engagement rendering (solution + commercial) is handled explicitly in the builder.
    const scope: ScopeItem[] = [
      { service: "engagement", label: computed.name, seats: computed.participants, scopeNote: null, methodologySlug: null },
    ];
    const lineItems: LineItem[] = computed.lines.map((l) => ({
      service: "engagement",
      label: l.label,
      seats: l.quantity,
      unitRate: l.unitRate,
      subtotal: l.lineTotal,
    }));
    return {
      pricingMode: mode,
      licence: null,
      engagement,
      scope,
      lineItems,
      subtotal: computed.subtotal,
      discountPct: computed.discountPct,
      total: computed.total,
    };
  }

  if (mode === "licence") {
    const licence = normalizeLicensingModel(input.licensingModel);
    if (!licence) {
      return { error: "Add at least one priced service (annual volume x unit price) before saving a licence proposal." };
    }
    const computed = computeLicensing(licence);
    if (!computed) return { error: "Nothing is priced on this licence proposal yet." };
    const scope: ScopeItem[] = computed.products.map((p) => ({
      service: p.key,
      label: p.name,
      seats: p.volume,
      scopeNote: null,
      methodologySlug: proposalService(p.key)?.methodologySlug ?? null,
    }));
    const lineItems: LineItem[] = computed.products.map((p) => ({
      service: p.key,
      label: p.name,
      seats: p.volume,
      unitRate: p.unitPrice,
      subtotal: p.lineTotal,
    }));
    return {
      pricingMode: mode,
      licence,
      engagement: null,
      scope,
      lineItems,
      subtotal: computed.alaCarteTotal,
      discountPct: computed.bundleDiscountPct,
      total: computed.year1Subtotal + dataResidencyFee,
    };
  }
  const base = await price(input.scope, input.discountPct);
  // Data residency is a real line item in the itemized list -> part of the subtotal
  // the discount applies to (a pre-fee bolt-on would sit outside the model).
  const items: LineItem[] =
    dataResidencyFee > 0
      ? [...base.items, { service: "data_residency", label: drLineLabel, seats: 1, unitRate: dataResidencyFee, subtotal: dataResidencyFee }]
      : base.items;
  const { subtotal, total } = computeTotals(items, input.discountPct || 0);
  return {
    pricingMode: mode,
    licence: null,
    engagement: null,
    scope: input.scope,
    lineItems: items,
    subtotal,
    discountPct: clampPct(input.discountPct || 0),
    total,
  };
}

/** The editable columns common to create + update (excludes status / created_by,
 *  which must not be reset on edit). */
function proposalFields(input: ProposalInput, priced: PricedSnapshot): Record<string, unknown> {
  return {
    title: input.title,
    organization_id: input.organizationId ?? null,
    ara_organization_id: input.araOrganizationId ?? null,
    bundle_id: input.bundleId ?? null,
    client_name: input.clientName,
    client_region: input.clientRegion ?? null,
    client_sector: input.clientSector ?? null,
    contact_name: input.contactName ?? null,
    contact_email: input.contactEmail ?? null,
    currency: input.currency || "USD",
    scope: priced.scope,
    line_items: priced.lineItems,
    subtotal: priced.subtotal,
    discount_pct: priced.discountPct,
    total: priced.total,
    valid_until: input.validUntil || null,
    intro_note: input.introNote ?? null,
    terms: input.terms ?? null,
    payment_terms: input.paymentTerms ?? null,
  };
}

export async function createProposal(input: ProposalInput): Promise<{ ok: true; id: string } | { error: string }> {
  const svc = createServiceClient();
  const priced = await buildPricedSnapshot(input);
  if ("error" in priced) return priced;

  const baseRow = {
    ...proposalFields(input, priced),
    status: "draft",
    created_by: input.createdBy ?? null,
  };
  const locRow = { client_city: input.clientCity ?? null, client_country: input.clientCountry ?? null };
  const licRow = {
    pricing_mode: priced.pricingMode,
    licensing_model: priced.licence,
    engagement_model: priced.engagement,
    section_selection: input.sectionSelection ?? null,
    licence_data: input.licenceData ?? {},
    revision_of_id: input.revisionOfId ?? null,
  };
  // Two independent optional column groups peel on an un-applied migration:
  //   locRow  = client_city/client_country (00177)
  //   licRow  = pricing_mode + licence/engagement snapshot (00175/00176)
  // Licence + engagement rows NEVER peel licRow (that would silently downgrade to a
  // per-project row) - they only peel locRow. Per-project rows peel both, keeping as
  // many columns as each environment supports.
  const candidates =
    priced.pricingMode !== "per_project"
      ? [{ ...baseRow, ...locRow, ...licRow }, { ...baseRow, ...licRow }]
      : [
          { ...baseRow, ...locRow, ...licRow },
          { ...baseRow, ...licRow },
          { ...baseRow, ...locRow },
          { ...baseRow },
        ];

  let data: { id: string } | null = null;
  let error: { code?: string; message?: string } | null = null;
  for (const row of candidates) {
    const res = await svc.from("proposals").insert(row).select("id").single();
    data = (res.data as { id: string } | null) ?? null;
    error = res.error;
    if (!error) break;
    if (!isMissingColumn(error)) break;
  }

  if (priced.pricingMode === "combined" && (error?.code === "23514" || isMissingColumn(error))) {
    return { error: "Combined-mode pricing needs migration 00178. Apply it before saving in combined mode." };
  }
  if (error && isMissingColumn(error) && priced.pricingMode !== "per_project") {
    const mig = priced.pricingMode === "engagement" ? "00176" : "00175";
    const label = priced.pricingMode === "engagement" ? "Engagement" : "Licence";
    return { error: `${label}-mode pricing needs migration ${mig}. Apply it before saving in ${priced.pricingMode} mode.` };
  }
  if (error || !data) {
    return { error: missing(error) ? "Proposals need migration 00174 applied." : error?.message ?? "Could not save the proposal." };
  }
  return { ok: true, id: data.id as string };
}

export async function updateProposal(
  id: string,
  input: ProposalInput,
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const priced = await buildPricedSnapshot(input);
  if ("error" in priced) return priced;

  // Per-section text (licence_data.sectionOverrides) is owned by the on-page section
  // editor. A pricing/structure save carries a page-load snapshot of licence_data, so
  // read-merge the DB's CURRENT sectionOverrides to avoid reverting a just-saved edit.
  const licenceData: Record<string, unknown> = { ...(input.licenceData ?? {}) };
  try {
    const { data: cur } = await svc.from("proposals").select("licence_data").eq("id", id).single();
    const dbLd = (cur?.licence_data as Record<string, unknown> | null) ?? {};
    if (dbLd.sectionOverrides !== undefined) licenceData.sectionOverrides = dbLd.sectionOverrides;
    else delete licenceData.sectionOverrides;
  } catch {
    /* tolerate a read failure - fall back to the submitted licence_data */
  }

  const baseRow = { ...proposalFields(input, priced), updated_at: new Date().toISOString() };
  const locRow = { client_city: input.clientCity ?? null, client_country: input.clientCountry ?? null };
  // 00175 columns only. engagement_model (00176) is attached ONLY for engagement
  // mode, so a licence / per-project save never gains a dependency on 00176.
  const licRow = {
    pricing_mode: priced.pricingMode,
    licensing_model: priced.licence,
    section_selection: input.sectionSelection ?? null,
    licence_data: licenceData,
    revision_of_id: input.revisionOfId ?? null,
  };
  const licFull =
    priced.pricingMode === "engagement" || priced.pricingMode === "combined"
      ? { ...licRow, engagement_model: priced.engagement }
      : { ...licRow };
  // locRow (00177) and licFull (00175/00176) peel independently; licence + engagement
  // rows never peel licFull (no silent downgrade), only locRow. See createProposal.
  const candidates =
    priced.pricingMode !== "per_project"
      ? [{ ...baseRow, ...locRow, ...licFull }, { ...baseRow, ...licFull }]
      : [
          { ...baseRow, ...locRow, ...licFull },
          { ...baseRow, ...licFull },
          { ...baseRow, ...locRow },
          { ...baseRow },
        ];

  let error: { code?: string; message?: string } | null = null;
  for (const row of candidates) {
    const res = await svc.from("proposals").update(row).eq("id", id);
    error = res.error;
    if (!error) break;
    if (!isMissingColumn(error)) break;
  }

  if (priced.pricingMode === "combined" && (error?.code === "23514" || isMissingColumn(error))) {
    return { error: "Combined-mode pricing needs migration 00178. Apply it before saving in combined mode." };
  }
  if (error && isMissingColumn(error) && priced.pricingMode !== "per_project") {
    const mig = priced.pricingMode === "engagement" ? "00176" : "00175";
    const label = priced.pricingMode === "engagement" ? "Engagement" : "Licence";
    return { error: `${label}-mode pricing needs migration ${mig}. Apply it before saving in ${priced.pricingMode} mode.` };
  }
  if (error) return { error: error.message ?? "Could not save the proposal." };
  return { ok: true };
}

/** Patch ONLY the per-section text overrides (the on-page section editor), merging into
 *  the licence_data bag so roi / dataResidency / combinedServicesMode survive. Titles are
 *  validated against the known section set; empty {en,ar} entries are dropped so the bag
 *  stays lean and an unedited section stays dynamic. Does not re-price. */
export async function updateProposalSectionOverrides(
  id: string,
  overrides: Record<string, { en?: string; ar?: string }>,
  managedTitles?: string[],
): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const known = new Set(PROPOSAL_SECTION_TITLES);
  const cleaned: Record<string, { en?: string; ar?: string }> = {};
  for (const [title, v] of Object.entries(overrides || {})) {
    if (!known.has(title) || !v || typeof v !== "object") continue;
    // Sanitise the rich-text HTML to the safe inline-formatting allowlist before storing
    // (defence in depth - the renderer sanitises again). Cap length after sanitising.
    const en = typeof v.en === "string" ? sanitizeRichHtml(v.en).slice(0, 60000) : "";
    const ar = typeof v.ar === "string" ? sanitizeRichHtml(v.ar).slice(0, 60000) : "";
    if (en || ar) cleaned[title] = { ...(en ? { en } : {}), ...(ar ? { ar } : {}) };
  }

  const { data, error: readErr } = await svc.from("proposals").select("licence_data").eq("id", id).single();
  if (readErr) return { error: readErr.message ?? "Proposal not found." };
  const existing = ((data?.licence_data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  // Preserve overrides the editor did NOT manage (e.g. a section currently excluded from
  // the document), so toggling a section off then saving does not wipe its custom text.
  const managed = new Set((managedTitles ?? []).filter((t) => known.has(t)));
  const prior = (existing.sectionOverrides as Record<string, { en?: string; ar?: string }> | undefined) ?? {};
  const preserved: Record<string, { en?: string; ar?: string }> = {};
  if (managed.size) {
    for (const [t, v] of Object.entries(prior)) if (known.has(t) && !managed.has(t)) preserved[t] = v;
  }
  const merged = { ...existing, sectionOverrides: { ...preserved, ...cleaned } };

  const { error } = await svc
    .from("proposals")
    .update({ licence_data: merged, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isMissingColumn(error) || missing(error)) return { error: "Proposals need migration 00174 (licence_data) applied." };
    return { error: error.message ?? "Could not save the section text." };
  }
  return { ok: true };
}

/** Duplicate a proposal into a new DRAFT that is a revision of the original,
 *  numbered "(rev N)" and linked via revision_of_id. Copies design + commercials;
 *  the new draft re-prices from the current rate card (per-project) or the stored
 *  licence model. Best-effort revision numbering if the column isn't applied yet. */
export async function duplicateAsRevision(id: string): Promise<{ ok: true; id: string } | { error: string }> {
  const src = await loadProposal(id);
  if (!src) return { error: "Proposal not found." };
  const rootId = src.revisionOfId ?? src.id;
  const svc = createServiceClient();
  let revNo = 2; // the original counts as rev 1; the first revision is "(rev 2)"
  try {
    const { count } = await svc.from("proposals").select("id", { count: "exact", head: true }).eq("revision_of_id", rootId);
    revNo = (count ?? 0) + 2;
  } catch {
    /* revision_of_id column may not be applied yet - keep the default */
  }
  const baseTitle = src.title.replace(/\s*\(rev \d+\)\s*$/i, "");
  const input: ProposalInput = {
    title: `${baseTitle} (rev ${revNo})`,
    organizationId: src.organizationId,
    araOrganizationId: src.araOrganizationId,
    bundleId: src.bundleId,
    clientName: src.clientName,
    clientRegion: src.clientRegion,
    clientSector: src.clientSector,
    clientCity: src.clientCity,
    clientCountry: src.clientCountry,
    contactName: src.contactName,
    contactEmail: src.contactEmail,
    currency: src.currency,
    pricingMode: src.pricingMode,
    licensingModel: src.licensingModel,
    engagementModel: src.engagementModel,
    sectionSelection: src.sectionSelection,
    licenceData: src.licenceData,
    revisionOfId: rootId,
    scope: src.scope,
    discountPct: src.discountPct,
    validUntil: src.validUntil,
    introNote: src.introNote,
    terms: src.terms,
    paymentTerms: src.paymentTerms,
  };
  return createProposal(input);
}

export async function setProposalStatus(id: string, status: ProposalStatus): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "issued") patch.issued_at = new Date().toISOString();
  const { error } = await svc.from("proposals").update(patch).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markProposalSent(id: string, to: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("proposals")
    .update({ sent_at: new Date().toISOString(), sent_to: to, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function loadProposals(): Promise<Proposal[]> {
  const svc = createServiceClient();
  // Page the full set (created_at desc, id as a unique tiebreak): the dashboard
  // computes ARR / win-rate / pipeline over EVERY proposal, so a fixed .limit(500)
  // silently dropped the oldest rows and distorted the headline commercial KPIs.
  try {
    const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
      svc
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    return rows.map(rowToProposal);
  } catch {
    return [];
  }
}

export async function loadProposal(id: string): Promise<Proposal | null> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("proposals").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToProposal(data as Record<string, unknown>);
}

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;
export async function findProposalByToken(token: string): Promise<Proposal | null> {
  if (!TOKEN_RE.test(token)) return null;
  const svc = createServiceClient();
  const { data, error } = await svc.from("proposals").select("*").eq("access_token", token).maybeSingle();
  if (error || !data) return null;
  return rowToProposal(data as Record<string, unknown>);
}
