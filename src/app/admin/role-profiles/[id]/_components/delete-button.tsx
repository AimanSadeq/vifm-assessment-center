"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRoleProfileAction } from "../../actions";

export function DeleteRoleProfileButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const finishDelete = () => {
    toast.success(t("adminRoleProfiles.delete.toastDeleted"));
    router.push("/admin/role-profiles");
    router.refresh();
  };

  const onDelete = async () => {
    setBusy(true);
    const result = await deleteRoleProfileAction(id);
    // Referenced by issued vouchers / completed sittings: deleting will strip
    // the fit section from their reports (FK is SET NULL). Confirm explicitly.
    if ("referenced" in result && result.referenced) {
      setBusy(false);
      const ok = window.confirm(
        `This role is used by ${result.referenced} voucher(s) / sitting(s). Deleting it will remove the role-fit section from their Persona reports. Delete anyway?`,
      );
      if (!ok) return;
      setBusy(true);
      const forced = await deleteRoleProfileAction(id, true);
      setBusy(false);
      if ("error" in forced) { toast.error(forced.error); return; }
      finishDelete();
      return;
    }
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    finishDelete();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          {t("adminRoleProfiles.delete.button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("adminRoleProfiles.delete.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("adminRoleProfiles.delete.dialogDescription", { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("adminRoleProfiles.delete.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} disabled={busy}>
            {busy ? t("adminRoleProfiles.delete.deleting") : t("adminRoleProfiles.delete.button")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
