"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Plus, Loader2, X } from "lucide-react";
import { createReadinessProgramAction } from "../actions";

export function StartReadinessProgram({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createReadinessProgramAction({ organizationId: org, name, targetRole: role });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Programme created");
      router.push(`/admin/engagements/${res.id}`);
    });

  if (orgs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-muted-foreground">No client organisations yet - add one before starting a programme.</span>
          <Link href="/admin/clients" className="font-medium text-accent hover:underline">Add a client →</Link>
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-[#010131] hover:bg-[#121140]">
        <Plus className="mr-2 h-4 w-4" /> Start a Succession Readiness programme
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#010131]">New Succession Readiness programme</p>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Creates an engagement already set to <strong>combined</strong> mode. On the next screen you&rsquo;ll add candidates,
          pick the agreed competencies, and link a Reflect 360.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-xs font-medium text-slate-500">Client</span>
            <select value={org} onChange={(e) => setOrg(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select a client…</option>
              {orgs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs font-medium text-slate-500">Programme name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Manager Succession 2026" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="text-xs font-medium text-slate-500">Target role (optional)</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Manager" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={pending || !org || !name.trim()} className="bg-[#010131] hover:bg-[#121140]">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
            Create &amp; open
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
