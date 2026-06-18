"use client";

import { Download, RotateCcw, BookOpen } from "lucide-react";
import { personaBand, personaBandLabel, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";
import type { PersonaPdfData } from "@/lib/reports/persona-profile";

// On-screen Persona report - a faithful HTML/Tailwind mirror of the PDF
// (persona-profile.tsx), rendered from the SAME PersonaPdfData built by
// buildPersonaPdfData. Keeping one data source means the on-screen result and
// the downloaded PDF can never drift. Covers both purposes and every sharpened
// section (interview guide, decision block, role-critical markers, watch areas,
// summary, planning scaffold, coaching, overused, consistency, percentiles).
// Markers are inline SVG (no emoji / icon-font).

const ACCENT = "#5391D5";
const AMBER = "#b45309";
const EMERALD = "#059669";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function RoleDot({ kind }: { kind: "critical" | "role" }) {
  return (
    <svg width={9} height={9} viewBox="0 0 8 8" className="inline-block shrink-0">
      <polygon points="4,0 8,4 4,8 0,4" fill={kind === "critical" ? ACCENT : "#ffffff"} stroke={ACCENT} strokeWidth={1} />
    </svg>
  );
}
function Caution() {
  return (
    <svg width={12} height={12} viewBox="0 0 10 10" className="inline-block shrink-0">
      <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="none" stroke={AMBER} strokeWidth={1} />
      <line x1="5" y1="3.5" x2="5" y2="6.5" stroke={AMBER} strokeWidth={1} />
      <circle cx="5" cy="8.2" r="0.6" fill={AMBER} />
    </svg>
  );
}
function Bullet({ color }: { color: string }) {
  return (
    <svg width={6} height={6} viewBox="0 0 5 5" className="mt-1.5 inline-block shrink-0">
      <circle cx="2.5" cy="2.5" r="2" fill={color} />
    </svg>
  );
}
function Check() {
  return (
    <svg width={11} height={11} viewBox="0 0 10 10" className="mt-0.5 inline-block shrink-0">
      <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke={EMERALD} strokeWidth={1.4} />
    </svg>
  );
}

export function PersonaReportView({
  data,
  ar,
  sessionId,
  onReset,
}: {
  data: PersonaPdfData;
  ar: boolean;
  sessionId: string | null;
  onReset: () => void;
}) {
  const dev = data.purpose === "development";
  const hiring = data.purpose === "hiring";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);
  const pct = (p?: number | null) => (p != null ? ` · ${ordinal(p)} ${tx("pct", "مئيني")}` : "");

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5 rounded-xl border bg-white p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {data.takerName ? (
          <p className="text-sm text-slate-500">
            {tx("Self-profile for", "الملف الذاتي لـ")} <span className="font-semibold text-[#010131]">{data.takerName}</span>
          </p>
        ) : <span />}
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {hiring ? tx("Hiring fit · self-report", "ملاءمة توظيف · تقييم ذاتي") : tx("Development · self-report", "تطوير · تقييم ذاتي")}
        </span>
      </div>

      {/* B.1 - holistic opening narrative (development) */}
      {dev && data.summary ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Profile at a glance", "ملخص الملف")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#121232]">{data.summary}</p>
        </div>
      ) : null}

      {/* Role / development panel */}
      {data.fit ? (
        <div className="rounded-lg border border-slate-200 p-4">
          {/* A.4 - areas to verify (hiring) */}
          {hiring && data.watchAreas && data.watchAreas.length > 0 ? (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <Caution /> {tx("Areas to verify at interview", "مجالات للتحقق في المقابلة")}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {tx(
                  "Role-critical competencies the candidate self-rates well below target. Verify with evidence; a prompt to probe, not a reason to reject:",
                  "جدارات حسّاسة للدور قيّمها المرشّح أقل بكثير من المستهدف. تحقّق منها بالأدلة؛ تنبيه للاستقصاء وليس سببًا للرفض:",
                )}{" "}
                {data.watchAreas.join(tx(", ", "، "))}.
              </p>
            </div>
          ) : null}

          <div className="text-center">
            <p className="text-base font-bold uppercase tracking-wide text-[#010131]">
              {dev ? tx("Development plan", "خطة التطوير") : tx("Role fit", "ملاءمة الدور")}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#010131]">{data.fit.roleName}</p>
            {dev ? (
              <span className="mt-2 inline-block rounded-lg bg-[#5391D5]/10 px-5 py-2 text-2xl font-bold text-[#010131]">
                {data.fit.fitPct}% <span className="text-sm font-medium text-slate-500">{tx("aligned to the role target", "متوافق مع مستهدف الدور")}</span>
              </span>
            ) : (
              <span className="mt-2 inline-block rounded-lg px-6 py-2.5 text-3xl font-bold" style={{ color: data.fit.bandHex, backgroundColor: `${data.fit.bandHex}1a` }}>
                {data.fit.fitPct}% · {data.fit.bandLabel}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-700">
                {dev ? tx("Strengths to leverage", "نقاط القوة للاستثمار") : tx("Biggest strengths", "أبرز نقاط القوة")}
              </p>
              <div className="mt-1 space-y-1">
                {(data.fit.strengths ?? []).map((g) => (
                  <div key={`s-${g.name}`} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{g.name}</span>
                    <span className="font-semibold tabular-nums text-emerald-600">{g.self.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                ))}
                {(data.fit.strengths ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">{tx("None at or above target yet.", "لا شيء عند المستهدف أو أعلى بعد.")}</p>
                ) : null}
              </div>
            </div>
            <div>
              <p className={`text-[11px] uppercase tracking-wider ${dev ? "text-amber-700" : "text-rose-700"}`}>
                {dev ? tx("Development priorities", "أولويات التطوير") : tx("Biggest gaps vs the role target", "أكبر الفجوات مقابل المستهدف")}
              </p>
              <div className="mt-1 space-y-1">
                {data.fit.gaps.length > 0 ? data.fit.gaps.map((g) => (
                  <div key={`g-${g.name}`} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{g.name}</span>
                    <span className={`font-semibold tabular-nums ${dev ? "text-amber-600" : "text-rose-600"}`}>{g.self.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-emerald-700">{tx("Meets or exceeds every target.", "يحقّق أو يتجاوز كل المستهدفات.")}</p>
                )}
              </div>
            </div>
          </div>

          <p className={`mt-3 rounded-md px-3 py-2 text-[11px] ${dev ? "bg-[#5391D5]/10 text-[#010131]" : "bg-amber-50 text-amber-800"}`}>
            {dev
              ? tx("A self-report development plan - pair it with a Reflect 360 (others) and the recommended VIFM programmes to turn priorities into progress.", "خطة تطوير قائمة على تقييم ذاتي - اقرنها بتقييم ريفلكت 360 وببرامج VIFM الموصى بها لتحويل الأولويات إلى تقدّم.")
              : tx("A self-report screening signal - corroborate with a Reflect 360, interview and evidence before any hiring decision.", "إشارة فرز قائمة على تقييم ذاتي - تحقّق منها بتقييم 360 ومقابلة وأدلة قبل أي قرار توظيف.")}
          </p>

          {/* C - response style */}
          {data.consistency ? (
            <p className={`mt-2 text-[11px] ${data.consistency.flag === "review" && hiring ? "font-semibold text-amber-700" : "text-slate-500"}`}>
              {tx("Response style", "نمط الاستجابة")}: {data.consistency.flag === "review" ? tx("review", "مراجعة") : tx("consistent", "متّسق")} - {data.consistency.note}
            </p>
          ) : null}
          {/* E - norm group note */}
          {data.normGroupLabel ? (
            <p className="mt-1.5 text-[11px] text-slate-400">
              {tx("Percentiles are relative to", "النسب المئوية مقارنةً بـ")} {data.normGroupLabel}
              {data.normProvisional ? tx(` (provisional${data.normN ? `, n=${data.normN}` : ""})`, ` (أوّلية${data.normN ? `، n=${data.normN}` : ""})`) : ""}, {tx("based on self-report.", "بناءً على تقييم ذاتي.")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* A.2 - decision-integration worksheet (hiring) */}
      {hiring && data.fit ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Decision integration", "دمج القرار")}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {tx("Combine the assessment signal with interview evidence into a documented recommendation. The panel completes this; Persona does not compute a decision.", "ادمج إشارة التقييم مع أدلة المقابلة في توصية موثّقة. تكملها اللجنة؛ بيرسونا لا يحسب القرار.")}
          </p>
          <div className="mt-2 divide-y divide-slate-100 text-sm">
            <div className="flex gap-3 py-2"><span className="w-40 shrink-0 font-semibold text-[#010131]">{tx("Assessment signal", "إشارة التقييم")}</span><span className="text-slate-700">{data.fit.fitPct}% · {data.fit.bandLabel}{data.fit.gaps.length > 0 ? `. ${tx("Watch", "للانتباه")}: ${data.fit.gaps.slice(0, 2).map((g) => g.name).join(tx(", ", "، "))}` : ""}</span></div>
            <div className="flex gap-3 py-2"><span className="w-40 shrink-0 font-semibold text-[#010131]">{tx("Interview rating (1-5)", "تقييم المقابلة (1-5)")}</span><span className="flex-1 border-b border-dashed border-slate-300">&nbsp;</span></div>
            <div className="flex gap-3 py-2"><span className="w-40 shrink-0 font-semibold text-[#010131]">{tx("Evidence / notes", "الأدلة / ملاحظات")}</span><span className="flex-1 border-b border-dashed border-slate-300">&nbsp;</span></div>
            <div className="flex gap-3 py-2"><span className="w-40 shrink-0 font-semibold text-[#010131]">{tx("Overall recommendation", "التوصية النهائية")}</span><span className="text-slate-700">{tx("Advance", "ترشيح")}&nbsp;&nbsp;/&nbsp;&nbsp;{tx("Hold", "تأجيل")}&nbsp;&nbsp;/&nbsp;&nbsp;{tx("Decline", "رفض")}</span></div>
          </div>
        </div>
      ) : null}

      {/* B.3 - coaching prompts (development) */}
      {dev && data.coaching && (data.coaching.forConversation.length > 0 || data.coaching.forSelf.length > 0) ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Discussion prompts", "أسئلة للنقاش")}</p>
          {data.coaching.forConversation.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-[#010131]">{tx("For the development conversation", "لمحادثة التطوير")}</p>
              {data.coaching.forConversation.map((q, i) => (
                <p key={`cv-${i}`} className="mt-1 flex gap-2 text-sm text-[#121232]"><Bullet color={ACCENT} /><span>{q}</span></p>
              ))}
            </div>
          ) : null}
          {data.coaching.forSelf.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[#010131]">{tx("Self-reflection questions", "أسئلة للتأمّل الذاتي")}</p>
              {data.coaching.forSelf.map((q, i) => (
                <p key={`sf-${i}`} className="mt-1 flex gap-2 text-sm text-[#121232]"><Bullet color="#c026d3" /><span>{q}</span></p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Overall self-rating */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Overall self-rating", "متوسط التقييم الذاتي")}</p>
        <span className={`mt-1 inline-block rounded-lg px-4 py-2 text-2xl font-bold ${PERSONA_BAND_TW[personaBand(data.overall).key]}`}>
          {data.overall.toFixed(2)} / 5 · {personaBandLabel(data.overall, ar)}
        </span>
        {data.overallPercentile != null ? (
          <p className="mt-1 text-xs text-slate-500">{ordinal(data.overallPercentile)} {tx("percentile vs", "مئيني مقابل")} {data.normGroupLabel ?? tx("the norm group", "مجموعة المقارنة")}</p>
        ) : null}
      </div>

      {/* Clusters with per-competency detail */}
      <div className="space-y-5">
        {data.clusters.map((cl) => (
          <div key={cl.name}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#010131]">{cl.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PERSONA_BAND_TW[personaBand(cl.avg).key]}`}>{cl.avg.toFixed(1)} · {personaBandLabel(cl.avg, ar)}</span>
            </div>
            <div className="space-y-3">
              {cl.rows.map((r) => (
                <div key={r.name}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-[#010131]">
                      {hiring && r.roleMark ? <RoleDot kind={r.roleMark} /> : null}
                      <span className="font-medium">{r.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {r.score.toFixed(1)}{hiring && r.target != null ? ` / ${r.target.toFixed(1)}` : ""}{pct(r.percentile)} · {personaBandLabel(r.score, ar)}
                    </span>
                  </div>
                  {r.definition ? <p className="mt-0.5 text-xs text-slate-500">{r.definition}</p> : null}
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[#5391D5]" style={{ width: `${(r.score / 5) * 100}%` }} />
                  </div>
                  {r.narrative ? <p className="mt-1 text-xs text-[#121232]">{r.narrative}</p> : null}
                  {r.tip ? <p className="mt-1 text-xs text-[#010131]">{tx("Suggestion", "اقتراح")}: {r.tip}</p> : null}
                  {dev && r.overused ? (
                    <p className="mt-1 flex gap-1.5 text-xs text-emerald-700"><Check /><span>{tx("A real strength: keep it, and watch it does not crowd out the competencies below.", "قوة حقيقية: حافظ عليها واحرص ألا تطغى على الجدارات الأدنى.")}</span></p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* B.2 - development planning scaffold (at the end) */}
      {dev && data.planRows && data.planRows.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Development action plan", "خطة العمل التطويرية")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{tx("For each priority: a development goal, on-the-job application and a success measure for the person to complete with their manager or coach.", "لكل أولوية: هدف تطويري وتطبيق عملي ومقياس نجاح يكملها الشخص مع مديره أو مرشده.")}</p>
          <div className="mt-2 space-y-2">
            {data.planRows.map((p, i) => (
              <div key={`p-${i}`} className="rounded-md border border-slate-200 bg-white p-2.5">
                <p className="text-sm font-semibold text-[#010131]">{i + 1}. {p.competency}</p>
                <p className="mt-0.5 text-xs text-[#121232]">{tx("Action / stretch", "الإجراء / التحدي")}: {p.action}</p>
                {[tx("Development goal", "هدف التطوير"), tx("On-the-job application", "التطبيق في العمل"), tx("Success measure", "مقياس النجاح"), tx("Review by", "المراجعة بحلول")].map((lbl) => (
                  <div key={lbl} className="mt-1 flex items-end gap-2"><span className="w-32 shrink-0 text-[11px] text-slate-500">{lbl}</span><span className="h-4 flex-1 border-b border-slate-300" /></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* VIFM Academy plan (development) - at the END of the report, the courses
          that close the gaps after the analysis + the development plan. */}
      {dev && data.courses && data.courses.length > 0 ? (
        <div className="rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/5 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Recommended VIFM Academy programmes", "برامج أكاديمية VIFM الموصى بها")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{tx("Mapped to the development priorities, ranked by gap and programme fit.", "مرتبطة بأولويات التطوير، مرتّبة حسب الفجوة وملاءمة البرنامج.")}</p>
          <div className="mt-2 space-y-2">
            {data.courses.map((c, i) => (
              <div key={`c-${i}`} className="rounded-md border border-slate-200 bg-white p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#010131]">
                      {c.title}{c.highFit ? <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{tx("High fit", "ملاءمة عالية")}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{c.vertical} · <span className="capitalize">{c.level}</span> · {c.durationLabel}{c.code ? ` · ${c.code}` : ""}</p>
                  </div>
                  {c.fitOutOfTen > 0 ? <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-[#010131]">{c.fitOutOfTen}/10</span> : null}
                </div>
                {c.drivers.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.drivers.map((d, j) => (
                      <span key={`d-${i}-${j}`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-900">
                        <span className="font-medium">{d.label}</span>
                        <span className="opacity-70 tabular-nums">{tx("gap", "فجوة")} {d.gap.toFixed(1)} · ×{d.relevance}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* A.1 - interview guide (hiring, at the end) */}
      {hiring && data.interviewProbes && data.interviewProbes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Interview guide", "دليل المقابلة")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{tx("Behavioural (STAR) probes for the role-critical competencies, grounded in lower-rated answers. A screening aid; record evidence and your own rating.", "أسئلة سلوكية (STAR) للجدارات الحسّاسة للدور، مبنية على الإجابات الأقل تقييمًا. أداة فرز؛ سجّل الأدلة وتقييمك.")}</p>
          <div className="mt-2 space-y-3">
            {data.interviewProbes.map((grp) => (
              <div key={grp.competencyId}>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]"><RoleDot kind="critical" /> {grp.name}</p>
                {grp.probes.map((q, i) => (
                  <p key={`${grp.competencyId}-${i}`} className="mt-1 text-sm text-[#121232]">{i + 1}. {q}</p>
                ))}
                <p className="mt-1 text-xs text-slate-400">{tx("Evidence / rating (1-5)", "الأدلة / التقييم (1-5)")}: ____________________</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Caption + methodology */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {hiring
          ? tx("An indicative self-report fit against the target role - a screening signal, not a hiring decision. Corroborate with a Reflect 360, structured interview and work evidence.", "ملاءمة استرشادية قائمة على تقييم ذاتي - إشارة فرز وليست قرار توظيف. تحقّق منها بتقييم 360 ومقابلة منظّمة وأدلة عمل.")
          : tx("An indicative self-report - how the person sees themselves across the competencies. Pair Persona (self) with a Reflect 360 (others) against a target role to turn it into a readiness verdict.", "تقرير ذاتي استرشادي - كيف يرى الشخص نفسه عبر الجدارات. اقرن بيرسونا (الذات) بتقييم 360 (الآخرون) مقابل دور مستهدف.")}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sessionId ? (
          <>
            <a href={`/api/ac/persona/${sessionId}/report`} className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140]">
              <Download className="h-4 w-4" /> {tx("Download PDF", "تنزيل التقرير (PDF)")}
            </a>
            <a href={`/api/ac/persona/${sessionId}/report?lang=ar`} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Download className="h-4 w-4" /> {tx("Arabic PDF", "التقرير بالعربية")}
            </a>
          </>
        ) : null}
        <a href="/api/ac/persona/methodology/pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <BookOpen className="h-4 w-4" /> {tx("Methodology", "المنهجية")}
        </a>
        <button onClick={onReset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" /> {tx("Start over", "البدء من جديد")}
        </button>
      </div>
    </div>
  );
}
