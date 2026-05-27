"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2, ShieldCheck } from "lucide-react";

/**
 * Shown once every lesson is complete. Claims the course-completion
 * credential (POST /api/academy/complete) and then links to its public
 * verification page. If a credential was already issued, links straight to it.
 */
export function CompleteCourseButton({
  enrollmentId,
  alreadyCompleted,
  initialVerificationCode,
}: {
  enrollmentId: string;
  alreadyCompleted: boolean;
  initialVerificationCode: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(initialVerificationCode);
  const [error, setError] = useState("");

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/academy/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.verificationCode) setCode(data.verificationCode);
        router.refresh();
      } else {
        setError("Could not issue your credential. Please try again.");
      }
    } catch {
      setError("Could not issue your credential. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <a
        href={`/verify/${code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        <ShieldCheck className="h-4 w-4" /> View your credential
      </a>
    );
  }

  return (
    <div>
      <button
        onClick={claim}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
        {busy ? "Issuing..." : alreadyCompleted ? "Get your credential" : "Claim your credential"}
      </button>
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
