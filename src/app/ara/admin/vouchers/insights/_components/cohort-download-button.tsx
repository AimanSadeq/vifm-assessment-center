"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Downloads a cohort file (the all-reports ZIP or the cohort dashboard PDF)
 * from an admin API route. A plain link to these routes left the browser
 * spinning for a minute with no feedback and no error if the server gave up;
 * this fetches with a visible "preparing" state and reports a failure as a
 * toast instead of a blank tab.
 */
export function CohortDownloadButton({
  href,
  label,
  busyLabel,
  icon,
}: {
  href: string;
  label: string;
  busyLabel: string;
  icon: ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        let message = `Download failed (${res.status}).`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* non-JSON error body */
        }
        toast.error(message);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] ?? "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const skipped = Number(res.headers.get("X-Reports-Skipped") ?? "0");
      if (skipped > 0) toast.message(`${skipped} report${skipped === 1 ? "" : "s"} could not be included; see README.txt in the ZIP.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {busy ? busyLabel : label}
    </Button>
  );
}
