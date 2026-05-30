"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Plus, Trash2, Check, Loader2, Pencil } from "lucide-react";
import type { BridgeRow, CompetencyLite, DomainMeta } from "@/lib/competencies/technical-item-bank";
import {
  addBridgeAction,
  setBridgeWeightAction,
  removeBridgeAction,
  updateDomainMetaAction,
} from "../actions";

export function BridgeEditor({
  domainKey,
  domainName,
  meta,
  bridge,
  competencies,
}: {
  domainKey: string;
  domainName: string;
  meta: DomainMeta | null;
  bridge: BridgeRow[];
  competencies: CompetencyLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nameEn, setNameEn] = useState(meta?.nameEn ?? domainName);
  const [nameAr, setNameAr] = useState(meta?.nameAr ?? "");
  const [editMeta, setEditMeta] = useState(false);

  const [addId, setAddId] = useState("");
  const [addWeight, setAddWeight] = useState("3");

  const mappedIds = new Set(bridge.map((b) => b.competencyId));
  const available = competencies.filter((c) => !mappedIds.has(c.id));

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>, okMsg: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(okMsg);
      after?.();
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-indigo-600" />
          Behavioural bridge — {domainName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Which behavioural competencies (of the AC 38) a strong result in this technical domain{" "}
          <strong>enables</strong>. A measured result surfaces as a{" "}
          <span className="rounded border border-indigo-300 bg-indigo-50 px-1 text-[11px] text-indigo-800">
            ↳ {domainName} · 4/5
          </span>{" "}
          chip on each competency below, on the learner&apos;s skills page.
        </p>

        {/* Current mappings */}
        <div className="space-y-2">
          {bridge.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center rounded-md border border-dashed">
              No competencies mapped yet. Add one below.
            </p>
          )}
          {bridge.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-md border p-2.5">
              <span className="flex-1 text-sm font-medium text-[#010131]">{b.competencyName}</span>
              <Select
                value={String(b.weight)}
                onValueChange={(v) => run(() => setBridgeWeightAction({ id: b.id, weight: Number(v) }), "Weight updated")}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 · Primary</SelectItem>
                  <SelectItem value="2">2 · Strong</SelectItem>
                  <SelectItem value="1">1 · Supporting</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                disabled={pending}
                onClick={() => run(() => removeBridgeAction({ id: b.id }), "Mapping removed")}
                aria-label="Remove mapping"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add a mapping */}
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Add behavioural competency</Label>
            <Select value={addId} onValueChange={setAddId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a competency…" />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    All competencies mapped
                  </SelectItem>
                ) : (
                  available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.domain ? ` · ${c.domain}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Weight</Label>
            <Select value={addWeight} onValueChange={setAddWeight}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 · Primary</SelectItem>
                <SelectItem value="2">2 · Strong</SelectItem>
                <SelectItem value="1">1 · Supporting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={pending || !addId}
            onClick={() =>
              run(
                () => addBridgeAction({ domainKey, competencyId: addId, weight: Number(addWeight) }),
                "Competency mapped",
                () => setAddId("")
              )
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {/* Domain display-name editor (the FK key is immutable) */}
        <div className="rounded-md border p-3">
          {!editMeta ? (
            <button
              onClick={() => setEditMeta(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Edit domain display name
              <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {domainKey}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Name (EN)</Label>
                  <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Name (AR)</Label>
                  <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The domain key <span className="font-mono">{domainKey}</span> is immutable (it&apos;s the
                foreign key used everywhere). Only display names change here.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateDomainMetaAction({ domainKey, nameEn, nameAr: nameAr || null }),
                      "Domain name saved",
                      () => setEditMeta(false)
                    )
                  }
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditMeta(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
