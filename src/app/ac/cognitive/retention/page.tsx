import { notFound } from "next/navigation";
import { FileClock, AlertTriangle } from "lucide-react";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countExpiredCognitiveResults, purgeCognitiveResults } from "./actions";
import { RETENTION_MONTHS, PURGE_CONFIRMATION } from "./constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logical® retention · VIFM" };

export default async function CognitiveRetentionPage() {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const { total, expired } = await countExpiredCognitiveResults();

  const purgeAction = async (fd: FormData) => {
    "use server";
    await purgeCognitiveResults(fd);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <BackLink href="/ac/cognitive" label="Logical®" />
      <div className="mt-4 mb-2 flex items-center gap-2">
        <FileClock className="h-5 w-5 text-[#5391D5]" />
        <h1 className="text-2xl font-semibold text-[#010131]">Logical® retention</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Candidate data is retained for a maximum of {RETENTION_MONTHS / 12} years. Purge Logical
        results past that window to stay compliant. This is irreversible.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total results stored</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#010131] tabular-nums">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Past the {RETENTION_MONTHS / 12}-year window</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold tabular-nums ${expired > 0 ? "text-destructive" : "text-emerald-700"}`}>{expired}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Purge expired results
          </CardTitle>
          <CardDescription>
            Permanently deletes the {expired} result{expired === 1 ? "" : "s"} older than {RETENTION_MONTHS / 12} years
            (and their per-item response rows). Voucher redemption records are kept (their result link is cleared).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={purgeAction} className="flex items-end gap-3">
            <div className="space-y-1 flex-1 max-w-md">
              <Label htmlFor="confirmation" className="text-xs">
                Type <code>{PURGE_CONFIRMATION}</code> to confirm
              </Label>
              <Input id="confirmation" name="confirmation" required placeholder={PURGE_CONFIRMATION} autoComplete="off" />
            </div>
            <Button type="submit" variant="destructive" disabled={expired === 0}>
              Purge {expired} result{expired === 1 ? "" : "s"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
