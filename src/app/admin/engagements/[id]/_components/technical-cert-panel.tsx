"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, ShieldCheck, AlertCircle, Link2, Check, ExternalLink, Loader2, Plus, X } from "lucide-react";
import type { EngagementTechProgram } from "@/lib/competencies/engagement-tech-program";
import { setEngagementTechDomainAction } from "../technical-actions";

export function TechnicalCertPanel({
  engagementId,
  program,
}: {
  engagementId: string;
  program: EngagementTechProgram;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string>("");

  const inScopeKeys = new Set(program.inScope.map((d) => d.key));
  const levelLabel = (label: string | null) => {
    if (!label) return "";
    const v = t(`tech.take.levels.${label}`);
    return v.startsWith("tech.take.levels.") ? label : v;
  };

  const toggle = (domainKey: string, inScope: boolean) =>
    startTransition(async () => {
      const res = await setEngagementTechDomainAction({ engagementId, domainKey, inScope });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  const copyLink = async (candidateId: string, domainKey: string) => {
    const url = `${window.location.origin}/ac/tech-assessment?candidateId=${candidateId}&engagementId=${engagementId}&domainKey=${domainKey}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(`${candidateId}|${domainKey}`);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4 text-[#5391D5]" /> {t("engTech.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("engTech.intro")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Domain scope picker */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("engTech.inScopeLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {program.allDomains.map((d) => {
              const on = inScopeKeys.has(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(d.key, !on)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                    on
                      ? "border-[#5391D5] bg-[#5391D5]/10 text-[#010131]"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {on ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {d.name}
                  {d.certifiable ? (
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("engTech.pickHint")}</p>
        </div>

        {/* Per-domain candidate status */}
        {program.inScope.length === 0 ? (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">{t("engTech.noScope")}</p>
        ) : program.candidates.length === 0 ? (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">{t("engTech.noCandidates")}</p>
        ) : (
          <div className="space-y-4">
            {program.inScope.map((d) => {
              const certifiedCount = program.candidates.filter((c) => c.perDomain[d.key]?.certified && c.perDomain[d.key]?.passedCut).length;
              return (
                <div key={d.key} className="rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#010131]">
                      {d.name}
                      {d.certifiable ? (
                        <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-800">{t("engTech.certifiable")}</Badge>
                      ) : (
                        <Badge className="border-amber-200 bg-amber-100 text-[10px] text-amber-800">{t("engTech.indicativeOnly")}</Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("engTech.certifiedCount", { n: certifiedCount, total: program.candidates.length })}
                    </span>
                  </div>
                  {!d.certifiable && (
                    <p className="border-b bg-amber-50/50 px-4 py-1.5 text-[11px] text-amber-700">
                      {t("engTech.indicativeCaption", { approved: d.approved, min: d.minItems })}
                    </p>
                  )}
                  <ul className="divide-y">
                    {program.candidates.map((c) => {
                      const s = c.perDomain[d.key];
                      const code = `${c.id}|${d.key}`;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <span className="font-medium text-[#010131]">{c.name}</span>
                          <span className="flex items-center gap-2">
                            {/* status */}
                            {!s?.taken ? (
                              <span className="text-xs text-slate-400">{t("engTech.notStarted")}</span>
                            ) : s.certified && s.passedCut && s.credentialCode ? (
                              <a
                                href={`/verify/${s.credentialCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                              >
                                <ShieldCheck className="h-3 w-3" /> {t("engTech.certified")} <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : s.certified && s.passedCut === false ? (
                              <span className="text-xs text-rose-600">
                                {t("engTech.belowCut")} · {s.level}/5 · {levelLabel(s.levelLabel)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">
                                {s.level}/5 · {levelLabel(s.levelLabel)}
                              </span>
                            )}
                            {/* assign / copy link */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => copyLink(c.id, d.key)}
                              title={t("engTech.copyLink")}
                            >
                              {copied === code ? <Check className="h-3 w-3 text-green-600" /> : <Link2 className="h-3 w-3" />}
                              {copied === code ? t("engTech.copied") : t("engTech.copyLink")}
                            </Button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {pending && (
          <p className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("engTech.saving")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
