"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type Props = {
  variant?: "default" | "sidebar";
};

export function LogoutButton({ variant = "default" }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors w-full"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        <span>{t("common.signOut")}</span>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      {t("common.signOut")}
    </Button>
  );
}
