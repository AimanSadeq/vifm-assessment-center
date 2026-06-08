export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CourseForm } from "../_components/course-form";
import { CourseTagsPanel } from "../_components/course-tags-panel";
import type { VifmCourse } from "@/types/database";

type Props = { params: { id: string } };

export default async function EditCoursePage({ params }: Props) {
  const sb = await createClient();
  const t = await getServerT();

  const [courseRes, compTagsRes, pillarTagsRes, allCompsRes] = await Promise.all([
    sb.from("vifm_courses").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("vifm_course_competency_tags")
      .select("id, competency_id, relevance_weight, rationale, source")
      .eq("course_id", params.id),
    sb
      .from("vifm_course_pillar_tags")
      .select("id, pillar_id, relevance_weight, rationale, source")
      .eq("course_id", params.id),
    // The full AC competency menu so the panel can offer add-tag pickers.
    // RLS on competencies grants authenticated read; nothing fancy needed.
    sb.from("competencies").select("id, name").order("name"),
  ]);

  if (courseRes.error || !courseRes.data) return notFound();

  const course = courseRes.data as VifmCourse;
  const competencyTags = (compTagsRes.data ?? []) as Array<{
    id: string;
    competency_id: string;
    relevance_weight: 1 | 2 | 3;
    rationale: string | null;
    source: "manual" | "ai_proposed" | "ai_accepted";
  }>;
  const pillarTags = (pillarTagsRes.data ?? []) as Array<{
    id: string;
    pillar_id:
      | "strategy" | "data" | "technology" | "talent" | "culture"
      | "governance" | "operations" | "model_management";
    relevance_weight: 1 | 2 | 3;
    rationale: string | null;
    source: "manual" | "ai_proposed" | "ai_accepted";
  }>;
  const allCompetencies = (allCompsRes.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-4">
      <BackLink href="/admin/courses" label={t("common.back")} history />
      <Card>
        <CardHeader>
          <CardTitle>{course.title_en}</CardTitle>
          <CardDescription>
            {t("adminCourses.edit.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm mode="edit" course={course} />
        </CardContent>
      </Card>

      <CourseTagsPanel
        courseId={course.id}
        initialCompetencyTags={competencyTags}
        initialPillarTags={pillarTags}
        allCompetencies={allCompetencies}
      />
    </div>
  );
}
