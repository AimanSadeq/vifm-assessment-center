"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createClientAction } from "../actions";

const selectCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [region, setRegion] = useState<"uae" | "saudi">("uae");
  const [sector, setSector] = useState<"government" | "banking" | "general">("general");

  const reset = () => {
    setName(""); setIndustry(""); setCountry(""); setContactName(""); setContactEmail("");
    setRegion("uae"); setSector("general");
  };

  const submit = () =>
    start(async () => {
      const res = await createClientAction({
        name, industry, country, contactName, contactEmail, region, sector,
      });
      if (res.ok) {
        const where = res.createdAc && res.createdAra ? "all services" : res.createdAc ? "the AC store" : res.createdAra ? "AR Compass" : "the registry";
        toast.success(`Client saved to ${where}. It's now selectable in every service.`);
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" /> Create Client</DialogTitle>
          <DialogDescription>
            Saved once and connected across every service — Assessment Center, Pre-Hire, AI Readiness, and Reflect 360.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">Name <span className="text-rose-500">*</span></Label>
            <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gulf Investment Bank" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-industry">Industry</Label>
              <Input id="cl-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Banking" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-country">Country</Label>
              <Input id="cl-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. KSA" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-region">Region <span className="text-slate-400">(AI Readiness / Reflect)</span></Label>
              <select id="cl-region" className={selectCls} value={region} onChange={(e) => setRegion(e.target.value as "uae" | "saudi")}>
                <option value="uae">UAE</option>
                <option value="saudi">Saudi Arabia</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-sector">Sector <span className="text-slate-400">(AI Readiness / Reflect)</span></Label>
              <select id="cl-sector" className={selectCls} value={sector} onChange={(e) => setSector(e.target.value as "government" | "banking" | "general")}>
                <option value="general">General</option>
                <option value="banking">Banking</option>
                <option value="government">Government</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-cname">Contact name</Label>
              <Input id="cl-cname" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-cemail">Contact email</Label>
              <Input id="cl-cemail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Create Client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
