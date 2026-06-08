"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  href: string;
  label: string;
  /**
   * When true, go back to the previous page in history instead of always
   * navigating to `href` — so "Back" returns wherever the user came from
   * (e.g. an assessment results page), not a fixed destination. Falls back to
   * `href` when there's no in-app history (page opened directly / in a new tab).
   */
  history?: boolean;
};

const CLASS =
  "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors";

export function BackLink({ href, label, history }: Props) {
  const router = useRouter();

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
        className={CLASS}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={CLASS}>
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
