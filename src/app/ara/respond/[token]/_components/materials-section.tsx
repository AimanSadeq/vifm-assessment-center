"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  Link2, FileText, File, Presentation, Plus, Trash2, Loader2, AlertCircle, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAraMaterialUrl, addAraMaterialFile, removeAraMaterial,
} from "@/lib/ara/materials-actions";
import type { AraLanguage, AraMaterialType } from "@/types/ara";

type MaterialRow = {
  id: string;
  material_type: AraMaterialType;
  material_name: string;
  file_name: string | null;
  link_url: string | null;
};

const TYPE_ICONS = {
  url: Link2,
  word: FileText,
  pdf: File,
  powerpoint: Presentation,
} as const;

const L = {
  en: {
    title: "Supporting Materials",
    subtitle: "Optional",
    intro: "Share any existing documents, policies, or links relevant to this assessment. This helps us give you a more accurate and evidence-based report.",
    addCta: "+ Add supporting material",
    type: "Material type",
    typePrompt: "Select a type…",
    name: "Material name",
    namePlaceholder: "e.g. AI Acceptable Use Policy 2025",
    url: "URL",
    urlPlaceholder: "https://…",
    file: "File",
    addBtn: "Add material",
    cancel: "Cancel",
    removeAria: "Remove",
    typeUrl: "Web URL or Link",
    typeWord: "Word Document",
    typePdf: "PDF",
    typePpt: "PowerPoint",
    none: "No materials added yet.",
  },
  ar: {
    title: "المواد الداعمة",
    subtitle: "اختياري",
    intro: "شارك أي مستندات أو سياسات أو روابط ذات صلة بهذا التقييم. يساعدنا ذلك في تقديم تقرير أكثر دقة.",
    addCta: "+ إضافة مادة داعمة",
    type: "نوع المادة",
    typePrompt: "اختر نوعاً…",
    name: "اسم المادة",
    namePlaceholder: "مثال: سياسة الاستخدام المقبول للذكاء الاصطناعي",
    url: "الرابط",
    urlPlaceholder: "https://…",
    file: "الملف",
    addBtn: "إضافة المادة",
    cancel: "إلغاء",
    removeAria: "إزالة",
    typeUrl: "رابط إلكتروني",
    typeWord: "مستند Word",
    typePdf: "PDF",
    typePpt: "عرض PowerPoint",
    none: "لم تُضف مواد بعد.",
  },
} as const;

export function MaterialsSection({
  token,
  materials,
  language,
}: {
  token: string;
  materials: MaterialRow[];
  language: AraLanguage;
}) {
  const rtl = language === "ar";
  const t = L[language];
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const removeMaterial = (id: string) => {
    setError(null);
    start(async () => {
      const res = await removeAraMaterial(id, token);
      if (res.ok) {
        toast.success(rtl ? "تم حذف المادة" : "Material removed");
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{t.title}</span>
          <span className="text-xs font-normal text-muted-foreground">{t.subtitle}</span>
        </CardTitle>
        <CardDescription>{t.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing materials list */}
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.none}</p>
        ) : (
          <ul className="space-y-2">
            {materials.map((m) => {
              const Icon = TYPE_ICONS[m.material_type];
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border p-3 bg-card text-sm"
                >
                  <Icon className="h-4 w-4 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.material_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.material_type === "url" ? m.link_url : m.file_name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMaterial(m.id)}
                    disabled={pending}
                    className="h-7 w-7 p-0"
                    aria-label={t.removeAria}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
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
          <AddMaterialForm
            token={token}
            language={language}
            rtl={rtl}
            onSaved={() => { setAdding(false); setError(null); }}
            onError={(e) => setError(e)}
            onCancel={() => { setAdding(false); setError(null); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AddMaterialForm({
  token,
  language,
  rtl,
  onSaved,
  onError,
  onCancel,
}: {
  token: string;
  language: AraLanguage;
  rtl: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const t = L[language];
  const [type, setType] = useState<AraMaterialType | "">("");
  const [name, setName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptMap: Record<Exclude<AraMaterialType, "url">, string> = {
    word: ".doc,.docx",
    pdf: ".pdf",
    powerpoint: ".ppt,.pptx",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    if (name.trim().length < 2) return;

    start(async () => {
      const okMsg = language === "ar" ? "تمت إضافة المادة" : "Material added";
      if (type === "url") {
        const res = await addAraMaterialUrl({
          token,
          material_name: name.trim(),
          link_url: urlValue.trim(),
        });
        if (res.ok) {
          toast.success(okMsg);
          onSaved();
        } else {
          toast.error(res.error);
          onError(res.error);
        }
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          onError(language === "ar" ? "يرجى اختيار ملف" : "Please choose a file");
          return;
        }
        const fd = new FormData();
        fd.set("token", token);
        fd.set("material_name", name.trim());
        fd.set("material_type", type);
        fd.set("file", file);
        const res = await addAraMaterialFile(fd);
        if (res.ok) {
          toast.success(okMsg);
          onSaved();
        } else {
          toast.error(res.error);
          onError(res.error);
        }
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-4 bg-muted/30 space-y-3"
    >
      <div className="space-y-1">
        <Label htmlFor="mat_type" className="text-xs">{t.type}</Label>
        <select
          id="mat_type"
          value={type}
          onChange={(e) => setType(e.target.value as AraMaterialType)}
          required
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>{t.typePrompt}</option>
          <option value="url">{t.typeUrl}</option>
          <option value="word">{t.typeWord}</option>
          <option value="pdf">{t.typePdf}</option>
          <option value="powerpoint">{t.typePpt}</option>
        </select>
      </div>

      {type && (
        <div className="space-y-1">
          <Label htmlFor="mat_name" className="text-xs">{t.name} *</Label>
          <Input
            id="mat_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            required
            maxLength={200}
            minLength={2}
          />
        </div>
      )}

      {type === "url" && (
        <div className="space-y-1">
          <Label htmlFor="mat_url" className="text-xs">{t.url} *</Label>
          <Input
            id="mat_url"
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder={t.urlPlaceholder}
            required
            dir="ltr"
          />
        </div>
      )}

      {type && type !== "url" && (
        <div className="space-y-1">
          <Label htmlFor="mat_file" className="text-xs">{t.file} *</Label>
          <input
            id="mat_file"
            ref={fileRef}
            type="file"
            accept={acceptMap[type]}
            required
            className="w-full text-xs file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs"
          />
        </div>
      )}

      {type && (
        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={pending} className="gap-1">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {t.addBtn}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            {t.cancel}
          </Button>
        </div>
      )}
    </form>
  );
}
