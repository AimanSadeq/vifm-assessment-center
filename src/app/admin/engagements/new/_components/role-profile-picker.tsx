"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWizardDispatch } from "./wizard-context";

export type RoleProfileSummary = {
  id: string;
  name_en: string;
  name_ar: string | null;
  target_role: string | null;
  industry: string | null;
  region: string | null;
  role_profile_competencies: {
    competency_id: string;
    weight: number | null;
    priority: "high" | "medium" | "low" | null;
    reasoning: string | null;
  }[];
};

type Props = {
  profiles: RoleProfileSummary[];
};

export function RoleProfilePicker({ profiles }: Props) {
  const dispatch = useWizardDispatch();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const apply = (p: RoleProfileSummary) => {
    const comps = p.role_profile_competencies ?? [];
    if (comps.length === 0) {
      toast.error(t("adminWizard.roleProfile.noCompetenciesToast"));
      return;
    }
    if (comps.length > 15) {
      toast.error(t("adminWizard.roleProfile.tooManyToast", { count: comps.length }));
      return;
    }
    dispatch({
      type: "SET_COMPETENCIES",
      competencies: comps.map((c) => ({
        competencyId: c.competency_id,
        weight: c.weight,
      })),
    });
    toast.success(t("adminWizard.roleProfile.loadedToast", { name: p.name_en, count: comps.length }));
    setOpen(false);
  };

  if (profiles.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          {t("adminWizard.roleProfile.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {t("adminWizard.roleProfile.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("adminWizard.roleProfile.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {profiles.map((p) => {
            const compCount = p.role_profile_competencies?.length ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => apply(p)}
                className="w-full text-left rounded-md border p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name_en}</span>
                      {p.industry && (
                        <Badge variant="outline" className="text-xs">
                          {p.industry}
                        </Badge>
                      )}
                      {p.region && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {p.region}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {t("adminWizard.roleProfile.competenciesCount", { count: compCount })}
                      </Badge>
                    </div>
                    {p.name_ar && (
                      <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                        {p.name_ar}
                      </p>
                    )}
                    {p.target_role && p.target_role !== p.name_en && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("adminWizard.roleProfile.target", { role: p.target_role })}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
