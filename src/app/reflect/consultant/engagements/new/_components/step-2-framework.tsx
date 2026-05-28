"use client";

import { Layers, Sparkles, PencilRuler } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FrameworkKind, WizardState, WizardTemplate } from "./wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  templates: WizardTemplate[];
};

const KINDS: { value: FrameworkKind; icon: typeof Layers; titleKey: string; descriptionKey: string }[] = [
  {
    value: "clone",
    icon: Layers,
    titleKey: "reflectWizard.step2.kinds.cloneTitle",
    descriptionKey: "reflectWizard.step2.kinds.cloneDesc",
  },
  {
    value: "ai",
    icon: Sparkles,
    titleKey: "reflectWizard.step2.kinds.aiTitle",
    descriptionKey: "reflectWizard.step2.kinds.aiDesc",
  },
  {
    value: "manual",
    icon: PencilRuler,
    titleKey: "reflectWizard.step2.kinds.manualTitle",
    descriptionKey: "reflectWizard.step2.kinds.manualDesc",
  },
];

export function StepFramework({ state, update, templates }: Props) {
  const { t: tr } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{tr("reflectWizard.step2.heading")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tr("reflectWizard.step2.intro")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const selected = state.framework_kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => update({ framework_kind: k.value })}
              className={cn(
                "text-start rounded-lg border p-4 transition-all",
                selected
                  ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                  : "border-border bg-card hover:border-accent/40"
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                  selected ? "bg-accent text-white" : "bg-muted text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-primary mb-1">{tr(k.titleKey)}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{tr(k.descriptionKey)}</p>
            </button>
          );
        })}
      </div>

      {/* Branch-specific fields */}
      <div className="rounded-lg border bg-muted/20 p-4">
        {state.framework_kind === "clone" && (
          <div>
            <Label htmlFor="rf-tpl">{tr("reflectWizard.step2.pickTemplateLabel")}</Label>
            <select
              id="rf-tpl"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={state.framework_template_id}
              onChange={(e) => update({ framework_template_id: e.target.value })}
            >
              <option value="">{tr("reflectWizard.step2.chooseTemplate")}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name_en}{t.name_ar ? ` · ${t.name_ar}` : ""}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {tr("reflectWizard.step2.noTemplates")}
              </p>
            )}
            {state.framework_template_id && (() => {
              const t = templates.find((x) => x.id === state.framework_template_id);
              return t?.description_en ? (
                <p className="text-xs text-muted-foreground mt-3 italic">{t.description_en}</p>
              ) : null;
            })()}
          </div>
        )}

        {state.framework_kind === "manual" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="rf-fw-name-en">{tr("reflectWizard.step2.fwNameEnLabel")}</Label>
              <Input
                id="rf-fw-name-en"
                placeholder={tr("reflectWizard.step2.fwNameEnPlaceholder")}
                value={state.framework_name_en}
                onChange={(e) => update({ framework_name_en: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rf-fw-name-ar">{tr("reflectWizard.step2.fwNameArLabel")} <span className="text-muted-foreground">{tr("reflectWizard.step2.optional")}</span></Label>
              <Input
                id="rf-fw-name-ar"
                placeholder="نموذج القيادة"
                dir="rtl"
                value={state.framework_name_ar}
                onChange={(e) => update({ framework_name_ar: e.target.value })}
              />
            </div>
            <p className="md:col-span-2 text-xs text-muted-foreground">
              {tr("reflectWizard.step2.manualNote")}
            </p>
          </div>
        )}

        {state.framework_kind === "ai" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="rf-fw-name-en">{tr("reflectWizard.step2.fwNameEnLabel")}</Label>
                <Input
                  id="rf-fw-name-en"
                  placeholder={tr("reflectWizard.step2.fwNameEnPlaceholder")}
                  value={state.framework_name_en}
                  onChange={(e) => update({ framework_name_en: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rf-fw-name-ar">{tr("reflectWizard.step2.fwNameArLabel")} <span className="text-muted-foreground">{tr("reflectWizard.step2.optional")}</span></Label>
                <Input
                  id="rf-fw-name-ar"
                  placeholder="نموذج القيادة"
                  dir="rtl"
                  value={state.framework_name_ar}
                  onChange={(e) => update({ framework_name_ar: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="rf-src">{tr("reflectWizard.step2.sourceLabel")}</Label>
              <Textarea
                id="rf-src"
                placeholder={tr("reflectWizard.step2.sourcePlaceholder")}
                rows={10}
                value={state.framework_source_text}
                onChange={(e) => update({ framework_source_text: e.target.value })}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {tr("reflectWizard.step2.sourceNotePrefix")} <strong>{tr("reflectWizard.step2.sourceNoteBtn")}</strong>{tr("reflectWizard.step2.sourceNoteSuffix")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
