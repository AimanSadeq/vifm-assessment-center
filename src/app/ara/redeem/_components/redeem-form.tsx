"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemVoucherAction } from "../actions";

export function RedeemForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await redeemVoucherAction(new FormData(e.currentTarget));
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push(res.redirectTo);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Compass className="h-5 w-5 text-[#5391D5]" /> AI Readiness Compass - Practice Access
        </CardTitle>
        <CardDescription>
          Enter your voucher code and details to start your practice assessment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Voucher code</Label>
            <Input id="code" name="code" placeholder="VIFM-ARC-XXXX-XXXX" autoComplete="off" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" placeholder="Your organisation" required />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            {loading ? "Starting…" : "Start practice assessment"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            This is a practice run for development purposes - not an official certified assessment.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
