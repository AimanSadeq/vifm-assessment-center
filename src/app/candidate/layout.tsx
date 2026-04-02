import Link from "next/link";
import { Shield } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-card shadow-sm px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/candidate" className="flex items-center gap-3">
            <VifmLogo variant="color" size="sm" />
            <p className="text-xs text-muted-foreground">Candidate Portal</p>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6 flex-1">{children}</main>
      <footer className="border-t bg-card py-4 mt-auto">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Virginia Institute of Finance and Management — Confidential</span>
        </div>
      </footer>
    </div>
  );
}
