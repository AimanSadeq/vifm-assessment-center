import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Database, Globe, Mail, Video, Brain, Clock } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { isEmailConfigured } from "@/lib/integrations/email";
import { isVideoConfigured } from "@/lib/integrations/video";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { getTimersMap, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { TimerSettings } from "./_components/timer-settings";

export default async function SettingsPage() {
  const t = await getServerT();
  const aiConfigured = isAIConfigured();
  const emailConfigured = isEmailConfigured();
  const videoConfigured = isVideoConfigured();

  const timers = await getTimersMap(["quiz", "fluent", "cognitive"]);
  const quizTimer = timers.quiz ?? TIMER_DEFAULTS.quiz;
  const fluentTimer = timers.fluent ?? TIMER_DEFAULTS.fluent;
  const cognitiveTimer = timers.cognitive ?? TIMER_DEFAULTS.cognitive;

  const integrations = [
    {
      name: t("adminSettings.integrationItems.database.name"),
      icon: Database,
      status: "connected",
      description: t("adminSettings.integrationItems.database.description"),
    },
    {
      name: t("adminSettings.integrationItems.auth.name"),
      icon: Shield,
      status: "pending",
      description: t("adminSettings.integrationItems.auth.description"),
    },
    {
      name: t("adminSettings.integrationItems.ai.name"),
      icon: Brain,
      status: aiConfigured ? "connected" : "not configured",
      description: aiConfigured
        ? t("adminSettings.integrationItems.ai.descriptionOn")
        : t("adminSettings.integrationItems.ai.descriptionOff"),
    },
    {
      name: t("adminSettings.integrationItems.email.name"),
      icon: Mail,
      status: emailConfigured ? "connected" : "not configured",
      description: emailConfigured
        ? t("adminSettings.integrationItems.email.descriptionOn")
        : t("adminSettings.integrationItems.email.descriptionOff"),
    },
    {
      name: t("adminSettings.integrationItems.video.name"),
      icon: Video,
      status: videoConfigured ? "connected" : "not configured",
      description: videoConfigured
        ? t("adminSettings.integrationItems.video.descriptionOn")
        : t("adminSettings.integrationItems.video.descriptionOff"),
    },
    {
      name: t("adminSettings.integrationItems.i18n.name"),
      icon: Globe,
      status: "connected",
      description: t("adminSettings.integrationItems.i18n.description"),
    },
  ];

  const statusColor = (s: string) => {
    if (s === "connected") return "default" as const;
    if (s === "pending") return "secondary" as const;
    return "outline" as const;
  };

  const statusLabel = (s: string) => {
    if (s === "connected") return t("adminSettings.status.connected");
    if (s === "pending") return t("adminSettings.status.pending");
    return t("adminSettings.status.notConfigured");
  };

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />
      <div>
        <h1 className="text-2xl font-bold">{t("adminSettings.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("adminSettings.subtitle")}
        </p>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminSettings.integrations")}</CardTitle>
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
                      {statusLabel(integration.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Assessment timers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            {t("adminSettings.timersTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimerSettings quiz={quizTimer} fluent={fluentTimer} cognitive={cognitiveTimer} />
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminSettings.complianceTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>{t("adminSettings.compliance.uaeLaw")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>{t("adminSettings.compliance.pdpl")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>{t("adminSettings.compliance.gdpr")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>{t("adminSettings.compliance.iso")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <span>{t("adminSettings.compliance.acGuidelines")}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("adminSettings.compliance.retention")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminSettings.environmentTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("adminSettings.env.framework")}</span>
            <span>Next.js 14 (App Router)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("adminSettings.env.ui")}</span>
            <span>Tailwind CSS + Shadcn/UI</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("adminSettings.env.database")}</span>
            <span>Supabase (PostgreSQL)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("adminSettings.env.font")}</span>
            <span>Open Sans (VIFM Brand Kit)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("adminSettings.env.languages")}</span>
            <span>{t("adminSettings.env.languagesValue")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
