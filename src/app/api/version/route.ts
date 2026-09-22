import { NextResponse } from "next/server";

// Which commit is actually running. Render deploys are manual, so a push to
// master proves nothing about production; without this there is no way to tell
// a deployed commit from a pending one except the Render dashboard. Public on
// purpose - a short commit sha is not a secret, and a version endpoint that
// needs a session cannot be checked by the person who most needs to check it.
// Nothing else about the environment is exposed.
export const dynamic = "force-dynamic";

export function GET() {
  const commit = process.env.RENDER_GIT_COMMIT ?? null;

  return NextResponse.json(
    {
      commit: commit ? commit.slice(0, 7) : "local",
      branch: process.env.RENDER_GIT_BRANCH ?? "local",
      deployed: Boolean(commit),
      now: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
