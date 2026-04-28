import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ImportCoursesPage() {
  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label="Back to courses" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Import course PDFs (coming Day 2)
          </CardTitle>
          <CardDescription>
            Drop one or many course outline PDFs (English or Arabic, 6-block
            format). Claude reads the six blocks, populates the structured
            catalogue fields, and proposes AC competency + ARA pillar tags
            with rationale text. You review per-row and accept / edit before
            anything writes to the catalogue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Day 1 ships the schema + manual editor. Day 2 wires the AI
            extraction here. For 80 courses the AI path will save you weeks
            of manual entry — see <strong>scripts/seed-production-bank.ts</strong>{" "}
            and <strong>src/lib/ai/jd-competency-extractor.ts</strong> for the
            patterns this will reuse.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
