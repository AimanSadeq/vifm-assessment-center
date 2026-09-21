"use client";

/**
 * A timestamp shown in the reader's own timezone, wherever it is rendered.
 *
 * Server components format on the server, which runs in UTC, so a record
 * created at 21:05 UTC printed as 21 September on the participant's page and
 * 22 September on the admin panel - the same event, two dates, on a record
 * whose whole purpose is to be trusted later. Every Caliber user is UTC+3 or
 * UTC+4, so evening entries crossed the boundary routinely.
 *
 * First render matches the server (UTC), so there is no hydration mismatch;
 * the effect then swaps in the reader's local rendering.
 *
 * A date-only column (Postgres `date`) carries no time and must not be shifted
 * at all: pass dateOnly, and the stored year, month and day are printed as
 * they are.
 */

import { useEffect, useState } from "react";

type Props = {
  value: string | null | undefined;
  /** Include the time alongside the date. */
  withTime?: boolean;
  /** The value is a plain calendar date (no time, no timezone). */
  dateOnly?: boolean;
  fallback?: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fromParts(y: number, m: number, d: number) {
  return `${d} ${MONTHS[m]} ${y}`;
}

function utcText(iso: string, withTime: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const base = fromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (!withTime) return base;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${base}, ${hh}:${mm}`;
}

function localText(iso: string, withTime: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const base = fromParts(d.getFullYear(), d.getMonth(), d.getDate());
  if (!withTime) return base;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${base}, ${hh}:${mm}`;
}

/** The same rendering, for client components that need a plain string. */
export function formatLocalDate(
  value: string | null | undefined,
  opts: { withTime?: boolean; dateOnly?: boolean } = {}
): string | null {
  if (!value) return null;
  if (opts.dateOnly) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? fromParts(y, m - 1, d)
      : value;
  }
  return localText(value, opts.withTime ?? false);
}

export function LocalDate({ value, withTime = false, dateOnly = false, fallback = "-" }: Props) {
  const iso = value ?? null;
  const plain = iso && dateOnly ? iso.slice(0, 10) : null;
  const plainText = plain
    ? (() => {
        const [y, m, d] = plain.split("-").map(Number);
        return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
          ? fromParts(y, m - 1, d)
          : plain;
      })()
    : null;

  const [text, setText] = useState(() => (iso ? (plainText ?? utcText(iso, withTime)) : fallback));

  useEffect(() => {
    if (!iso || plainText) return;
    setText(localText(iso, withTime));
  }, [iso, withTime, plainText]);

  if (!iso) return <>{fallback}</>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
