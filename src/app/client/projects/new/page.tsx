"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const STEP_KEYS = [
  "clientAnalytics.newProject.stepWorkflow",
  "clientAnalytics.newProject.stepExperience",
  "clientAnalytics.newProject.stepReview",
  "clientAnalytics.newProject.stepPeople",
];

const PROJECT_TYPES = [
  { value: "professional", labelKey: "clientAnalytics.newProject.typeProfessional" },
  { value: "graduate", labelKey: "clientAnalytics.newProject.typeGraduate" },
  { value: "leadership", labelKey: "clientAnalytics.newProject.typeLeadership" },
  { value: "other", labelKey: "clientAnalytics.newProject.typeOther" },
];

// value is a stable identifier persisted in state/review; the visible label is translated at render time
const ASSESSMENT_PRODUCTS = [
  { value: "In-Basket Exercise", labelKey: "clientAnalytics.newProject.productInBasket" },
  { value: "Role Play", labelKey: "clientAnalytics.newProject.productRolePlay" },
  { value: "Group Exercise", labelKey: "clientAnalytics.newProject.productGroupExercise" },
  { value: "Case Study", labelKey: "clientAnalytics.newProject.productCaseStudy" },
  { value: "Oral Presentation", labelKey: "clientAnalytics.newProject.productOralPresentation" },
  { value: "Competency-Based Interview", labelKey: "clientAnalytics.newProject.productCbi" },
];

const NORM_GROUPS = [
  { value: "gcc_banking", labelKey: "clientAnalytics.newProject.normGccBanking" },
  { value: "gcc_government", labelKey: "clientAnalytics.newProject.normGccGovernment" },
  { value: "mena_corporate", labelKey: "clientAnalytics.newProject.normMenaCorporate" },
  { value: "global_corporate", labelKey: "clientAnalytics.newProject.normGlobalCorporate" },
  { value: "graduate_program", labelKey: "clientAnalytics.newProject.normGraduateProgram" },
];

const DEVICES = [
  { value: "desktop", labelKey: "clientAnalytics.newProject.deviceDesktop" },
  { value: "tablet", labelKey: "clientAnalytics.newProject.deviceTablet" },
  { value: "mobile", labelKey: "clientAnalytics.newProject.deviceMobile" },
];

