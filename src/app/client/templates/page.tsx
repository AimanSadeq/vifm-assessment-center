"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Star, Trash2, Copy } from "lucide-react";

type Template = {
  id: string;
  name: string;
  assessmentType: string;
  normGroup: string;
  createdAt: string;
};

export default function ClientTemplatesPage() {
  const { t: tr } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("vifm_project_templates") ?? "[]");
    } catch {
      return [];
    }
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [normGroup, setNormGroup] = useState("");

  const saveTemplates = (updated: Template[]) => {
    setTemplates(updated);
    localStorage.setItem("vifm_project_templates", JSON.stringify(updated));
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const template: Template = {
      id: crypto.randomUUID(),
      name: name.trim(),
      assessmentType,
      normGroup,
      createdAt: new Date().toISOString(),
    };
    saveTemplates([...templates, template]);
    setDialogOpen(false);
    setName("");
    setAssessmentType("");
    setNormGroup("");
    toast.success(tr("clientAnalytics.templates.toastSaved"));
  };

  const handleDelete = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
    toast.success(tr("clientAnalytics.templates.toastRemoved"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tr("clientAnalytics.templates.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {tr("clientAnalytics.templates.subtitle")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Star className="h-4 w-4" />
              {tr("clientAnalytics.templates.newTemplate")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr("clientAnalytics.templates.saveDialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{tr("clientAnalytics.templates.labelTemplateName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("clientAnalytics.templates.placeholderTemplateName")} />
              </div>
              <div className="space-y-1">
                <Label>{tr("clientAnalytics.templates.labelAssessmentType")}</Label>
                <Select value={assessmentType} onValueChange={setAssessmentType}>
                  <SelectTrigger><SelectValue placeholder={tr("clientAnalytics.templates.selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">{tr("clientAnalytics.templates.typeProfessional")}</SelectItem>
                    <SelectItem value="graduate">{tr("clientAnalytics.templates.typeGraduate")}</SelectItem>
                    <SelectItem value="leadership">{tr("clientAnalytics.templates.typeLeadership")}</SelectItem>
                    <SelectItem value="other">{tr("clientAnalytics.templates.typeOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tr("clientAnalytics.templates.labelNormGroup")}</Label>
                <Select value={normGroup} onValueChange={setNormGroup}>
                  <SelectTrigger><SelectValue placeholder={tr("clientAnalytics.templates.selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcc_banking">{tr("clientAnalytics.templates.normGccBanking")}</SelectItem>
                    <SelectItem value="gcc_government">{tr("clientAnalytics.templates.normGccGovernment")}</SelectItem>
                    <SelectItem value="mena_corporate">{tr("clientAnalytics.templates.normMenaCorporate")}</SelectItem>
                    <SelectItem value="global_corporate">{tr("clientAnalytics.templates.normGlobalCorporate")}</SelectItem>
                    <SelectItem value="graduate_program">{tr("clientAnalytics.templates.normGraduateProgram")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">
                {tr("clientAnalytics.templates.saveTemplate")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{tr("clientAnalytics.templates.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {tr("clientAnalytics.templates.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.assessmentType && (
                    <Badge variant="outline" className="capitalize text-xs">{t.assessmentType}</Badge>
                  )}
                  {t.normGroup && (
                    <Badge variant="secondary" className="text-xs">{t.normGroup.replace(/_/g, " ")}</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <Copy className="h-3 w-3" />
                  {tr("clientAnalytics.templates.useTemplate")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
