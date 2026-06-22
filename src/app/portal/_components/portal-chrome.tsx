"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { LogoutButton } from "@/components/shared/logout-button";

/** Top-bar chrome for the client self-service portal (client component; the
 *  server layout does the role gate). */
export function PortalChrome({ children, adminPreview }: { children: React.ReactNode; adminPreview: boolean }) {
  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-b-accent bg-card shadow-sm">
        <div className="flex h-16 items-center px-4 sm:px-6">
          <Link href="/portal" className="flex shrink-0 items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden text-xs text-muted-foreground sm:block">Talent Intelligence Portal</span>
          </Link>
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            {adminPreview && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                Admin preview
              </span>
            )}
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Client
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
