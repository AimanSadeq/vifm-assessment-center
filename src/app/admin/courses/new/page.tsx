import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CourseForm } from "../_components/course-form";

export const dynamic = "force-dynamic";

export default function NewCoursePage() {
  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label="Back to courses" />
      <Card>
        <CardHeader>
          <CardTitle>New course</CardTitle>
          <CardDescription>
            Add a course manually. To bulk-load 80 PDFs in one shot, use{" "}
            <strong>Import PDFs</strong> on the courses list — that route runs
            AI extraction across the six standard blocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
