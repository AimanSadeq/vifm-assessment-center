"use client";

/**
 * The centre manual, who has a copy, and whether the centre is ready.
 *
 * The manual is generated on demand rather than stored, so what this panel
 * manages is distribution: which variant went to whom, cut from which version,
 * and whether it has come back. That is the whole of 4.41 - a manual carries
 * the exercise material the centre depends on being unseen, and "secure
 * distribution" with no record of distribution is only quiet.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatLocalDate } from "@/components/shared/local-date";
import { CENTRE_ROLES, centreRoleName } from "@/lib/ac/centre-roles";
import {
  recordManualIssueAction,
  markManualReturnedAction,
  bumpManualVersionAction,
  confirmCentreReadinessAction,
} from "../actions";

type Row = Record<string, unknown>;

export function CentreManualPanel({
  engagementId,
  engagement,
  issues = [],
  staffedRoles = [],
}: {
  engagementId: string;
  engagement: Row;
  issues?: Row[];
  staffedRoles?: { roleKey: string; profileId: string; name: string; email: string | null }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [variant, setVariant] = useState("full");
  const [who, setWho] = useState("");
  const [readinessNote, setReadinessNote] = useState("");

  const version = (engagement.manual_version as number) ?? 1;
  const readyAt = engagement.readiness_confirmed_at as string | null;

  const run = async (key: string, fn: () => Promise<{ error?: unknown } | { ok?: boolean }>, msg: string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res && "error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.", { duration: 8000 });
      return false;
    }
    toast.success(msg);
    router.refresh();
    return true;
  };

  // Only offer role manuals for roles somebody actually holds, plus the full
  // manual. A manual for an unfilled role is a document with no reader.
  const variants = [
    { value: "full", label: "Full centre manual" },
    ...Array.from(new Set(staffedRoles.map((r) => r.roleKey))).map((k) => ({
      value: k,
      label: `${centreRoleName(k)} manual`,
    })),
  ];
  const holdersOf = (key: string) => staffedRoles.filter((r) => r.roleKey === key);
  const outstanding = issues.filter((i) => !i.returned_at);
  const stale = outstanding.filter((i) => (i.version as number) < version);

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Centre manual
          <span className="ms-2 text-xs font-normal text-muted-foreground">version {version}</span>
          {stale.length > 0 && (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              {stale.length} holding an older version
            </span>
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/admin/engagements/${engagementId}/centre-manual?variant=full`}>Full manual (PDF)</a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIssuing((v) => !v)}>
            {issuing ? "Cancel" : "Record an issue"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Generated from the design, so it describes the centre that will actually run. Each role&apos;s manual is
          the same document with the sections that role has no business reading removed - an assessor does not get
          the role-player&apos;s objectives, and a role-player does not get the assessor guidance.
        </p>

        {/* Per-role downloads, only for roles somebody holds. */}
        <div className="flex flex-wrap gap-2">
          {CENTRE_ROLES.filter((r) => holdersOf(r.key).length > 0).map((r) => (
            <Button key={r.key} size="sm" variant="outline" asChild>
              <a href={`/api/admin/engagements/${engagementId}/centre-manual?variant=${r.key}`}>
                {r.name} ({holdersOf(r.key).length})
              </a>
            </Button>
          ))}
          {staffedRoles.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No centre roles assigned yet, so there are no role manuals to cut. Assign them above.
            </p>
          )}
        </div>

        {issuing && (
          <div className="space-y-2 rounded border p-3">
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value);
                  setWho("");
                }}
              >
                {variants.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              {holdersOf(variant).length > 0 ? (
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                >
                  <option value="">Who received it...</option>
                  {holdersOf(variant).map((h) => (
                    <option key={h.profileId} value={h.profileId}>
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className="max-w-xs"
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  placeholder="Who received it"
                />
              )}
              <Button
                size="sm"
                disabled={busy === "issue" || !who}
                onClick={async () => {
                  const holder = holdersOf(variant).find((h) => h.profileId === who);
                  const ok = await run(
                    "issue",
                    () =>
                      recordManualIssueAction({
                        engagementId,
                        variant,
                        issuedToProfileId: holder?.profileId ?? null,
                        issuedToName: holder?.name ?? who,
                        issuedToEmail: holder?.email ?? null,
                      }),
                    "Recorded."
                  );
                  if (ok) {
                    setIssuing(false);
                    setWho("");
                  }
                }}
              >
                Record
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Records that a copy of version {version} went to this person. Download the PDF from the buttons above
              and send it however you normally would.
            </p>
          </div>
        )}

        {/* Who holds what. */}
        {issues.length === 0 ? (
          <p className="text-muted-foreground">No copies recorded as issued.</p>
        ) : (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Copies issued</div>
            <ul className="mt-1 space-y-1">
              {issues.map((i) => {
                const isStale = !i.returned_at && (i.version as number) < version;
                return (
                  <li key={i.id as string} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                    <span>
                      {i.issued_to_name as string}
                      <span className="ms-2 text-xs text-muted-foreground">
                        {i.variant === "full" ? "Full manual" : centreRoleName(i.variant as string)} &middot; v
                        {i.version as number} &middot; {formatLocalDate(i.issued_at as string)}
                      </span>
                      {i.confidential ? (
                        <span className="ms-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
                          contains exercise material
                        </span>
                      ) : null}
                      {isStale && (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                          older than version {version}
                        </span>
                      )}
                    </span>
                    {i.returned_at ? (
                      <span className="text-xs text-emerald-700">
                        returned {formatLocalDate(i.returned_at as string)}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === (i.id as string)}
                        onClick={() =>
                          run(i.id as string, () => markManualReturnedAction(i.id as string), "Recorded as returned.")
                        }
                      >
                        Returned or destroyed
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {outstanding.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {outstanding.length} {outstanding.length === 1 ? "copy is" : "copies are"} still out. Account for
                them after the centre (6.9).
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={busy === "bump"}
            onClick={() =>
              run("bump", () => bumpManualVersionAction(engagementId), `Now version ${version + 1}. Re-issue anyone holding an older cut.`)
            }
          >
            The design changed - new version
          </Button>
          <span className="text-xs text-muted-foreground">
            Marks copies already out as older, so their holders can be found and re-issued.
          </span>
        </div>

        {/* 6.3 - ready to run. */}
        <div className="border-t pt-3">
          <div className="font-medium">Ready to run</div>
          {readyAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {(engagement.readiness_confirmed_name as string) ?? "Confirmed"} confirmed the venue, equipment and
              documentation were ready on {formatLocalDate(readyAt)}.
              {engagement.readiness_note ? ` ${engagement.readiness_note as string}` : ""}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Before the centre runs, the Centre Manager confirms the venue, the equipment and the documentation
                are actually ready (6.3). Nothing can derive this - no query knows whether the room has a working
                clock in it.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  className="max-w-md"
                  value={readinessNote}
                  onChange={(e) => setReadinessNote(e.target.value)}
                  placeholder="Anything worth noting. Optional."
                />
                <Button
                  size="sm"
                  disabled={busy === "ready"}
                  onClick={() =>
                    run(
                      "ready",
                      () => confirmCentreReadinessAction({ engagementId, note: readinessNote }),
                      "Confirmed."
                    )
                  }
                >
                  Confirm ready
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
