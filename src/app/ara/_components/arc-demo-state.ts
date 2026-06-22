// Shared client state for the ARC guided demo so the flip-switch toggle, the
// rail, and the rail's Exit all stay in sync within the tab. localStorage is the
// source of truth (survives navigation); a same-tab CustomEvent notifies the
// other components (the native `storage` event only fires in OTHER tabs).

export const DEMO_LS = "arcGuidedDemo";
export const DEMO_STEP_LS = "arcGuidedDemo:step";
export const DEMO_EVENT = "arcDemoChange";

export function isArcDemoOn(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(DEMO_LS) === "1";
}

/** Turn the guided demo on/off and notify the rail + toggle in this tab. */
export function setArcDemo(on: boolean, step = 0): void {
  if (typeof window === "undefined") return;
  if (on) {
    window.localStorage.setItem(DEMO_LS, "1");
    window.localStorage.setItem(DEMO_STEP_LS, String(step));
  } else {
    window.localStorage.removeItem(DEMO_LS);
    window.localStorage.removeItem(DEMO_STEP_LS);
  }
  window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: on }));
}
