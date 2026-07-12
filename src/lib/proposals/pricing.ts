// Pure pricing math for proposals: seats x per-service rate -> line items ->
// subtotal / discount / total. No I/O so it is unit-testable and safe to run on
// the client (the builder shows live totals) and the server (the source of truth
// snapshot). Kept dependency-free.

export type ScopeItem = {
  service: string;
  label: string;
  seats: number;
  scopeNote?: string | null;
  methodologySlug?: string | null;
};

export type LineItem = {
  service: string;
  label: string;
  seats: number;
  unitRate: number;
  subtotal: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Clamp a discount percentage to [0, 100] (and coerce NaN/Infinity to 0), so a
 *  stored discount_pct can never disagree with the clamped discount AMOUNT. */
export const clampPct = (p: number) => Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));

/** Build line items from the scope + a service->unitRate map. Zero-seat rows are
 *  dropped (they aren't part of the commercials). */
export function computeLineItems(scope: ScopeItem[], rates: Record<string, number>): LineItem[] {
  return scope
    .filter((s) => (s.seats ?? 0) > 0)
    .map((s) => {
      const unitRate = rates[s.service] ?? 0;
      return {
        service: s.service,
        label: s.label,
        seats: Math.max(0, Math.round(s.seats)),
        unitRate,
        subtotal: round2(unitRate * Math.max(0, Math.round(s.seats))),
      };
    });
}

export function computeTotals(items: LineItem[], discountPct: number) {
  const subtotal = round2(items.reduce((n, i) => n + i.subtotal, 0));
  const discount = round2(subtotal * (clampPct(discountPct) / 100));
  const total = round2(subtotal - discount);
  return { subtotal, discount, total };
}

/** Currency-formatted amount, e.g. "$12,000". Falls back to "USD 12,000" for
 *  any currency code Intl doesn't recognise. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0).toLocaleString("en-US")}`;
  }
}
