import { getCompetencyGap, GAP_TONES } from "@/lib/scoring/competency-gap";

type Variant = "full" | "short" | "score";

type Props = {
  score: number | null | undefined;
  target?: number;
  variant?: Variant;
  className?: string;
};

/**
 * Server-renderable badge that turns a BARS score + target into a
 * gap-severity chip ("Significant Gap (3 levels)", "On Target", etc).
 *
 * - variant="full"  → "Score/Target · Label" (default)
 * - variant="short" → "Label" only
 * - variant="score" → "score" inside a tone-coloured pill
 */
export function GapBadge({
  score,
  target,
  variant = "full",
  className = "",
}: Props) {
  const data = getCompetencyGap(score, target);
  if (!data) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${className}`}
      >
        Pending
      </span>
    );
  }

  const tone = GAP_TONES[data.severity];

  let text: string;
  if (variant === "short") {
    text = data.label;
  } else if (variant === "score") {
    text = String(data.score);
  } else {
    text = `${data.score}/${data.target} · ${data.label}`;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
        borderColor: tone.border,
      }}
    >
      {text}
    </span>
  );
}
