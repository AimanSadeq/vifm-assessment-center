"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Props = {
  candidateId: string;
  courseId: string;
  /** Where the enrollment originated; defaults to the recommender on this surface. */
  source?: "self" | "admin_assigned" | "recommender";
  label?: string;
};

/**
 * Self-enroll into a recommended course, then route straight into the
 * course-consumption page. POSTs to the existing /api/academy/enroll
 * route (idempotent - a re-click returns the existing enrollment rather
 * than resetting progress). Shows a brief "Enrolled" state before the
 * navigation completes.
 */
export function EnrollButton({
  candidateId,
  courseId,
  source = "recommender",
  label,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const onClick = () => {
    setEnrolling(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/academy/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, courseId, source }),
        });
        const data = (await res.json()) as { enrollment_id?: string; error?: string };
        if (!res.ok || !data.enrollment_id) {
          setEnrolling(false);
          toast.error(data.error ?? t("academy.enroll.enrollFail"));
          return;
        }
        setEnrolled(true);
        router.push(`/candidate/academy/${data.enrollment_id}`);
      } catch {
        setEnrolling(false);
        toast.error(t("academy.enroll.enrollFail"));
      }
    });
  };

  const disabled = pending || enrolling || enrolled;

  return (
    <Button size="sm" onClick={onClick} disabled={disabled} className="w-full gap-1.5">
      {enrolled ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("academy.enroll.enrolled")}
        </>
      ) : enrolling ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("academy.enroll.enrolling")}
        </>
      ) : (
        <>
          <GraduationCap className="h-3.5 w-3.5" />
          {label ?? t("academy.enroll.startLearning")}
          <ArrowRight className="h-3.5 w-3.5 ms-auto" />
        </>
      )}
    </Button>
  );
}
