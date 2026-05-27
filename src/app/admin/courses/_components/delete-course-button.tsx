"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteCourseAction } from "../actions";

type Props = {
  courseId: string;
  title: string;
};

export function DeleteCourseButton({ courseId, title }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const handleConfirm = () => {
    start(async () => {
      const r = await deleteCourseAction(courseId);
      if ("error" in r && r.error) {
        toast.error(typeof r.error === "string" ? r.error : t("adminCourses.delete.failed"));
        return;
      }
      toast.success(t("adminCourses.delete.deleted"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={t("adminCourses.delete.deleteAria", { title })}
          title={t("adminCourses.delete.deleteCourse")}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("adminCourses.delete.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("adminCourses.delete.confirmBodyPre")}{" "}
            <strong>{title}</strong>{t("adminCourses.delete.confirmBodyPost")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("adminCourses.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin me-1" />}
            {t("adminCourses.delete.deleteBtn")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
