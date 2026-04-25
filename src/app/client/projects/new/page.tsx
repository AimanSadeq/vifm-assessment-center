"use client";

import { useState } from "react";
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

const STEPS = [
  "Assessment Workflow",
  "Participant Experience",
  "Review & Publish",
  "Add People",
];

const PROJECT_TYPES = [
  { value: "professional", label: "Professional" },
  { value: "graduate", label: "Graduate" },
  { value: "leadership", label: "Leadership" },
  { value: "other", label: "Other Solution" },
];

const ASSESSMENT_PRODUCTS = [
  "In-Basket Exercise",
  "Role Play",
  "Group Exercise",
  "Case Study",
  "Oral Presentation",
  "Competency-Based Interview",
];

const NORM_GROUPS = [
  { value: "gcc_banking", label: "GCC Banking" },
  { value: "gcc_government", label: "GCC Government" },
  { value: "mena_corporate", label: "MENA Corporate" },
  { value: "global_corporate", label: "Global Corporate" },
  { value: "graduate_program", label: "Graduate Program" },
];

const DEVICES = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

export default function ClientNewProjectPage() {
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
    toast.success("Project created successfully! Redirecting to project management.");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your assessment project in 4 steps.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
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
            {i < step ? <Check className="h-3 w-3 inline mr-1" /> : null}
            {s}
          </button>
        ))}
      </div>

      {/* Step 1: Assessment Workflow */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Q2 Leadership Assessment" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Type *</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Norm Group</Label>
                <Select value={normGroup} onValueChange={setNormGroup}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {NORM_GROUPS.map((ng) => (
                      <SelectItem key={ng.value} value={ng.value}>{ng.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Select Assessments / Products</Label>
              <div className="grid grid-cols-2 gap-2">
                {ASSESSMENT_PRODUCTS.map((p) => (
                  <label key={p} className="flex items-center gap-2 border rounded-lg p-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={selectedProducts.includes(p)}
                      onCheckedChange={() => toggleProduct(p)}
                    />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cutoff Score (1-5)</Label>
              <Input type="number" min={1} max={5} step={0.5} value={cutoffScore} onChange={(e) => setCutoffScore(e.target.value)} className="w-24" />
              <p className="text-xs text-muted-foreground">Minimum passing score for each assessment</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Participant Experience */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Participant Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Allowed Devices</Label>
              <div className="flex gap-3">
                {DEVICES.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={devices.includes(d.value)}
                      onCheckedChange={() => toggleDevice(d.value)}
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={proctoring} onCheckedChange={(v) => setProctoring(!!v)} />
                <span className="text-sm font-medium">Enable Proctoring</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">
                Enables live or AI-based monitoring during assessments for security.
              </p>
            </div>
            <Separator />
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Assessment Completion Mode</p>
              <p className="text-xs text-muted-foreground">
                Assessments will be completed sequentially. Candidates must finish one assessment before the next unlocks.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Publish */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Project Name</p>
                <p className="font-medium">{projectName || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Project Type</p>
                <p className="font-medium capitalize">{projectType || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Norm Group</p>
                <p className="font-medium">{normGroup ? normGroup.replace(/_/g, " ") : "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dates</p>
                <p className="font-medium">{startDate || "-"} - {endDate || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cutoff Score</p>
                <p className="font-medium">{cutoffScore}/5</p>
              </div>
              <div>
                <p className="text-muted-foreground">Proctoring</p>
                <p className="font-medium">{proctoring ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">Assessments</p>
              <div className="flex flex-wrap gap-1">
                {selectedProducts.length > 0 ? selectedProducts.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                )) : <span className="text-xs text-muted-foreground">None selected</span>}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Devices</p>
              <div className="flex gap-1">
                {devices.map((d) => (
                  <Badge key={d} variant="outline" className="capitalize">{d}</Badge>
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
            <CardTitle>Add People</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Participant Emails</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Enter email addresses, one per line"
              />
              <p className="text-xs text-muted-foreground">
                {participants.split("\n").filter((l) => l.trim()).length} participant(s) entered
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
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} className="gap-1">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handlePublish} className="gap-1">
            <Check className="h-4 w-4" />
            Publish Project
          </Button>
        )}
      </div>
    </div>
  );
}
