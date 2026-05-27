"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

type Props = {
  enrollmentId: string;
  lessonKey: string;
};

/**
 * Kicks off the lesson knowledge check: POSTs to the start API (which
 * generates the questions + creates the academy_lesson_attempts row), then
 * refreshes so the server page re-renders with the in-progress check.
 * Generation can take 15-30s when AI is configured, so we show a preparing
 * state during the call.
 */
export function StartCheckButton({ enrollmentId, lessonKey }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/academy/lesson/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId, lessonKey }),
        });
        const data = (await res.json()) as { attemptId?: string; error?: string };
        if (!res.ok || !data.attemptId) {
          toast.error(data.error ?? "Could not start the knowledge check.");
          return;
        }
        router.refresh();
      } catch {
        toast.error("Could not start the knowledge check.");
      }
    });
  };

  return (
    <Button
      onClick={onClick}
      disabled={pending}
      className="gap-2 bg-[#5391D5] hover:bg-[#4380c4]"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing your check...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Start knowledge check
        </>
      )}
    </Button>
  );
}
