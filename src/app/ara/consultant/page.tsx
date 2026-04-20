import Link from "next/link";
import { ArrowLeft, ClipboardList, Users2, BarChart4 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AraConsultantPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">ARA Consultant Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Create and manage AI Readiness assessments for GCC clients.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="opacity-60">
            <CardHeader>
              <ClipboardList className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Assessments</CardTitle>
              <CardDescription>Create new assessment, track completion, freeze scores.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M2</CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <Users2 className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Respondents</CardTitle>
              <CardDescription>Invite respondents, assign pillars, send reminders.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M2</CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <BarChart4 className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Reports</CardTitle>
              <CardDescription>Generate bilingual reports, download PDF.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M5</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
