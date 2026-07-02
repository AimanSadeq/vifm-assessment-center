"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  href: string;
  label: string;
  /**
   * When true, go back to the previous page in history instead of always
   * navigating to `href` - so "Back" returns wherever the user came from
   * (e.g. an assessment results page), not a fixed destination. Falls back to
   * `href` when there's no in-app history (page opened directly / in a new tab).
   */
  history?: boolean;
  /** Colour override for dark surfaces (e.g. "text-white/70 hover:text-white"). */
  className?: string;
};

const BASE = "inline-flex items-center gap-1.5 text-sm transition-colors";
const TONE = "text-muted-foreground hover:text-foreground";

export function BackLink({ href, label, history, className }: Props) {
  const router = useRouter();
  const cls = `${BASE} ${className ?? TONE}`;

  if (history) {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push(href);
          }
        }}
        className={cls}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={cls}>
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
