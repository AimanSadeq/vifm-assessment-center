// Proposal persistence (service-role). Admin CRUD + a token read for the client
// portal. Pricing is recomputed from the CURRENT rate card on create/update and
// snapshotted onto the row, so a later rate change never retro-alters an issued
// proposal. Tolerant: returns [] / null if migration 00174 isn't applied yet.

import { createServiceClient } from "@/lib/supabase/server";
import {
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
  type EngagementModelInput,
  type NormalizedEngagementModel,
} from "./engagement";
import { proposalService } from "./constants";

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
    input.pricingMode === "licence" ? "licence" : input.pricingMode === "engagement" ? "engagement" : "per_project";

  if (mode === "engagement") {
    const engagement = normalizeEngagementModel(input.engagementModel);
    if (!engagement) return { error: "Add at least one priced line (amount above 0) before saving an engagement proposal." };
    const computed = computeEngagement(engagement);
    if (!computed) return { error: "Nothing is priced on this engagement yet." };
    // A single synthetic scope row so the participant-driven PDF sections work;
    // engagement rendering (solution + commercial) is handled explicitly in the builder.
    const scope: ScopeItem[] = [
      { service: "engagement", label: engagement.name, seats: computed.participants, scopeNote: null, methodologySlug: null },
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
      total: computed.year1Subtotal,
    };
  }
  const { items, subtotal, total } = await price(input.scope, input.discountPct);
  return {
    pricingMode: mode,
    licence: null,
    engagement: null,
    scope: input.scope,
    lineItems: items,
    subtotal,
    discountPct: input.discountPct || 0,
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

  const baseRow = { ...proposalFields(input, priced), updated_at: new Date().toISOString() };
  const locRow = { client_city: input.clientCity ?? null, client_country: input.clientCountry ?? null };
  // 00175 columns only. engagement_model (00176) is attached ONLY for engagement
  // mode, so a licence / per-project save never gains a dependency on 00176.
  const licRow = {
    pricing_mode: priced.pricingMode,
    licensing_model: priced.licence,
    section_selection: input.sectionSelection ?? null,
    licence_data: input.licenceData ?? {},
    revision_of_id: input.revisionOfId ?? null,
  };
  const licFull =
    priced.pricingMode === "engagement" ? { ...licRow, engagement_model: priced.engagement } : { ...licRow };
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

  if (error && isMissingColumn(error) && priced.pricingMode !== "per_project") {
    const mig = priced.pricingMode === "engagement" ? "00176" : "00175";
    const label = priced.pricingMode === "engagement" ? "Engagement" : "Licence";
    return { error: `${label}-mode pricing needs migration ${mig}. Apply it before saving in ${priced.pricingMode} mode.` };
  }
  if (error) return { error: error.message ?? "Could not save the proposal." };
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
  const { data, error } = await svc.from("proposals").select("*").order("created_at", { ascending: false }).limit(500);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(rowToProposal);
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
