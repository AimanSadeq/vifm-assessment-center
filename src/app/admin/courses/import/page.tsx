import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { CoursesImportClient } from "./_components/import-client";

export const dynamic = "force-dynamic";

export default function ImportCoursesPage() {
  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label="Back to courses" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Import course PDFs
          </CardTitle>
          <CardDescription>
            Drop one or many course outline PDFs (English or Arabic, 6-block
            format). Claude reads the six blocks, populates the structured
            catalogue fields, and proposes AC competency + ARA pillar tags
            with a 1-sentence rationale per tag. You review per-row and
            accept / skip before any catalogue rows are written.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoursesImportClient />
        </CardContent>
      </Card>
    </div>
  );
}
