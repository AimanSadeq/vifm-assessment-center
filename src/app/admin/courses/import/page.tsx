import { BackLink } from "@/components/shared/back-link";
import { getServerT } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { CoursesImportClient } from "./_components/import-client";

export const dynamic = "force-dynamic";

export default async function ImportCoursesPage() {
  const t = await getServerT();
  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label={t("adminCourses.backToCourses")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            {t("adminCourses.import.title")}
          </CardTitle>
          <CardDescription>
            {t("adminCourses.import.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoursesImportClient />
        </CardContent>
      </Card>
    </div>
  );
}
