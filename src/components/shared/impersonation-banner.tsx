import Link from "next/link";
import { Eye, ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";

/**
 * H4 — admin "view as candidate" banner.
 *
 * Rendered at the top of any /candidate/* page when ?asAdmin=1 is in the URL.
 * Designed to be visually loud without overwhelming — the candidate-portal
 * shell underneath stays the same, so admins see exactly what the candidate
 * sees with a clear "you're impersonating" reminder.
 *
 * Auth note: in production this should also check the session role to refuse
 * the asAdmin query when the caller isn't actually an admin. With
 * AUTH_ENABLED=false in dev, we render unconditionally on the query alone —
 * the auth gate goes in when src/middleware.ts flips. The banner itself is
 * purely visual; nothing about it expands a candidate's actual access.
 */

export type ImpersonationBannerProps = {
  candidateName: string;
  candidateEmail?: string | null;
  /** Where the admin returns to when they click "Exit". Defaults to /admin/engagements. */
  exitHref?: string;
};

export async function ImpersonationBanner({
  candidateName,
  candidateEmail,
  exitHref = "/admin/engagements",
}: ImpersonationBannerProps) {
  const t = await getServerT();
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 mb-4 flex items-center gap-3 text-amber-900">
      <Eye className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide font-semibold">
          {t("impersonation.eyebrow")}
        </p>
        <p className="text-sm truncate">
          {t("impersonation.viewingAs")} <span className="font-semibold">{candidateName}</span>
          {candidateEmail ? (
            <span className="text-amber-800/80"> · {candidateEmail}</span>
          ) : null}
        </p>
      </div>
      <Link
        href={exitHref}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white/60 px-2.5 py-1 text-xs font-medium hover:bg-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("impersonation.exit")}
      </Link>
    </div>
  );
}
