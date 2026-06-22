import type { DemoServiceModule } from "./types";
import persona from "./persona";
import cognitive from "./cognitive";
import technical from "./technical";
import academy from "./academy";
import ara from "./ara";
import reflect from "./reflect";
import readiness from "./readiness";

// The 7 per-service demo modules beyond the inline AC / Pre-Hire / Fluent.
// SEED order = dependencies before dependents: Academy reads AC candidates (AC is
// inline and seeds first); Readiness reads Persona/Reflect, so it comes last.
// purge.ts iterates this list in REVERSE so dependents are removed first.
export const DEMO_SERVICE_MODULES: DemoServiceModule[] = [
  persona,
  cognitive,
  technical,
  academy,
  ara,
  reflect,
  readiness,
];
