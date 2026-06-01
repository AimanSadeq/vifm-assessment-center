"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers3, Link2, Check, Loader2, Download, UserPlus, Trash2 } from "lucide-react";
import type { FunctionProgramView, ProgramParticipant } from "@/lib/competencies/technical-program";
import { addParticipantAction, removeParticipantAction } from "../actions";

const LEVEL_TONE: Record<number, string> = {
  1: "bg-rose-100 text-rose-800 border-rose-300",
  2: "bg-amber-100 text-amber-800 border-amber-300",
  3: "bg-sky-100 text-sky-800 border-sky-300",
  4: "bg-blue-100 text-blue-800 border-blue-300",
  5: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function FunctionProgramDetail({
  programId,
  view,
  participants,
}: {
  programId: string;
  view: FunctionProgramView;
  participants: ProgramParticipant[];
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState("");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const pdfLang = i18n.language === "ar" ? "ar" : "en";

  const tokenByParticipant = new Map(participants.map((p) => [p.id, p.accessToken]));
  const skillLabel = (en: string) => {
    const i = view.skillsEn.indexOf(en);
    return i >= 0 ? view.skills[i] : en;
  };
  const levelLabel = (label: string | null) => {
    if (!label) return "";
    const v = t(`tech.take.levels.${label}`);
    return v.startsWith("tech.take.levels.") ? label : v;
  };

  const run = (
    fn: () => Promise<{ error?: string } | { ok: true } | { ok: true; id: string; accessToken: string }>,
    okMsg?: string,
    after?: () => void
  ) =>
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (okMsg) toast.success(okMsg);
      after?.();
      router.refresh();
    });

  const copyLink = async (accessToken: string) => {
    const url = `${window.location.origin}/ac/tech-assessment?token=${accessToken}&functionKey=${view.functionRef}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(accessToken);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="h-4 w-4 text-[#5391D5]" /> {view.functionName}
            </CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("techProg.deepIntro")}</p>
          </div>
          <a
            href={`/api/admin/tech-assessment/programs/${programId}/pdf?lang=${pdfLang}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> {t("engTech.downloadPdf")}
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Skills in scope (the blueprint) */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("techProg.skillsInScope")}</p>
          <div className="flex flex-wrap gap-1.5">
            {view.skills.map((s) => (
              <span key={s} className="inline-flex items-center rounded-full border border-[#5391D5]/30 bg-[#5391D5]/5 px-2.5 py-1 text-xs text-[#010131]">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Participants management */}
        <div className="rounded-md border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[10rem] space-y-1">
              <p className="text-xs font-medium text-slate-600">{t("techProg.addParticipant")}</p>
              <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder={t("techProg.participantNamePh")} className="h-9" />
            </div>
            <Input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder={t("techProg.participantEmailPh")} className="h-9 w-56" />
            <Button
              size="sm"
              disabled={pending || !pName.trim()}
              onClick={() =>
                run(
                  () => addParticipantAction({ programId, fullName: pName, email: pEmail || undefined }),
                  t("techProg.tAdded"),
                  () => { setPName(""); setPEmail(""); }
                )
              }
              className="h-9 gap-1.5"
            >
              <UserPlus className="h-4 w-4" /> {t("techProg.add")}
            </Button>
          </div>
        </div>

        {/* Per-participant results */}
        {participants.length === 0 ? (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">{t("techProg.noParticipants")}</p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("techProg.participantsHdr")}</p>
            <ul className="space-y-2">
              {view.results.map((r) => {
                const token = tokenByParticipant.get(r.participantId) ?? "";
                return (
                  <li key={r.participantId} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-medium text-[#010131]">
                        {r.name}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => removeParticipantAction({ programId, participantId: r.participantId }), t("techProg.tRemoved"))}
                          className="text-rose-400 hover:text-rose-600"
                          title={t("techProg.removeParticipant")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                      <span className="flex items-center gap-2">
                        {r.taken && r.level != null ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${LEVEL_TONE[r.level]}`}>
                            {t("techProg.overall")}: {r.level}/5 · {levelLabel(r.levelLabel)}{r.pct != null ? ` · ${r.pct}%` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">{t("engTech.notStarted")}</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => copyLink(token)}
                          title={t("engTech.copyLink")}
                        >
                          {copied === token ? <Check className="h-3 w-3 text-green-600" /> : <Link2 className="h-3 w-3" />}
                          {copied === token ? t("engTech.copied") : t("engTech.copyLink")}
                        </Button>
                      </span>
                    </div>

                    {/* Per-skill breakdown */}
                    {r.taken && r.perSkill.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {r.perSkill.map((s) => (
                          <div key={s.skill} className="flex items-center gap-3 text-[11px]">
                            <span className="w-48 shrink-0 truncate text-slate-600">{skillLabel(s.skill)}</span>
                            <div className="flex flex-1 gap-1">
                              {Array.from({ length: s.total }).map((_, n) => (
                                <span key={n} className={`h-1.5 flex-1 rounded-full ${n < s.correct ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                              ))}
                            </div>
                            <span className="w-9 shrink-0 text-right tabular-nums text-slate-500">{s.correct}/{s.total}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
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
