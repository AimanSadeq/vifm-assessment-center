import Link from "next/link";
import { ArrowLeft, Database, FileText, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AraAdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">ARA Admin Console</h1>
        <p className="text-muted-foreground mb-8">
          VIFM staff — manage question bank, regulatory content, and sandbox data.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="opacity-60">
            <CardHeader>
              <Database className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Question Bank</CardTitle>
              <CardDescription>Author, version, publish Layer 1 + Layer 2 questions.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M2</CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <FileText className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Regulatory Docs</CardTitle>
              <CardDescription>Upload regulatory documents; AI-extract requirements.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M4</CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <FlaskConical className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">Sandbox Data</CardTitle>
              <CardDescription>Clear all sandbox assessments with confirmation.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming in M6</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
