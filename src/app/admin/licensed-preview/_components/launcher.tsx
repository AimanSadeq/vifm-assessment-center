"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Sparkles, ArrowRight } from "lucide-react";
import type { Sector, Region } from "@/lib/licensed-preview/sample-data";

const ACCENTS = ["#5391D5", "#010131", "#16a34a", "#7c3aed", "#ca8a04", "#0d9488", "#e11d48"];

const PRESETS: { org: string; sector: Sector; region: Region; accent: string }[] = [
  { org: "SDAIA", sector: "government", region: "saudi", accent: "#16a34a" },
  { org: "Emirates NBD", sector: "banking", region: "uae", accent: "#5391D5" },
  { org: "Saudi Aramco", sector: "general", region: "saudi", accent: "#0d9488" },
];

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PreviewLauncher() {
  const router = useRouter();
  const [org, setOrg] = useState("");
  const [sector, setSector] = useState<Sector>("government");
  const [region, setRegion] = useState<Region>("saudi");
  const [accent, setAccent] = useState(ACCENTS[0]);

  const launch = (o = org, s = sector, r = region, a = accent) => {
    const name = o.trim();
    if (!name) return;
    const qs = new URLSearchParams({ org: name, sector: s, region: r, accent: a });
    router.push(`/licensed-preview?${qs.toString()}`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[#5391D5]" /> Brand the preview to your prospect
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the prospect&apos;s details. The preview opens as their own branded Caliber tenant - a full,
            navigable workforce-intelligence portal populated with representative sample data. Nothing is saved and no
            live records are shown.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Organisation name</Label>
            <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Ministry of Finance" onKeyDown={(e) => e.key === "Enter" && launch()} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Sector</Label>
              <select className={selectClass} value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
                <option value="government">Government</option>
                <option value="banking">Banking &amp; Finance</option>
                <option value="general">Enterprise</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Region</Label>
              <select className={selectClass} value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                <option value="saudi">Saudi Arabia</option>
                <option value="uae">United Arab Emirates</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Accent colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  aria-label={`Accent ${c}`}
                  className={`h-7 w-7 rounded-full ring-offset-2 transition ${accent === c ? "ring-2 ring-slate-400" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="pt-1">
            <Button onClick={() => launch()} disabled={!org.trim()} className="gap-1.5">
              <Eye className="h-4 w-4" /> Launch preview <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick-launch a sample</CardTitle>
          <p className="text-sm text-muted-foreground">Pre-filled prospects to demo instantly.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.org}
              onClick={() => launch(p.org, p.sector, p.region, p.accent)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 shrink-0 rounded-md" style={{ background: p.accent }} />
                <div>
                  <div className="text-sm font-medium text-foreground">{p.org}</div>
                  <div className="text-xs capitalize text-muted-foreground">{p.sector} · {p.region === "uae" ? "UAE" : "Saudi"}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
