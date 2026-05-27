import { BackLink } from "@/components/shared/back-link";
import { getServerT } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CourseForm } from "../_components/course-form";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const t = await getServerT();
  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label={t("adminCourses.backToCourses")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("adminCourses.new.title")}</CardTitle>
          <CardDescription>
            {t("adminCourses.new.descPre")}{" "}
            <strong>{t("adminCourses.list.importPdfs")}</strong>{" "}
            {t("adminCourses.new.descPost")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
