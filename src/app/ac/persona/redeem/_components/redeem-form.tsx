"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { redeemPersonaVoucherAction } from "../actions";

export function RedeemForm({
  initialCode = "",
  initialEmail = "",
  initialName = "",
  initialCompany = "",
}: {
  initialCode?: string;
  initialEmail?: string;
  initialName?: string;
  initialCompany?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [company, setCompany] = useState(initialCompany);
  const [busy, setBusy] = useState(false);

  const ready = code.trim() && name.trim() && email.trim() && company.trim();

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const res = await redeemPersonaVoucherAction({ code, name, email, company });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    router.push(`/ac/persona/take/${res.redemptionToken}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Voucher code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="VIFM-PER-XXXX-XXXX"
          autoCapitalize="characters"
          className="font-mono tracking-wide"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={busy || !ready} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Start my Persona® assessment
      </Button>
    </div>
  );
}
