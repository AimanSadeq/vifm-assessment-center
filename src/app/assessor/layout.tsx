"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Users2,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

const navLinks: { href: string; label: string; icon: LucideIcon; exact: boolean }[] = [
  { href: "/assessor", label: "Assignments", icon: ClipboardCheck, exact: true },
  { href: "/assessor/washup", label: "Wash-Up", icon: Users2, exact: false },
];

export default function AssessorLayout({
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
      <header className="border-b bg-card shadow-sm">
        <div className="flex h-16 items-center px-6">
          <Link href="/assessor" className="flex items-center gap-3">
            <VifmLogo variant="color" size="sm" />
            <p className="text-xs text-muted-foreground">Assessor Portal</p>
          </Link>
          <Separator orientation="vertical" className="mx-5 h-6" />
          <nav className="flex gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive(link.href, link.exact)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-3">
            <LanguageSwitcher />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              {/* TODO: Replace with authenticated user name */}
              <span className="text-sm text-muted-foreground">Assessor</span>
            </div>
          </div>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
