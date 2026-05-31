"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          {t("tech.bridge.title", { domain: domainName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tech.bridge.intro")}</p>

        {/* Current mappings */}
        <div className="space-y-2">
          {bridge.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center rounded-md border border-dashed">
              {t("tech.bridge.noneMapped")}
            </p>
          )}
          {bridge.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-md border p-2.5">
              <span className="flex-1 text-sm font-medium text-[#010131]">{b.competencyName}</span>
              <Select
                value={String(b.weight)}
                onValueChange={(v) => run(() => setBridgeWeightAction({ id: b.id, weight: Number(v) }), t("tech.bridge.tWeight"))}
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
                onClick={() => run(() => removeBridgeAction({ id: b.id }), t("tech.bridge.tRemoved"))}
                aria-label={t("tech.bridge.tRemoved")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add a mapping */}
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">{t("tech.bridge.addLabel")}</Label>
            <Select value={addId} onValueChange={setAddId}>
              <SelectTrigger>
                <SelectValue placeholder={t("tech.bridge.pickPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("tech.bridge.allMapped")}
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
            <Label className="text-xs">{t("tech.bridge.weight")}</Label>
            <Select value={addWeight} onValueChange={setAddWeight}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">{t("tech.bridge.wPrimary")}</SelectItem>
                <SelectItem value="2">{t("tech.bridge.wStrong")}</SelectItem>
                <SelectItem value="1">{t("tech.bridge.wSupporting")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={pending || !addId}
            onClick={() =>
              run(
                () => addBridgeAction({ domainKey, competencyId: addId, weight: Number(addWeight) }),
                t("tech.bridge.tMapped"),
                () => setAddId("")
              )
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("tech.bridge.add")}
          </Button>
        </div>

        {/* Domain display-name editor (the FK key is immutable) */}
        <div className="rounded-md border p-3">
          {!editMeta ? (
            <button
              onClick={() => setEditMeta(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> {t("tech.bridge.editName")}
              <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {domainKey}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">{t("tech.bridge.nameEn")}</Label>
                  <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t("tech.bridge.nameAr")}</Label>
                  <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("tech.bridge.keyNote", { key: domainKey })}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateDomainMetaAction({ domainKey, nameEn, nameAr: nameAr || null }),
                      t("tech.bridge.tNameSaved"),
                      () => setEditMeta(false)
                    )
                  }
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("tech.bridge.save")}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditMeta(false)}>
                  {t("tech.bridge.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