export default function ClientNewProjectPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [normGroup, setNormGroup] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [devices, setDevices] = useState<string[]>(["desktop"]);
  const [proctoring, setProctoring] = useState(false);
  const [cutoffScore, setCutoffScore] = useState("3");
  const [participants, setParticipants] = useState("");

  const toggleProduct = (p: string) => {
    setSelectedProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleDevice = (d: string) => {
    setDevices((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handlePublish = () => {
    toast.success(t("clientAnalytics.newProject.toastCreated"));
  };

  const productLabel = (value: string) =>
    ASSESSMENT_PRODUCTS.find((p) => p.value === value)?.labelKey
      ? t(ASSESSMENT_PRODUCTS.find((p) => p.value === value)!.labelKey)
      : value;

  const deviceLabel = (value: string) =>
    DEVICES.find((d) => d.value === value)?.labelKey
      ? t(DEVICES.find((d) => d.value === value)!.labelKey)
      : value;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("clientAnalytics.newProject.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("clientAnalytics.newProject.subtitle")}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1">
        {STEP_KEYS.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= step && setStep(i)}
            className={`flex-1 text-center py-2 text-xs rounded-lg transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground font-medium"
                : i < step
                  ? "bg-accent/20 text-accent cursor-pointer"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="h-3 w-3 inline me-1" /> : null}
            {t(s)}
          </button>
        ))}
      </div>

      {/* Step 1: Assessment Workflow */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("clientAnalytics.newProject.stepWorkflow")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("clientAnalytics.newProject.labelProjectName")}</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={t("clientAnalytics.newProject.placeholderProjectName")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("clientAnalytics.newProject.labelProjectType")}</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger><SelectValue placeholder={t("clientAnalytics.newProject.selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{t(pt.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("clientAnalytics.newProject.labelNormGroup")}</Label>
                <Select value={normGroup} onValueChange={setNormGroup}>
                  <SelectTrigger><SelectValue placeholder={t("clientAnalytics.newProject.selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {NORM_GROUPS.map((ng) => (
                      <SelectItem key={ng.value} value={ng.value}>{t(ng.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("clientAnalytics.newProject.labelStartDate")}</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("clientAnalytics.newProject.labelEndDate")}</Label>
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t("clientAnalytics.newProject.labelSelectProducts")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {ASSESSMENT_PRODUCTS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 border rounded-lg p-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={selectedProducts.includes(p.value)}
                      onCheckedChange={() => toggleProduct(p.value)}
                    />
                    <span className="text-sm">{t(p.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("clientAnalytics.newProject.labelCutoffScore")}</Label>
              <Input type="number" min={1} max={5} step={0.5} value={cutoffScore} onChange={(e) => setCutoffScore(e.target.value)} className="w-24" />
              <p className="text-xs text-muted-foreground">{t("clientAnalytics.newProject.cutoffHelp")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Participant Experience */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("clientAnalytics.newProject.stepExperience")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("clientAnalytics.newProject.labelAllowedDevices")}</Label>
              <div className="flex gap-3">
                {DEVICES.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={devices.includes(d.value)}
                      onCheckedChange={() => toggleDevice(d.value)}
                    />
                    <span className="text-sm">{t(d.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={proctoring} onCheckedChange={(v) => setProctoring(!!v)} />
                <span className="text-sm font-medium">{t("clientAnalytics.newProject.enableProctoring")}</span>
              </label>
              <p className="text-xs text-muted-foreground ms-6">
                {t("clientAnalytics.newProject.proctoringHelp")}
              </p>
            </div>
            <Separator />
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">{t("clientAnalytics.newProject.completionModeTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("clientAnalytics.newProject.completionModeBody")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Publish */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("clientAnalytics.newProject.stepReview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewProjectName")}</p>
                <p className="font-medium">{projectName || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewProjectType")}</p>
                <p className="font-medium">
                  {projectType
                    ? t(PROJECT_TYPES.find((pt) => pt.value === projectType)?.labelKey ?? "")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewNormGroup")}</p>
                <p className="font-medium">
                  {normGroup
                    ? t(NORM_GROUPS.find((ng) => ng.value === normGroup)?.labelKey ?? "")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewDates")}</p>
                <p className="font-medium">{startDate || "-"} - {endDate || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewCutoffScore")}</p>
                <p className="font-medium">{cutoffScore}/5</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("clientAnalytics.newProject.reviewProctoring")}</p>
                <p className="font-medium">{proctoring ? t("clientAnalytics.newProject.proctoringEnabled") : t("clientAnalytics.newProject.proctoringDisabled")}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("clientAnalytics.newProject.reviewAssessments")}</p>
              <div className="flex flex-wrap gap-1">
                {selectedProducts.length > 0 ? selectedProducts.map((p) => (
                  <Badge key={p} variant="secondary">{productLabel(p)}</Badge>
                )) : <span className="text-xs text-muted-foreground">{t("clientAnalytics.newProject.noneSelected")}</span>}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("clientAnalytics.newProject.reviewDevices")}</p>
              <div className="flex gap-1">
                {devices.map((d) => (
                  <Badge key={d} variant="outline">{deviceLabel(d)}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Add People */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("clientAnalytics.newProject.stepPeople")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("clientAnalytics.newProject.labelParticipantEmails")}</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder={t("clientAnalytics.newProject.placeholderParticipantEmails")}
              />
              <p className="text-xs text-muted-foreground">
                {t("clientAnalytics.newProject.participantsEntered", { n: participants.split("\n").filter((l) => l.trim()).length })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("clientAnalytics.newProject.back")}
        </Button>
        {step < STEP_KEYS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} className="gap-1">
            {t("clientAnalytics.newProject.next")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handlePublish} className="gap-1">
            <Check className="h-4 w-4" />
            {t("clientAnalytics.newProject.publish")}
          </Button>
        )}
      </div>
    </div>
  );
}
