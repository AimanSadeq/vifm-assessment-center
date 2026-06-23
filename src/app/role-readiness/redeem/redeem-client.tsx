"use client";

import { useState, useTransition } from "react";
import { Boxes, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemVoucherAction } from "./actions";

export function RedeemClient({ code, emailPrefill, namePrefill = "" }: { code: string; emailPrefill: string; namePrefill?: string }) {
  const [name, setName] = useState(namePrefill);
  const [email, setEmail] = useState(emailPrefill);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const redeem = () =>
    start(async () => {
      setError(null);
      const res = await redeemVoucherAction({ code, fullName: name, email });
      if ("error" in res) { setError(res.error); return; }
      window.location.href = `/role-readiness/apply/${res.token}`;
    });

  return (
    <div className="min-h-screen bg-[#FEFFF9]">
      <header className="border-b bg-[#010131] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Boxes className="h-5 w-5 text-[#5391D5]" />
          <span className="text-sm font-semibold">Role Readiness Assessment</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 py-10">
        {!code ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold text-[#010131]">Missing voucher code</h1>
            <p className="mt-1 text-sm text-muted-foreground">Open the link your organisation sent you - it includes the code.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6">
            <h1 className="text-xl font-semibold text-[#010131]">Start your assessment</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your details to begin. Voucher: <span className="font-mono text-foreground">{code}</span></p>
            {error && <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Full name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@org.com" className="mt-1" />
              </div>
              <Button onClick={redeem} disabled={pending || name.trim().length < 2 || !email.trim()} className="gap-2">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Start assessment
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
