"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { startQuizAttemptAction } from "@/app/candidate/quiz/actions";

type Props = {
  candidateId: string;
  competencyId: string;
};

export function StartQuizButton({ candidateId, competencyId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);

  const onClick = () => {
    setGenerating(true);
    startTransition(async () => {
      const result = await startQuizAttemptAction({ candidateId, competencyId });
      setGenerating(false);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : t("quiz.startGenericError");
        toast.error(msg);
        return;
      }
      router.push(`/candidate/quiz/${result.attemptId}`);
    });
  };

  const disabled = pending || generating;

  return (
    <Button
      size="sm"
      variant="default"
      onClick={onClick}
      disabled={disabled}
      className="w-full gap-1.5 mt-1"
    >
      {disabled ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("quiz.startPreparing")}
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          {t("quiz.startButton")}
        </>
      )}
    </Button>
  );
}
