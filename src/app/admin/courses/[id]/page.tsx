export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CourseForm } from "../_components/course-form";
import type { VifmCourse } from "@/types/database";

type Props = { params: { id: string } };

export default async function EditCoursePage({ params }: Props) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("vifm_courses")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data) return notFound();

  const course = data as VifmCourse;

  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label="Back to courses" />
      <Card>
        <CardHeader>
          <CardTitle>{course.title_en}</CardTitle>
          <CardDescription>
            Edit the catalogue entry. The mapping panel (AC competencies +
            ARA pillars) ships in Day 3 of this workstream.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm mode="edit" course={course} />
        </CardContent>
      </Card>
    </div>
  );
}
