// Robust clipboard copy for client components.
//
// navigator.clipboard.writeText rejects with NotAllowedError in contexts that
// lack the clipboard-write permission - notably inside an iframe without an
// allow="clipboard-write" policy (e.g. the dev preview), or when the document
// isn't focused. This helper tries the async Clipboard API first, then falls
// back to the legacy execCommand("copy") path (which works in many of those
// contexts), and only throws when BOTH fail. Callers can await it inside a
// try/catch to show success/failure; an unhandled rejection (the cause of the
// "Write permission denied" runtime error) can no longer happen.

export async function copyToClipboard(text: string): Promise<void> {
  // Preferred: async Clipboard API.
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // permission denied / not focused - fall through to the legacy path
  }

  // Legacy fallback: a hidden, selected textarea + execCommand("copy"). Runs in
  // the same gesture continuation, so it succeeds in most iframe/denied cases.
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) return;
  }

  throw new Error("Clipboard copy not permitted");
}
