"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ticket, Copy, Ban, Target, GraduationCap, Link2, Mail, Send } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  generatePersonaVouchersAction,
  disablePersonaVoucherAction,
  emailVoucherDelegatesAction,
  emailExistingVoucherCodeAction,
} from "../actions";

export type PersonaVoucherRow = {
  id: string;
  code: string;
  label: string | null;
  client_name: string | null;
  default_language: "en" | "ar";
  max_uses: number;
  used_count: number;
  status: "active" | "disabled";
  expires_at: string | null;
  created_at: string;
};

type RoleOption = { id: string; name: string; competencyIds: string[] };
type CompetencyOption = { id: string; name: string; clusterOrder: number; clusterName: string };

export function VouchersClient({
  vouchers,
  clients,
  roleOptions = [],
  personaCompetencies = [],
}: {
  vouchers: PersonaVoucherRow[];
  clients: string[];
  roleOptions?: RoleOption[];
  personaCompetencies?: CompetencyOption[];
}) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  // Email-links-to-delegates panel.
  const [delegates, setDelegates] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [emailResults, setEmailResults] = useState<{ email: string; ok: boolean; error?: string }[]>([]);

  // SD-1 scope: the admin pins purpose + (for hiring) a target role + the
  // competency set the assessment draws from. Default = full profile.
  const allCompIds = useMemo(() => personaCompetencies.map((c) => c.id), [personaCompetencies]);
  const [purpose, setPurpose] = useState<"hiring" | "development">("hiring");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [selectedComps, setSelectedComps] = useState<Set<string>>(() => new Set(allCompIds));

  const compsByCluster = useMemo(() => {
    const m = new Map<number, { name: string; comps: CompetencyOption[] }>();
    for (const c of personaCompetencies) {
      if (!m.has(c.clusterOrder)) m.set(c.clusterOrder, { name: c.clusterName, comps: [] });
      m.get(c.clusterOrder)!.comps.push(c);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [personaCompetencies]);

  const total = allCompIds.length;
  const selectedCount = selectedComps.size;
  const isFull = selectedCount === total;
  const estItems = selectedCount * 4; // ~4 statements per competency

  const onRoleChange = (roleId: string) => {
    setTargetRoleId(roleId);
    const role = roleOptions.find((r) => r.id === roleId);
    if (role) {
      // Pre-fill the scope with the role's competencies (intersected with the
      // Persona bank), the "default from role profile" behaviour.
      const allowed = new Set(allCompIds);
      const pre = role.competencyIds.filter((id) => allowed.has(id));
      setSelectedComps(new Set(pre.length > 0 ? pre : allCompIds));
    }
  };

  const toggleComp = (id: string) =>
    setSelectedComps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async () => {
    if (purpose === "hiring" && !targetRoleId) {
      toast.error("Pick a target role profile for a hiring assessment.");
      return;
    }
    if (selectedCount === 0) {
      toast.error("Select at least one competency, or choose Full profile.");
      return;
    }
    setBusy(true);
    const res = await generatePersonaVouchersAction({
      count,
      label: label || undefined,
      clientName: clientName || undefined,
      projectLabel: projectLabel || undefined,
      maxUses,
      expiresAt: expiresAt || null,
      purpose,
      targetRoleProfileId: purpose === "hiring" ? targetRoleId || null : null,
      // Full selection -> empty (= full bank); a strict subset -> the chosen ids.
      scopedCompetencyIds: isFull ? [] : [...selectedComps],
    });
    setBusy(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setLastCodes(res.codes);
    toast.success(`Generated ${res.codes.length} code${res.codes.length === 1 ? "" : "s"}.`);
    router.refresh();
  };

  const copy = async (text: string) => {
    try {
      await copyToClipboard(text);
      toast.message("Copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const redeemLink = (code: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/ac/persona/redeem?code=${encodeURIComponent(code)}`
      : `/ac/persona/redeem?code=${encodeURIComponent(code)}`;

  const copyLink = async (code: string) => {
    try {
      await copyToClipboard(redeemLink(code));
      toast.message("Redeem link copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  // Parse "email" or "email,name" lines.
  const parseDelegates = (raw: string): { email: string; name?: string }[] =>
    raw
      .split(/\r?\n/)
      .map((line) => {
        const [email, ...rest] = line.split(",");
        return { email: (email ?? "").trim(), name: rest.join(",").trim() || undefined };
      })
      .filter((d) => d.email.length > 0);

  const sendDelegates = async () => {
    if (purpose === "hiring" && !targetRoleId) {
      toast.error("Pick a target role profile for a hiring assessment.");
      return;
    }
    if (selectedCount === 0) {
      toast.error("Select at least one competency, or choose Full profile.");
      return;
    }
    const parsed = parseDelegates(delegates);
    if (parsed.length === 0) {
      toast.error("Add at least one email (one per line, optionally email,name).");
      return;
    }
    setEmailing(true);
    setEmailResults([]);
    const res = await emailVoucherDelegatesAction({
      delegates: parsed,
      label: label || undefined,
      clientName: clientName || undefined,
      projectLabel: projectLabel || undefined,
      language,
      expiresAt: expiresAt || null,
      purpose,
      targetRoleProfileId: purpose === "hiring" ? targetRoleId || null : null,
      scopedCompetencyIds: isFull ? [] : [...selectedComps],
    });
    setEmailing(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setEmailResults(res.results.map((r) => ({ email: r.email, ok: r.ok, error: r.error })));
    const sent = res.results.filter((r) => r.ok).length;
    if (sent === res.results.length) toast.success(`Sent ${sent} link${sent === 1 ? "" : "s"}.`);
    else toast.warning(`Sent ${sent} of ${res.results.length}. See the results below.`);
    router.refresh();
  };

  const emailRow = async (code: string) => {
    const email = window.prompt("Email this code to which address?");
    if (!email) return;
    const res = await emailExistingVoucherCodeAction({ code, email, language });
    if ("error" in res) toast.error(res.error);
    else toast.success(`Sent to ${email.trim()}.`);
  };

  const disable = async (id: string) => {
    if (!confirm("Disable this voucher? Unredeemed seats become unusable.")) return;
    const res = await disablePersonaVoucherAction(id);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Voucher disabled.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24 space-y-1.5">
              <Label className="text-xs">How many</Label>
              <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="w-28 space-y-1.5">
              <Label className="text-xs">Seats / code</Label>
              <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
            </div>
            <div className="flex-1 min-w-[12rem] space-y-1.5">
              <Label className="text-xs">Client (optional)</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} list="persona-client-list" placeholder="Tag to a client org" />
              <datalist id="persona-client-list">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex-1 min-w-[12rem] space-y-1.5">
              <Label className="text-xs">Project / cohort (optional)</Label>
              <Input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} placeholder="Groups with Cognitive for reporting" />
            </div>
            <div className="flex-1 min-w-[10rem] space-y-1.5">
              <Label className="text-xs">Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Q3 intake" />
            </div>
            <div className="w-44 space-y-1.5">
              <Label className="text-xs">Expires (optional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="w-32 space-y-1.5">
              <Label className="text-xs">Language</Label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value === "ar" ? "ar" : "en")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          </div>

          {/* SD-1 scope: the admin pins purpose + role + competency coverage. */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div>
              <Label className="text-xs">Assessment purpose</Label>
              <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setPurpose("hiring")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${purpose === "hiring" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Target className="h-3.5 w-3.5" /> Hiring / selection
                </button>
                <button
                  type="button"
                  onClick={() => setPurpose("development")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${purpose === "development" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <GraduationCap className="h-3.5 w-3.5" /> Development
                </button>
              </div>
            </div>

            {purpose === "hiring" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Target role (required - the fit is computed against it)</Label>
                {roleOptions.length > 0 ? (
                  <select
                    value={targetRoleId}
                    onChange={(e) => onRoleChange(e.target.value)}
                    className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select a role profile…</option>
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600">
                    No role profiles yet. Create one under Admin -&gt; Role Profiles to scope a hiring assessment.
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">
                  Competency coverage
                  {purpose === "hiring" && targetRoleId ? " (defaults to the role's competencies)" : ""}
                </Label>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" className="text-[#5391D5] hover:underline" onClick={() => setSelectedComps(new Set(allCompIds))}>
                    Full profile (all {total})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button type="button" className="text-[#5391D5] hover:underline" onClick={() => setSelectedComps(new Set())}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
                {compsByCluster.map((cl) => (
                  <div key={cl.name}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{cl.name}</p>
                    <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {cl.comps.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedComps.has(c.id)}
                            onChange={() => toggleComp(c.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="text-foreground">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {isFull
                  ? `Full profile - all ${total} competencies (~${estItems} statements).`
                  : `${selectedCount} of ${total} competencies (~${estItems} statements). The candidate answers only these.`}
              </p>
            </div>
          </div>

          <Button onClick={generate} disabled={busy || count < 1} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Email links to delegates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            One delegate per line, as <code className="font-mono">email</code> or{" "}
            <code className="font-mono">email,name</code>. Each gets a fresh single-use code emailed as a
            one-click redeem link. The client, label, language, expiry, purpose, target role, and
            competency coverage above all apply to this batch.
          </p>
          <textarea
            value={delegates}
            onChange={(e) => setDelegates(e.target.value)}
            rows={4}
            placeholder={"sara@example.com\nahmed@example.com, Ahmed Ali"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          <Button onClick={sendDelegates} disabled={emailing || !delegates.trim()} className="gap-1.5">
            {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send links
          </Button>
          {emailResults.length > 0 && (
            <div className="space-y-1 rounded-md border border-slate-200 p-3 text-sm">
              {emailResults.map((r) => (
                <div key={r.email} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{r.email}</span>
                  {r.ok ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                      Sent
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive" title={r.error}>
                      Failed
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lastCodes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Just generated ({lastCodes.length})</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(lastCodes.join("\n"))}>
              <Copy className="h-3.5 w-3.5" /> Copy all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lastCodes.map((c) => (
                <code key={c} className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">{c}</code>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No vouchers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => {
                  const exhausted = v.used_count >= v.max_uses;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.code}</TableCell>
                      <TableCell className="text-sm">{v.client_name ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.label ?? "-"}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {v.used_count}/{v.max_uses}
                      </TableCell>
                      <TableCell>
                        {v.status === "disabled" ? (
                          <Badge variant="secondary">Disabled</Badge>
                        ) : exhausted ? (
                          <Badge variant="outline">Fully used</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(v.expires_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copy code" onClick={() => copy(v.code)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copy redeem link" onClick={() => copyLink(v.code)}>
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          {v.status === "active" && !exhausted && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Email link" onClick={() => emailRow(v.code)}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {v.status === "active" && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Disable" onClick={() => disable(v.id)}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
