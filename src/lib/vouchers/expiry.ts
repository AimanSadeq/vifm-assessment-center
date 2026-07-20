/**
 * Voucher expiry-date semantics.
 *
 * Every issuing surface collects the expiry from a plain `<input type="date">`
 * (src/components/shared/voucher-details-fields.tsx), which yields a bare
 * `YYYY-MM-DD`. Postgres reads that as MIDNIGHT AT THE START of the day, so a
 * voucher an admin marked "valid through 30 September" stopped working as
 * 30 September began - the client silently lost the final day they were sold.
 *
 * Commercially, "valid through <date>" means the end of that date, so a bare
 * date is normalised to the last instant of the day.
 *
 * Timezone: end-of-day is anchored to UTC deliberately. The whole GCC region
 * sits east of UTC (+3/+4), so 23:59:59.999Z on the chosen date falls in the
 * small hours of the NEXT local day - the named day is always fully covered,
 * wherever the delegate is. Anchoring to Gulf time instead would cut short
 * anyone sitting west of it. Erring long by a few hours is the safe direction:
 * it never denies access someone paid for.
 */

/** A bare calendar date as produced by `<input type="date">`. */
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise a voucher expiry for storage.
 *
 * - blank / null / undefined  -> null (never expires)
 * - `YYYY-MM-DD`              -> that day at 23:59:59.999Z (end of day)
 * - anything else             -> returned untouched, so an explicit timestamp
 *   is respected and a malformed value still surfaces as a database error
 *   rather than being silently swallowed into "no expiry".
 */
export function normalizeVoucherExpiry(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (BARE_DATE.test(value)) return `${value}T23:59:59.999Z`;
  return value;
}
