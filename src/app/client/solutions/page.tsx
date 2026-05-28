import { getServerT } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, Users, BarChart3, FileText, Monitor, Smartphone, Tablet, Shield,
} from "lucide-react";

const SOLUTIONS = [
  {
    categoryKey: "clientAnalytics.solutions.categoryAssessmentTypes",
    items: [
      { nameKey: "clientAnalytics.solutions.inBasketName", descKey: "clientAnalytics.solutions.inBasketDesc", icon: ClipboardCheck },
      { nameKey: "clientAnalytics.solutions.rolePlayName", descKey: "clientAnalytics.solutions.rolePlayDesc", icon: Users },
      { nameKey: "clientAnalytics.solutions.groupExerciseName", descKey: "clientAnalytics.solutions.groupExerciseDesc", icon: Users },
      { nameKey: "clientAnalytics.solutions.caseStudyName", descKey: "clientAnalytics.solutions.caseStudyDesc", icon: FileText },
      { nameKey: "clientAnalytics.solutions.oralPresentationName", descKey: "clientAnalytics.solutions.oralPresentationDesc", icon: BarChart3 },
      { nameKey: "clientAnalytics.solutions.cbiName", descKey: "clientAnalytics.solutions.cbiDesc", icon: ClipboardCheck },
    ],
  },
  {
    categoryKey: "clientAnalytics.solutions.categoryDeliveryOptions",
    items: [
      { nameKey: "clientAnalytics.solutions.desktopName", descKey: "clientAnalytics.solutions.desktopDesc", icon: Monitor },
      { nameKey: "clientAnalytics.solutions.tabletName", descKey: "clientAnalytics.solutions.tabletDesc", icon: Tablet },
      { nameKey: "clientAnalytics.solutions.mobileName", descKey: "clientAnalytics.solutions.mobileDesc", icon: Smartphone },
    ],
  },
  {
    categoryKey: "clientAnalytics.solutions.categoryAddOnServices",
    items: [
      { nameKey: "clientAnalytics.solutions.proctoringName", descKey: "clientAnalytics.solutions.proctoringDesc", icon: Shield },
      { nameKey: "clientAnalytics.solutions.customReportsName", descKey: "clientAnalytics.solutions.customReportsDesc", icon: FileText },
      { nameKey: "clientAnalytics.solutions.analyticsDashboardName", descKey: "clientAnalytics.solutions.analyticsDashboardDesc", icon: BarChart3 },
    ],
  },
];

export default async function ClientSolutionsPage() {
  const t = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("clientAnalytics.solutions.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("clientAnalytics.solutions.subtitle")}
        </p>
      </div>

      {SOLUTIONS.map((section) => (
        <div key={section.categoryKey}>
          <h2 className="text-lg font-semibold mb-3">{t(section.categoryKey)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.nameKey} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <CardTitle className="text-sm">{t(item.nameKey)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{t(item.descKey)}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{t("clientAnalytics.solutions.available")}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
