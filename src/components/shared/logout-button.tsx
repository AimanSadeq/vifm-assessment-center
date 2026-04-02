"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type Props = {
  variant?: "default" | "sidebar";
};

export function LogoutButton({ variant = "default" }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
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
      Sign Out
    </Button>
  );
}
