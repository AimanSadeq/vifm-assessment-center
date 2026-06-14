"use client";
// Small client button: spin up a demo sitting for a function and open the live
// sandbox in a new tab, so an admin can walk a client through it.
import { useState } from "react";
import { createSandboxSessionAction } from "../actions";

export function PreviewButton({ functionId }: { functionId: string }) {
  const [busy, setBusy] = useState(false);
  async function preview() {
    setBusy(true);
    const res = await createSandboxSessionAction({
      functionId,
      candidateName: "Demo (preview)",
      organizationName: "VIFM demo",
    });
    setBusy(false);
    if ("token" in res) window.open(`/tech-sandbox/${res.token}`, "_blank");
  }
  return (
    <button
      onClick={preview}
      disabled={busy}
      className="rounded-md bg-[#010131] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {busy ? "Opening…" : "Preview the sandbox"}
    </button>
  );
}
