"use client";

/**
 * Who is running this centre, and what makes them qualified to.
 *
 * Before this existed the platform knew about assessors and nobody else: no
 * manager, no administrator, no record that anyone was competent at anything.
 * A client asking "who ran this, and what makes them qualified" had no answer.
 *
 * Two different things sit here on purpose. Assigning someone is a plan.
 * Confirming competence is evidence, and BPS 5.22 asks for it to have been
 * DEMONSTRATED - so the confirmation asks what was actually seen, and the
 * activation gate refuses a centre whose staff have not been confirmed.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CENTRE_ROLES, type CentreRole } from "@/lib/ac/centre-roles";
import { formatLocalDate } from "@/components/shared/local-date";
import { assignCentreRoleAction, removeCentreRoleAction, setRoleCompetenceAction } from "../actions";

type Row = Record<string, unknown>;

export function CentreRolesPanel({
  engagementId,
  people = [],
  assignments = [],
  competence = [],
  required = [],
  blocking = [],
  cautions = [],
}: {
  engagementId: string;
  people?: Row[];
  assignments?: Row[];
  competence?: Row[];
  required?: { key: string; name: string; clause: string }[];
  blocking?: string[];
  cautions?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [external, setExternal] = useState(false);
  const [certifying, setCertifying] = useState<{ profileId: string; roleKey: string } | null>(null);
  const [evidence, setEvidence] = useState("");
  const [trainedOn, setTrainedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const requiredKeys = new Set(required.map((r) => r.key));
  const nameOf = (id: unknown) => {
    const p = people.find((x) => x.id === id);
    return (p?.full_name as string | undefined) ?? (p?.email as string | undefined) ?? "Unknown";
  };
  const competenceFor = (profileId: unknown, roleKey: string) =>
    competence.find((c) => c.profile_id === profileId && c.role_key === roleKey);

  const run = async (key: string, fn: () => Promise<{ error?: unknown; ok?: boolean }>, msg: string) => {
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

  const rolesToShow: CentreRole[] = CENTRE_ROLES.filter(
    (r) => requiredKeys.has(r.key) || assignments.some((a) => a.role_key === r.key)
  );
  const otherRoles = CENTRE_ROLES.filter((r) => !rolesToShow.some((x) => x.key === r.key));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Who is running this centre
          {blocking.length > 0 && (
            <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-normal text-rose-900">
              {blocking.length} to resolve
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {blocking.length > 0 && (
          <div className="rounded border border-rose-300 bg-rose-50 p-3 text-rose-900">
            <div className="font-medium">This centre cannot be activated yet</div>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {cautions.map((c) => (
          <p key={c} className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            {c}
          </p>
        ))}

        {rolesToShow.map((role) => {
          const held = assignments.filter((a) => a.role_key === role.key);
          return (
            <div key={role.key} className="rounded border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{role.name}</span>
                  {requiredKeys.has(role.key) && (
                    <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                      required · {role.clause}
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{role.purpose}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpenRole(openRole === role.key ? null : role.key);
                    setPick("");
                    setExternal(false);
                  }}
                >
                  {openRole === role.key ? "Cancel" : "Assign"}
                </Button>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  What this person has to be able to do
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
                  {role.competences.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>

              {openRole === role.key && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-muted/40 p-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                  >
                    <option value="">Who...</option>
                    {people.map((p) => (
                      <option key={p.id as string} value={p.id as string}>
                        {(p.full_name as string) ?? (p.email as string)}
                        {p.email ? ` (${p.email as string})` : ""}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
                    From the client, not VIFM
                  </label>
                  <Button
                    size="sm"
                    disabled={busy === `assign-${role.key}` || !pick}
                    onClick={async () => {
                      const ok = await run(
                        `assign-${role.key}`,
                        () =>
                          assignCentreRoleAction({
                            engagementId,
                            roleKey: role.key,
                            profileId: pick,
                            isExternal: external,
                          }),
                        "Assigned."
                      );
                      if (ok) setOpenRole(null);
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}

              {held.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nobody assigned.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {held.map((a) => {
                    const comp = competenceFor(a.profile_id, role.key);
                    const status = (comp?.status as string) ?? null;
                    const expires = comp?.expires_on as string | null;
                    const lapsed =
                      status === "competent" && expires ? new Date(expires) < new Date() : false;
                    const tone =
                      status === "competent" && !lapsed
                        ? "bg-emerald-100 text-emerald-900"
                        : status === "in_training"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-rose-100 text-rose-900";
                    const label =
                      !status
                        ? "no competence record"
                        : lapsed
                          ? `lapsed ${formatLocalDate(expires, { dateOnly: true })}`
                          : status === "competent"
                            ? expires
                              ? `competent until ${formatLocalDate(expires, { dateOnly: true })}`
                              : "competent"
                            : status === "in_training"
                              ? "in training"
                              : "withdrawn";
                    const isCertifying =
                      certifying?.profileId === a.profile_id && certifying?.roleKey === role.key;
                    return (
                      <li key={a.id as string} className="rounded border bg-background p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span>{nameOf(a.profile_id)}</span>
                            {a.is_external ? (
                              <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                client
                              </span>
                            ) : null}
                            <span className={`ms-2 rounded px-1.5 py-0.5 text-[10px] ${tone}`}>{label}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCertifying(isCertifying ? null : { profileId: a.profile_id as string, roleKey: role.key });
                                setEvidence((comp?.evidence as string) ?? "");
                                setTrainedOn((comp?.trained_on as string) ?? "");
                                setExpiresOn((comp?.expires_on as string) ?? "");
                              }}
                            >
                              {status === "competent" && !lapsed ? "Update" : "Confirm competence"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600"
                              disabled={busy === (a.id as string)}
                              onClick={() =>
                                run(a.id as string, () => removeCentreRoleAction(a.id as string), "Removed from the role.")
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>

                        {isCertifying && (
                          <div className="mt-2 space-y-2 rounded bg-muted/40 p-2">
                            <Textarea
                              rows={2}
                              value={evidence}
                              onChange={(e) => setEvidence(e.target.value)}
                              placeholder="What was actually seen? For example: assessed two live role plays under observation, ratings within one point of the lead assessor on every competency."
                            />
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <label className="flex items-center gap-1">
                                Trained
                                <Input
                                  type="date"
                                  className="h-8 max-w-[10rem]"
                                  value={trainedOn}
                                  onChange={(e) => setTrainedOn(e.target.value)}
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                Valid until
                                <Input
                                  type="date"
                                  className="h-8 max-w-[10rem]"
                                  value={expiresOn}
                                  onChange={(e) => setExpiresOn(e.target.value)}
                                />
                              </label>
                              <span className="text-muted-foreground">Leave blank if it does not expire.</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={busy === `cert-${a.id as string}`}
                                onClick={async () => {
                                  const ok = await run(
                                    `cert-${a.id as string}`,
                                    () =>
                                      setRoleCompetenceAction({
                                        profileId: a.profile_id as string,
                                        roleKey: role.key,
                                        status: "competent",
                                        evidence,
                                        trainedOn: trainedOn || null,
                                        expiresOn: expiresOn || null,
                                      }),
                                    "Competence confirmed."
                                  );
                                  if (ok) setCertifying(null);
                                }}
                              >
                                Confirm competent
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === `cert-${a.id as string}`}
                                onClick={() =>
                                  run(
                                    `cert-${a.id as string}`,
                                    () =>
                                      setRoleCompetenceAction({
                                        profileId: a.profile_id as string,
                                        roleKey: role.key,
                                        status: "in_training",
                                        evidence,
                                        trainedOn: trainedOn || null,
                                      }),
                                    "Recorded as in training."
                                  )
                                }
                              >
                                In training
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-600"
                                disabled={busy === `cert-${a.id as string}`}
                                onClick={() =>
                                  run(
                                    `cert-${a.id as string}`,
                                    () =>
                                      setRoleCompetenceAction({
                                        profileId: a.profile_id as string,
                                        roleKey: role.key,
                                        status: "withdrawn",
                                        evidence,
                                      }),
                                    "Competence withdrawn."
                                  )
                                }
                              >
                                Withdraw
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {otherRoles.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Other centre roles this centre does not require ({otherRoles.length})
            </summary>
            <div className="mt-2 space-y-2">
              {otherRoles.map((role) => (
                <div key={role.key} className="rounded border border-dashed p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{role.name}</span>
                      <p className="text-xs text-muted-foreground">{role.purpose}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenRole(role.key);
                        setPick("");
                      }}
                    >
                      Assign anyway
                    </Button>
                  </div>
                  {openRole === role.key && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={pick}
                        onChange={(e) => setPick(e.target.value)}
                      >
                        <option value="">Who...</option>
                        {people.map((p) => (
                          <option key={p.id as string} value={p.id as string}>
                            {(p.full_name as string) ?? (p.email as string)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={busy === `assign-${role.key}` || !pick}
                        onClick={async () => {
                          const ok = await run(
                            `assign-${role.key}`,
                            () => assignCentreRoleAction({ engagementId, roleKey: role.key, profileId: pick }),
                            "Assigned."
                          );
                          if (ok) setOpenRole(null);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
