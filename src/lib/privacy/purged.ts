/**
 * Sentinel written over personal fields by the retention purges
 * (ac/cognitive, ac/fluent and ac/persona retention/actions.ts) once a record
 * passes its retention window.
 *
 * It matters on READ as well as write: a redemption can be anonymised while its
 * token is still live (the purges filter on redeemed_at, not on whether the
 * sitting was ever completed), so anything that copies identity forward from a
 * redemption must treat this as "no value" rather than as a name or an address.
 * Storing it would be worse than storing null - it reads as a real value on a
 * report or an export.
 */
export const PURGED = "[purged]";

/** True when `value` is absent, blank, or the retention purge sentinel. */
export function isPurgedOrBlank(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || v.toLowerCase() === PURGED;
}

/** The value, or undefined when it is blank or purged - for prefills. */
export function usableIdentity(value: string | null | undefined): string | undefined {
  return isPurgedOrBlank(value) ? undefined : (value as string);
}
