"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { isArcDemoOn, setArcDemo, DEMO_EVENT } from "./arc-demo-state";

/**
 * Flip switch (staff-facing, BD) that starts/stops the ARC guided demo. ON ->
 * navigates to the first step (the rail appears across /ara). OFF -> clears the
 * demo (the rail hides). Stays in sync with the rail's Exit via DEMO_EVENT.
 */
export function GuidedDemoToggle() {
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isArcDemoOn());
    const handler = (e: Event) => setOn(!!(e as CustomEvent).detail);
    window.addEventListener(DEMO_EVENT, handler);
    return () => window.removeEventListener(DEMO_EVENT, handler);
  }, []);

  const toggle = () => {
    if (on) {
      setArcDemo(false);
    } else {
      setArcDemo(true, 0);
      router.push("/ara?demo=1&step=1");
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      title={on ? "Stop the guided demo" : "Start the guided BD walkthrough of ARC"}
      className="inline-flex items-center gap-2 rounded-full border border-[#5391D5]/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-[#5391D5]/5"
    >
      <Compass className="h-3.5 w-3.5 text-[#5391D5]" />
      <span>{on ? "Guided demo: on" : "Start guided demo"}</span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-[#5391D5]" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-[14px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
