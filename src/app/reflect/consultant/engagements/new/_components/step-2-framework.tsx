"use client";

import { Layers, Sparkles, PencilRuler } from "lucide-react";
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

const KINDS: { value: FrameworkKind; icon: typeof Layers; title: string; description: string }[] = [
  {
    value: "clone",
    icon: Layers,
    title: "Clone a library template",
    description: "Start from a vetted VIFM framework — fastest path when the client has no documented model.",
  },
  {
    value: "ai",
    icon: Sparkles,
    title: "AI-extract from the client's documents",
    description: "Paste the client's Corporate Values and Leadership Competencies. Claude proposes 3–5 observable behaviours per competency in EN + AR. You approve before launch.",
  },
  {
    value: "manual",
    icon: PencilRuler,
    title: "Build manually",
    description: "Create an empty framework and add competencies + behaviours by hand on the engagement detail page.",
  },
];

export function StepFramework({ state, update, templates }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Competency framework</h2>
        <p className="text-sm text-muted-foreground mt-1">
          VIFM Reflect 360 builds every engagement on the client&apos;s own values and competencies. Choose how you&apos;d like to populate this framework.
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
              <h3 className="text-sm font-semibold text-primary mb-1">{k.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{k.description}</p>
            </button>
          );
        })}
      </div>

      {/* Branch-specific fields */}
      <div className="rounded-lg border bg-muted/20 p-4">
        {state.framework_kind === "clone" && (
          <div>
            <Label htmlFor="rf-tpl">Pick a library template</Label>
            <select
              id="rf-tpl"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={state.framework_template_id}
              onChange={(e) => update({ framework_template_id: e.target.value })}
            >
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name_en}{t.name_ar ? ` · ${t.name_ar}` : ""}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No templates seeded yet. Run migration 00033 or pick a different framework path.
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
              <Label htmlFor="rf-fw-name-en">Framework name (English)</Label>
              <Input
                id="rf-fw-name-en"
                placeholder="e.g. Acme Bank Leadership Model"
                value={state.framework_name_en}
                onChange={(e) => update({ framework_name_en: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rf-fw-name-ar">Framework name (Arabic) <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="rf-fw-name-ar"
                placeholder="نموذج القيادة"
                dir="rtl"
                value={state.framework_name_ar}
                onChange={(e) => update({ framework_name_ar: e.target.value })}
              />
            </div>
            <p className="md:col-span-2 text-xs text-muted-foreground">
              You&apos;ll add competencies and behaviours from the engagement detail page after this wizard completes.
            </p>
          </div>
        )}

        {state.framework_kind === "ai" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="rf-fw-name-en">Framework name (English)</Label>
                <Input
                  id="rf-fw-name-en"
                  placeholder="e.g. Acme Bank Leadership Model"
                  value={state.framework_name_en}
                  onChange={(e) => update({ framework_name_en: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rf-fw-name-ar">Framework name (Arabic) <span className="text-muted-foreground">(optional)</span></Label>
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
              <Label htmlFor="rf-src">Paste the client&apos;s values + leadership competencies</Label>
              <Textarea
                id="rf-src"
                placeholder={"Paste the source text here. Can be English, Arabic, or both — Claude reads both.\n\nExample:\nValues: Integrity, Excellence, Collaboration, Innovation.\nLeadership competencies: Strategic vision, Drives execution, Develops people, Communicates with influence."}
                rows={10}
                value={state.framework_source_text}
                onChange={(e) => update({ framework_source_text: e.target.value })}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-2">
                When you click <strong>Create engagement &amp; continue</strong>, Claude will propose 3–5 behaviours per competency in both languages. You&apos;ll be able to edit them on the next step before launching.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
