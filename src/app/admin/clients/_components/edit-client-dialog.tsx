"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { updateClientAction } from "../actions";

export function EditClientDialog({
  acId,
  araId,
  name,
  industry,
  country,
}: {
  acId: string | null;
  araId: string | null;
  name: string;
  industry: string | null;
  country: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState(name);
  const [newIndustry, setNewIndustry] = useState(industry ?? "");
  const [newCountry, setNewCountry] = useState(country ?? "");

  const reset = () => {
    setNewName(name);
    setNewIndustry(industry ?? "");
    setNewCountry(country ?? "");
  };

  const submit = () =>
    start(async () => {
      const res = await updateClientAction({
        acId,
        araId,
        name: newName,
        industry: newIndustry,
        country: newCountry,
      });
      if (res.ok) {
        toast.success("Client updated across every connected service.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" title="Edit client">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" /> Edit Client</DialogTitle>
          <DialogDescription>
            Changes apply across every connected service - existing engagements, results, and vouchers stay linked; only the display details change. PDFs already downloaded keep the old name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ecl-name">Name <span className="text-rose-500">*</span></Label>
            <Input id="ecl-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ecl-industry">Industry</Label>
              <Input
                id="ecl-industry"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                disabled={!acId}
                placeholder={acId ? "e.g. Banking" : "Not linked to the AC store"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ecl-country">Country</Label>
              <Input
                id="ecl-country"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                disabled={!acId}
                placeholder={acId ? "e.g. KSA" : "Not linked to the AC store"}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !newName.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
