"use client";

// Fetches a server-generated PDF in-page and saves it as a file, instead of
// pointing a bare <a> at the route. PDF routes launch Chromium server-side
// (~2-5s on Render), and a bare link strands the user on the browser's dark,
// empty PDF-viewer shell (or, in embedded previews, a blank pane) with zero
// feedback - which reads as broken. This keeps them on the page with a visible
// "Preparing PDF…" state and surfaces a real error message on failure.
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function PdfDownloadButton({
  url,
  filename,
  label,
  className,
  busyLabel = "Preparing PDF…",
}: {
  url: string;
  filename: string;
  label: string;
  className: string;
  busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let msg = `Could not generate the PDF (HTTP ${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* non-JSON error body */
        }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setError("Could not download the PDF. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={busy} className={className} aria-busy={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? busyLabel : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
