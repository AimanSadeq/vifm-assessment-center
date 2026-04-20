import Link from "next/link";
import { ArrowRight, Shield, Users, Link2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VifmLogo } from "@/components/shared/vifm-logo";

export default function AraRootPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <VifmLogo variant="color" size="md" />
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Assessment Center
          </Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-primary mb-2">
            AI Readiness Assessment (ARA)
          </h1>
          <p className="text-muted-foreground">
            Bilingual, GCC-calibrated AI Readiness Assessment platform for UAE and Saudi Arabia clients.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/ara/admin">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <Shield className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-lg">VIFM Admin</CardTitle>
                <CardDescription>
                  Manage question bank, regulatory frameworks, sandbox data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-primary flex items-center gap-1">
                  Open admin console <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/ara/consultant">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <Users className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-lg">VIFM Consultant</CardTitle>
                <CardDescription>
                  Create engagements, manage respondents, generate reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-primary flex items-center gap-1">
                  Open consultant dashboard <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-60">
            <CardHeader>
              <Link2 className="h-6 w-6 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Client Respondent</CardTitle>
              <CardDescription>
                Access via unique personal link sent by email — no account required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Respondents receive a tokenised URL: <code>/ara/respond/[token]</code>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 rounded-lg border bg-muted/30 p-6">
          <h2 className="text-sm font-semibold mb-2">Module status</h2>
          <p className="text-sm text-muted-foreground">
            M1 complete — database schema, <code>consultant</code> role, regulatory frameworks seeded.
            M2 (consultant dashboard + question bank admin) is next.
          </p>
        </div>
      </div>
    </div>
  );
}
