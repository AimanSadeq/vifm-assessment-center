// Caliber annual all-access licence pricing (LICENCE mode). Mirrors the VIFM
// Proposals Portal engine + Caliber_Licensing_Cost_Model.xlsx:
//   a-la-carte (sum volume x unit + sum bundle prices)
//     - bundle discount %  = committed annual all-access licence
//     + support & SLA %    + sovereign annual (SOVEREIGN only)  = ANNUAL RECURRING
//   one-time = implementation (+ sovereign setup)
//   YEAR-1 = annual recurring + one-time  (tax applied by the caller)
// Products are denormalised (name/basis/desc snapshot) so issued proposals never
// retro-change if the catalogue moves. Pure maths, no I/O - safe on client
// (live builder totals) and server (snapshot source of truth).

import type { CaliberService } from "@/lib/clients/portal-services";

export type PricingMode = "per_project" | "licence" | "engagement";
export type LicenceTier = "SHARED" | "SOVEREIGN";
export type ProductMode = "PER_UNIT" | "FIXED";

export interface LicenceProductInput {
  key?: string; name?: string; category?: string; desc?: string; descAr?: string;
  basis?: string; mode?: ProductMode; volume?: number; unitPrice?: number; fixedPrice?: number;
}
export interface LicenceBundleInput { name?: string; services?: string; keys?: string[]; price?: number; }
export interface LicencePilotInput { cohort?: number; durationWeeks?: number; price?: number; creditPct?: number; }
export interface LicenceModelInput {
  products?: LicenceProductInput[]; bundles?: LicenceBundleInput[];
  bufferPct?: number; upliftPct?: number; pilot?: LicencePilotInput | null;
  bundleDiscountPct?: number; supportPct?: number; implementationFee?: number;
  tier?: LicenceTier; sovereignSetup?: number; sovereignAnnual?: number;
}

// Concrete (all-fields-present) shapes returned by normalizeLicensingModel, so
// computeLicensing + downstream renderers work with plain numbers, not optionals.
export interface NormalizedProduct {
  key: string; name: string; category: string; desc: string; descAr: string;
  basis: string; mode: ProductMode; volume: number; unitPrice: number; fixedPrice: number;
}
export interface NormalizedBundle { name: string; services: string; keys: string[]; price: number; }
export interface NormalizedPilot { cohort: number; durationWeeks: number; price: number; creditPct: number; }
export interface NormalizedLicenceModel {
  products: NormalizedProduct[]; bundles: NormalizedBundle[];
  bufferPct: number; upliftPct: number; pilot: NormalizedPilot | null;
  bundleDiscountPct: number; supportPct: number; implementationFee: number;
  tier: LicenceTier; sovereignSetup: number; sovereignAnnual: number;
}

const num = (v: unknown, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
const clampPct = (v: unknown) => Math.min(100, Math.max(0, num(v)));
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Normalise submitted input -> clean model, or null when nothing is priced. Never throws. */
export function normalizeLicensingModel(value: unknown): NormalizedLicenceModel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as LicenceModelInput;
  const products = (Array.isArray(v.products) ? v.products : []).map((p) => {
    const mode: ProductMode = p?.mode === "FIXED" ? "FIXED" : "PER_UNIT";
    return {
      key: str(p?.key, 60), name: str(p?.name, 120), category: str(p?.category, 120),
      desc: str(p?.desc, 600), descAr: str(p?.descAr, 600), basis: str(p?.basis, 120), mode,
      volume: Math.max(0, num(p?.volume)), unitPrice: Math.max(0, num(p?.unitPrice)),
      fixedPrice: Math.max(0, num(p?.fixedPrice)),
    };
  }).filter((p) => p.name && (p.mode === "FIXED" ? p.fixedPrice > 0 : p.volume > 0 && p.unitPrice > 0));
  const bundles = (Array.isArray(v.bundles) ? v.bundles : []).map((b) => ({
    name: str(b?.name, 160), services: str(b?.services, 400),
    keys: (Array.isArray(b?.keys) ? b.keys : []).map((k) => str(k, 60)).filter(Boolean).slice(0, 20),
    price: Math.max(0, num(b?.price)),
  })).filter((b) => b.name && b.price > 0);
  if (products.length === 0 && bundles.length === 0) return null;
  const tier: LicenceTier = v.tier === "SOVEREIGN" ? "SOVEREIGN" : "SHARED";
  const pilot = v.pilot && typeof v.pilot === "object" && num(v.pilot.price) > 0 ? {
    cohort: Math.max(0, num(v.pilot.cohort)), durationWeeks: Math.max(0, num(v.pilot.durationWeeks)),
    price: Math.max(0, num(v.pilot.price)), creditPct: clampPct(v.pilot.creditPct),
  } : null;
  return {
    products, bundles, bufferPct: clampPct(v.bufferPct), upliftPct: clampPct(v.upliftPct), pilot,
    bundleDiscountPct: clampPct(v.bundleDiscountPct), supportPct: clampPct(v.supportPct),
    implementationFee: Math.max(0, num(v.implementationFee)), tier,
    sovereignSetup: tier === "SOVEREIGN" ? Math.max(0, num(v.sovereignSetup)) : 0,
    sovereignAnnual: tier === "SOVEREIGN" ? Math.max(0, num(v.sovereignAnnual)) : 0,
  };
}

