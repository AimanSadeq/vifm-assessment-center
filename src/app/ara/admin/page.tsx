import Link from "next/link";
import { ArrowLeft, Building2, Database, FileText, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AraAdminPage() {
  const tiles = [
    {
      href: "/ara/admin/organizations",
      icon: Building2,
      title: "Organizations",
      description: "Manage client organizations by region and sector.",
      status: "Ready",
    },
    {
      href: "/ara/admin/questions",
      icon: Database,
      title: "Question Bank",
      description: "Author, version, and publish Layer 1 + Layer 2 questions.",
      status: "Ready",
    },
    {
      href: null,
      icon: FileText,
      title: "Regulatory Docs",
      description: "Upload regulatory documents; AI-extract requirements.",
      status: "Coming in M4",
    },
    {
      href: null,
      icon: FlaskConical,
      title: "Sandbox Data",
      description: "Clear all sandbox assessments with confirmation.",
      status: "Coming in M6",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">ARA Admin Console</h1>
        <p className="text-muted-foreground mb-8">
          VIFM staff — manage question bank, regulatory content, and sandbox data.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const inner = (
              <Card className={tile.href ? "hover:border-primary transition-colors cursor-pointer h-full" : "opacity-60 h-full"}>
                <CardHeader>
                  <Icon className="h-5 w-5 text-primary mb-2" />
                  <CardTitle className="text-base">{tile.title}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{tile.status}</CardContent>
              </Card>
            );
            return tile.href ? (
              <Link key={tile.title} href={tile.href}>{inner}</Link>
            ) : (
              <div key={tile.title}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
