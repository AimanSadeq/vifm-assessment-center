"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  TrendingUp,
  Building2,
  Lightbulb,
  Star,
  type LucideIcon,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { LogoutButton } from "@/components/shared/logout-button";

const navLinks: { href: string; label: string; icon: LucideIcon; exact: boolean }[] = [
  { href: "/client", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/client/engagements", label: "Projects", icon: ClipboardList, exact: false },
  { href: "/client/reports", label: "Review", icon: FileText, exact: false },
  { href: "/client/analytics", label: "Analytics", icon: TrendingUp, exact: false },
  { href: "/client/templates", label: "Templates", icon: Star, exact: false },
  { href: "/client/solutions", label: "Solutions", icon: Lightbulb, exact: false },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-b-accent bg-card shadow-sm">
        <div className="flex h-16 items-center px-4 sm:px-6 overflow-x-auto">
          <Link href="/client" className="flex items-center gap-2 shrink-0">
            <VifmLogo variant="color" size="sm" />
            <p className="text-xs text-muted-foreground hidden sm:block">Client Portal</p>
          </Link>
          <Separator orientation="vertical" className="mx-3 sm:mx-5 h-6 shrink-0" />
          <nav className="flex gap-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm transition-colors whitespace-nowrap",
                    isActive(link.href, link.exact)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Building2 className="h-4 w-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Client</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
