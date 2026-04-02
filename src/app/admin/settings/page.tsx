import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Database, Globe, Mail, Video, Brain, Clock } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { isEmailConfigured } from "@/lib/integrations/email";
import { isVideoConfigured } from "@/lib/integrations/video";

export default function SettingsPage() {
  const aiConfigured = isAIConfigured();
  const emailConfigured = isEmailConfigured();
  const videoConfigured = isVideoConfigured();

  const integrations = [
    {
      name: "Supabase Database",
      icon: Database,
      status: "connected",
      description: "PostgreSQL database with Row-Level Security",
    },
    {
      name: "Supabase Auth",
      icon: Shield,
      status: "pending",
      description: "Authentication and role-based access control — not yet enabled",
    },
    {
      name: "AI Features (Anthropic Claude)",
      icon: Brain,
      status: aiConfigured ? "connected" : "not configured",
      description: aiConfigured
        ? "AI observation classifier, report writer, development recommender, bias detector"
        : "Set ANTHROPIC_API_KEY in environment to enable AI features",
    },
    {
      name: "Email (SendGrid / Resend)",
      icon: Mail,
      status: emailConfigured ? "connected" : "not configured",
      description: emailConfigured
        ? "Transactional email delivery active"
        : "Set EMAIL_PROVIDER and EMAIL_API_KEY to enable email notifications",
    },
    {
      name: "Video (Daily.co)",
      icon: Video,
      status: videoConfigured ? "connected" : "not configured",
      description: videoConfigured
        ? "Virtual assessment center sessions active"
        : "Set DAILY_API_KEY to enable video conferencing",
    },
    {
      name: "i18n / Arabic RTL",
      icon: Globe,
      status: "connected",
      description: "English and Arabic translations with RTL support",
    },
  ];

  const statusColor = (s: string) => {
    if (s === "connected") return "default" as const;
    if (s === "pending") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          System configuration, integrations, and compliance settings.
        </p>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div key={integration.name} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{integration.name}</p>
                    <Badge variant={statusColor(integration.status)} className="text-[10px]">
                      {integration.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance & Data Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>UAE Federal Decree-Law No. 45 of 2021 (Data Protection)</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>Saudi Arabia Personal Data Protection Law (PDPL)</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>GDPR for EU/UK operations</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>ISO 10667 alignment</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>International Taskforce on Assessment Center Guidelines (6th Edition)</span>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Data retention: maximum 2 years unless contractually extended</span>
          </div>
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Framework</span>
            <span>Next.js 14 (App Router)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">UI</span>
            <span>Tailwind CSS + Shadcn/UI</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database</span>
            <span>Supabase (PostgreSQL)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Font</span>
            <span>Open Sans (VIFM Brand Kit)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Languages</span>
            <span>English, Arabic (RTL)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
