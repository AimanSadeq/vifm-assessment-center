import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VifmLogo } from "@/components/shared/vifm-logo";

// Token-based respondent entry point.
// Access is validated server-side against ara_respondents.access_token
// via service-role API routes — no RLS coupling needed.
// Full implementation lands in M3.

export default function AraRespondPage({ params }: { params: { token: string } }) {
  const tokenPreview = params.token.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8 flex justify-center">
          <VifmLogo variant="color" size="md" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI Readiness Assessment</CardTitle>
            <CardDescription>
              Welcome — your assessment will load here once M3 ships.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Token preview: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tokenPreview}…</code>
            </p>
            <p className="text-xs">
              The bilingual form, auto-save, and supporting materials upload ship in M3.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
