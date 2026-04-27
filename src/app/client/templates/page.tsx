"use client";

import { useState } from "react";
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
    toast.success("Template saved");
  };

  const handleDelete = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
    toast.success("Template removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Favorite Project Templates</h1>
          <p className="mt-1 text-muted-foreground">
            Save project configurations as templates for quick reuse.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Star className="h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Project Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Template Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Graduate Assessment - Banking" />
              </div>
              <div className="space-y-1">
                <Label>Assessment Type</Label>
                <Select value={assessmentType} onValueChange={setAssessmentType}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="graduate">Graduate</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Norm Group</Label>
                <Select value={normGroup} onValueChange={setNormGroup}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcc_banking">GCC Banking</SelectItem>
                    <SelectItem value="gcc_government">GCC Government</SelectItem>
                    <SelectItem value="mena_corporate">MENA Corporate</SelectItem>
                    <SelectItem value="global_corporate">Global Corporate</SelectItem>
                    <SelectItem value="graduate_program">Graduate Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">
                Save Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No templates saved yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a template to save your favorite project configurations for reuse.
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
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
