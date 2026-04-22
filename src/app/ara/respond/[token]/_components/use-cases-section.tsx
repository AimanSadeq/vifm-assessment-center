"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, AlertCircle, Check, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAraUseCaseAsRespondent, removeAraUseCaseAsRespondent,
} from "@/lib/ara/use-case-actions";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type {
  AraLanguage, AraUseCase, AraUseCaseStage, AraRiskLevel, AraValueLevel,
} from "@/types/ara";

type UseCaseRow = Pick<
  AraUseCase,
  "id" | "name" | "stage" | "pillar_id" | "risk_level" | "value_level" | "business_owner"
>;

const L = {
  en: {
    title: "AI Use Case Portfolio",
    subtitle: "Optional",
    intro: "List the AI initiatives your organization is working on — whether at the ideation stage, running as a pilot, or in production. This inventory helps your consultant assess portfolio diversity and risk exposure.",
    addCta: "+ Add use case",
    name: "Use case name",
    namePlaceholder: "e.g. Customer service chatbot",
    stage: "Stage",
    pillar: "Primary pillar (optional)",
    pillarPrompt: "Not sure…",
    risk: "Risk level",
    value: "Business value",
    owner: "Business owner (optional)",
    addBtn: "Add",
    cancel: "Cancel",
    removeAria: "Remove",
    none: "No AI use cases added yet.",
  },
  ar: {
    title: "محفظة حالات استخدام الذكاء الاصطناعي",
    subtitle: "اختياري",
    intro: "أدرج مبادرات الذكاء الاصطناعي التي تعمل عليها منظمتك — سواء في مرحلة الفكرة أو التجربة أو الإنتاج. يساعد هذا الجرد المستشار على تقييم تنوع المحفظة ومستوى المخاطر.",
    addCta: "+ إضافة حالة استخدام",
    name: "اسم حالة الاستخدام",
    namePlaceholder: "مثال: روبوت محادثة خدمة العملاء",
    stage: "المرحلة",
    pillar: "الركيزة الرئيسية (اختياري)",
    pillarPrompt: "غير متأكد…",
    risk: "مستوى المخاطر",
    value: "القيمة التجارية",
    owner: "المالك التجاري (اختياري)",
    addBtn: "إضافة",
    cancel: "إلغاء",
    removeAria: "إزالة",
    none: "لم تُضف حالات استخدام بعد.",
  },
} as const;

const STAGE_LABEL: Record<AraUseCaseStage, { en: string; ar: string; color: string }> = {
  ideation: { en: "Ideation", ar: "فكرة", color: "#9ca3af" },
  piloting: { en: "Piloting", ar: "تجربة", color: "#FD7E14" },
  production: { en: "Production", ar: "إنتاج", color: "#28A745" },
  retired: { en: "Retired", ar: "متقاعد", color: "#6b7280" },
};

const RISK_LABEL: Record<AraRiskLevel, { en: string; ar: string; color: string }> = {
  low: { en: "Low", ar: "منخفض", color: "#28A745" },
  medium: { en: "Medium", ar: "متوسط", color: "#FFC107" },
  high: { en: "High", ar: "مرتفع", color: "#FD7E14" },
  critical: { en: "Critical", ar: "حرج", color: "#DC3545" },
};

const VALUE_LABEL: Record<AraValueLevel, { en: string; ar: string }> = {
  low: { en: "Low", ar: "منخفضة" },
  medium: { en: "Medium", ar: "متوسطة" },
  high: { en: "High", ar: "عالية" },
};

