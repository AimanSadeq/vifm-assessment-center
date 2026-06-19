export const dynamic = "force-dynamic";

import Link from "next/link";
import { BadgeCheck, ShieldCheck, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { TECH_DOMAINS, techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";
import {
  bankReadiness,
  listBankItems,
  getCutScore,
  getDomainMeta,
  listDomainBridge,
  listBehaviouralCompetencies,
} from "@/lib/competencies/technical-item-bank";
import { ReviewConsole } from "../_components/review-console";
import { BridgeEditor } from "../_components/bridge-editor";
import { HashScroll } from "../_components/hash-scroll";
import { getServerT } from "@/lib/i18n/server";
import { getTimerMinutes } from "@/lib/assessment-timers";

type Props = { searchParams: { domain?: string } };

export default async function TechAssessmentReviewPage({ searchParams }: Props) {
  const t = await getServerT();
  const selected: TechDomainKey =
    (techDomainByKey(searchParams.domain ?? "")?.key as TechDomainKey | undefined) ?? TECH_DOMAINS[0].key;

  const [readiness, items, cut, domainMeta, bridge, competencies, domainTimer] = await Promise.all([
    bankReadiness(),
    listBankItems(selected),
    getCutScore(selected),
    getDomainMeta(selected),
    listDomainBridge(selected),
    listBehaviouralCompetencies(),
    getTimerMinutes(`tech_domain:${selected}`, null),
  ]);

  const domain = techDomainByKey(selected)!;
  const approvedHere = items.filter((i) => i.status === "approved").length;
  const certifiableHere = approvedHere >= cut.minItems;

  return (
    <div className="space-y-6">
      <HashScroll />
      <BackLink href="/admin/tech-assessment" label={t("tech.cmd.title")} />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#4c0519] to-[#881337] text-white p-5">
        <div className="flex items-start gap-3">
          <BadgeCheck className="h-8 w-8 text-rose-200 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-rose-100/80">{t("tech.cert")}</p>
            <h1 className="text-2xl font-bold leading-tight">{t("tech.console.title")}</h1>
            <p className="text-sm text-rose-50/90 mt-1 max-w-2xl">{t("tech.console.intro")}</p>
          </div>
        </div>
      </div>

      {/* Bank readiness grid (all domains) */}
      <Card id="readiness" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#5391D5]" />
            {t("tech.console.readiness")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {readiness.map((r) => {
              const d = techDomainByKey(r.domainKey)!;
              const active = r.domainKey === selected;
              return (
                <Link
                  key={r.domainKey}
                  href={`/admin/tech-assessment/items?domain=${r.domainKey}`}
                  className={`rounded-md border p-3 transition-colors ${
                    active ? "border-rose-400 bg-rose-50/60 ring-1 ring-rose-300" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#010131] truncate">{d.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.approved}/{r.minItems} {t("tech.console.approvedSuffix")}
                    </span>
                    {r.certifiable ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        {t("tech.cmd.certifiable")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("tech.cmd.indicative")}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FlaskConical className="h-3 w-3" />
            {t("tech.console.readinessNote")}
          </p>
        </CardContent>
      </Card>

      {/* Selected domain: behavioural bridge (technical → AC 41) */}
      <BridgeEditor
        domainKey={selected}
        domainName={domain.name}
        meta={domainMeta}
        bridge={bridge}
        competencies={competencies}
      />

      {/* Selected domain: cut-score + items */}
      <ReviewConsole
        domainKey={selected}
        domainName={domain.name}
        skills={domain.skills}
        items={items}
        cut={cut}
        approvedHere={approvedHere}
        certifiableHere={certifiableHere}
        domainTimerMinutes={domainTimer}
      />
    </div>
  );
}