/** Compute the pre-tax build-up. Returns null for an empty model. */
export function computeLicensing(model: NormalizedLicenceModel | null) {
  if (!model) return null;
  const rawP = model.products ?? [], rawB = model.bundles ?? [];
  if (rawP.length === 0 && rawB.length === 0) return null;
  const products = rawP.map((p) => ({ ...p, isFixed: p.mode === "FIXED",
    lineTotal: p.mode === "FIXED" ? num(p.fixedPrice) : p.volume * p.unitPrice }));
  const bundles = rawB.map((b) => ({ ...b, price: num(b.price) }));
  const bundlesTotal = bundles.reduce((s, b) => s + b.price, 0);
  const alaCarteTotal = products.reduce((s, p) => s + p.lineTotal, 0) + bundlesTotal;
  const bundleDiscountPct = clampPct(model.bundleDiscountPct);
  const discountAmount = alaCarteTotal * (bundleDiscountPct / 100);
  const annualLicence = alaCarteTotal - discountAmount;
  const supportPct = clampPct(model.supportPct);
  const supportAmount = annualLicence * (supportPct / 100);
  const isSovereign = model.tier === "SOVEREIGN";
  const sovereignAnnual = isSovereign ? Math.max(0, num(model.sovereignAnnual)) : 0;
  const annualRecurring = annualLicence + supportAmount + sovereignAnnual;
  const implementationFee = Math.max(0, num(model.implementationFee));
  const sovereignSetup = isSovereign ? Math.max(0, num(model.sovereignSetup)) : 0;
  const oneTimeTotal = implementationFee + sovereignSetup;
  const year1Subtotal = annualRecurring + oneTimeTotal;
  const uplift = clampPct(model.upliftPct);
  const year2Recurring = annualRecurring * (1 + uplift / 100);
  const year3Recurring = annualRecurring * Math.pow(1 + uplift / 100, 2);
  return {
    products, bundles, hasProducts: true, hasBundles: bundles.length > 0, bundlesTotal,
    bufferPct: clampPct(model.bufferPct), hasBuffer: clampPct(model.bufferPct) > 0,
    alaCarteTotal, bundleDiscountPct, hasBundleDiscount: discountAmount > 0, discountAmount,
    annualLicence, supportPct, hasSupport: supportAmount > 0, supportAmount,
    tier: isSovereign ? "SOVEREIGN" : "SHARED", isSovereign, sovereignAnnual,
    annualRecurring, implementationFee, hasImplementationFee: implementationFee > 0,
    sovereignSetup, oneTimeTotal, hasOneTime: oneTimeTotal > 0, year1Subtotal,
    upliftPct: uplift, year2Recurring, year3Recurring,
    tco3: year1Subtotal + year2Recurring + year3Recurring,
    pilot: model.pilot && num(model.pilot.price) > 0 ? {
      ...model.pilot, creditAmount: Math.max(0, num(model.pilot.price)) * clampPct(model.pilot.creditPct) / 100,
    } : null,
    hasPilot: !!(model.pilot && num(model.pilot.price) > 0),
  };
}

/** Editable licence-builder defaults (all overridable per deal). */
export const LICENSING_DEFAULTS = {
  bundleDiscountPct: 63,
  supportPct: 12,
  implementationFee: 110000,
  sovereignSetup: 90000,
  sovereignAnnual: 90000,
  bufferPct: 10,
  upliftPct: 5,
} as const;

/** Benchmark unit prices for the 7 sellable services (planning anchors, editable
 *  per deal). Used as the builder's unit-price fallback when the rate card is 0. */
export const LICENCE_BENCHMARKS: Record<CaliberService, number> = {
  prehire: 60,
  logica: 30,
  persona: 30,
  techno: 90,
  fluent: 40,
  arc: 6000,
  reflect: 180,
};