export function UseCasesSection({
  token,
  useCases,
  language,
}: {
  token: string;
  useCases: UseCaseRow[];
  language: AraLanguage;
}) {
  const rtl = language === "ar";
  const t = L[language];
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    setError(null);
    start(async () => {
      const res = await removeAraUseCaseAsRespondent(id, token);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            {t.title}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{t.subtitle}</span>
        </CardTitle>
        <CardDescription>{t.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {useCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.none}</p>
        ) : (
          <ul className="space-y-2">
            {useCases.map((u) => (
              <li key={u.id} className="rounded-lg border p-3 bg-card text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-medium"
                        style={{ background: STAGE_LABEL[u.stage].color, color: "white" }}
                      >
                        {STAGE_LABEL[u.stage][language]}
                      </span>
                      <span className="text-muted-foreground">
                        {rtl ? "المخاطر" : "Risk"}:{" "}
                        <span style={{ color: RISK_LABEL[u.risk_level].color, fontWeight: 500 }}>
                          {RISK_LABEL[u.risk_level][language]}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {rtl ? "القيمة" : "Value"}:{" "}
                        <span className="font-medium">{VALUE_LABEL[u.value_level][language]}</span>
                      </span>
                      {u.pillar_id && (
                        <span className="text-muted-foreground">
                          {ARA_PILLARS.find((p) => p.id === u.pillar_id)?.[rtl ? "name_ar" : "name_en"] ?? u.pillar_id}
                        </span>
                      )}
                      {u.business_owner && (
                        <span className="text-muted-foreground">· {u.business_owner}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(u.id)}
                    disabled={pending}
                    className="h-7 w-7 p-0"
                    aria-label={t.removeAria}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!adding ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => { setError(null); setAdding(true); }}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> {t.addCta}
          </Button>
        ) : (
          <AddUseCaseForm
            token={token}
            language={language}
            onSaved={() => { setAdding(false); setError(null); }}
            onError={(e) => setError(e)}
            onCancel={() => { setAdding(false); setError(null); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AddUseCaseForm({
  token,
  language,
  onSaved,
  onError,
  onCancel,
}: {
  token: string;
  language: AraLanguage;
  onSaved: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const rtl = language === "ar";
  const t = L[language];
  const [name, setName] = useState("");
  const [stage, setStage] = useState<AraUseCaseStage>("piloting");
  const [pillarId, setPillarId] = useState<string>("");
  const [risk, setRisk] = useState<AraRiskLevel>("medium");
  const [valueL, setValueL] = useState<AraValueLevel>("medium");
  const [owner, setOwner] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    start(async () => {
      const res = await addAraUseCaseAsRespondent({
        token,
        name: name.trim(),
        stage,
        pillar_id: pillarId || null,
        risk_level: risk,
        value_level: valueL,
        business_owner: owner.trim() || undefined,
      });
      if (res.ok) onSaved();
      else onError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="rounded-lg border p-4 bg-muted/30 space-y-3">
      <div className="space-y-1">
        <Label htmlFor="uc_name" className="text-xs">{t.name} *</Label>
        <Input
          id="uc_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          required
          minLength={2}
          maxLength={200}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="uc_stage" className="text-xs">{t.stage} *</Label>
          <select
            id="uc_stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as AraUseCaseStage)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ideation">{STAGE_LABEL.ideation[language]}</option>
            <option value="piloting">{STAGE_LABEL.piloting[language]}</option>
            <option value="production">{STAGE_LABEL.production[language]}</option>
            <option value="retired">{STAGE_LABEL.retired[language]}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="uc_pillar" className="text-xs">{t.pillar}</Label>
          <select
            id="uc_pillar"
            value={pillarId}
            onChange={(e) => setPillarId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t.pillarPrompt}</option>
            {ARA_PILLARS.map((p) => (
              <option key={p.id} value={p.id}>{rtl ? p.name_ar : p.name_en}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="uc_risk" className="text-xs">{t.risk} *</Label>
          <select
            id="uc_risk"
            value={risk}
            onChange={(e) => setRisk(e.target.value as AraRiskLevel)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="low">{RISK_LABEL.low[language]}</option>
            <option value="medium">{RISK_LABEL.medium[language]}</option>
            <option value="high">{RISK_LABEL.high[language]}</option>
            <option value="critical">{RISK_LABEL.critical[language]}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="uc_value" className="text-xs">{t.value} *</Label>
          <select
            id="uc_value"
            value={valueL}
            onChange={(e) => setValueL(e.target.value as AraValueLevel)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="low">{VALUE_LABEL.low[language]}</option>
            <option value="medium">{VALUE_LABEL.medium[language]}</option>
            <option value="high">{VALUE_LABEL.high[language]}</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="uc_owner" className="text-xs">{t.owner}</Label>
        <Input
          id="uc_owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={pending} className="gap-1">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {t.addBtn}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
