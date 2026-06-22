// Client state for the guided demo. localStorage is the source of truth (one
// demo active across the app at a time); a same-tab CustomEvent keeps the single
// root-mounted component in sync when state changes outside React's flow.

export const ACTIVE_LS = "vifmGuidedDemo:active"; // active trackId, or absent
export const STEP_LS = "vifmGuidedDemo:step"; // 0-based step index
export const DEMO_EVENT = "vifmGuidedDemoChange";

export function getActiveTrackId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_LS);
}

export function getActiveStep(): number {
  if (typeof window === "undefined") return 0;
  const s = window.localStorage.getItem(STEP_LS);
  return s && /^\d+$/.test(s) ? parseInt(s, 10) : 0;
}

export function startDemo(trackId: string, step = 0): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_LS, trackId);
  window.localStorage.setItem(STEP_LS, String(step));
  window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { trackId, on: true } }));
}

export function setDemoStep(step: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STEP_LS, String(step));
}

export function stopDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_LS);
  window.localStorage.removeItem(STEP_LS);
  window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { trackId: null, on: false } }));
}
