import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller, isInternalAraRender } from "@/lib/ara/auth-guards";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { BackLink } from "@/components/shared/back-link";
import { ARA_PILLARS, ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { computeUnitRollup, UNEVEN_THRESHOLD, levelForScore } from "@/lib/ara/unit-rollup";
import { MaturityGauge } from "../report/_components/maturity-gauge";
import { SectionHeader, StatTile, TOKENS } from "../report/_components/report-primitives";
import type { AraAssessment, AraOrganization } from "@/types/ara";
import "../report/report.css";

export const dynamic = "force-dynamic";

const TARGET = 4.0;
type Lang = "en" | "ar";

/**
 * Cross-unit rollup report - the Division / Enterprise deliverable, in English
 * or Arabic (?lang=ar).
 *
 * A unit's own report answers "how ready is this department". This answers the
 * question a single unit cannot: which units are behind, where they differ,
 * and which gaps are shared (fix once, centrally) versus uneven (move capability
 * between units). It reuses the units' already-computed pillar scores, so it
 * can never disagree with the reports underneath it.
 *
 * Arabic was added before the sample set went to any prospect (client decision
 * 2026-09-02): the division head of a Saudi government client is the exact
 * reader of this document, and it was the only deliverable without an Arabic
 * edition. Numbers stay in Western digits, as in the other Arabic reports.
 */
export default async function AraRollupReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { bare?: string; weight?: string; lang?: string };
}) {
  const bare = searchParams?.bare === "1";
  const weighting = searchParams?.weight === "equal" ? "equal" : "respondents";
  const lang: Lang = searchParams?.lang === "ar" ? "ar" : "en";
  const rtl = lang === "ar";
  const T = (en: string, ar: string) => (rtl ? ar : en);
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null;
      }
    >();
  if (!assessment) return notFound();

  // Same ownership rule as the unit report: the layout gates role, this gates
  // the row. The PDF route authorizes first and marks its render internal.
  const internalRender = await isInternalAraRender();
  if (!internalRender) {
    const caller = await getCurrentCaller();
    if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
      return notFound();
    }
  }

  const rollup = await computeUnitRollup(assessment.id, weighting);
  const orgName = (rtl ? assessment.organization?.name_ar : null) || assessment.organization?.name || T("Organisation", "المنظمة");
  const stageDef = ARA_STAGE_MAP[assessment.engagement_stage];
  const stageLabel = (rtl ? stageDef?.label_ar : stageDef?.label_en) ?? assessment.engagement_stage;
  const stageLower = rtl ? stageLabel : stageLabel.toLowerCase();
  const reportDate = new Date().toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pillarName = (id: string) => {
    const p = ARA_PILLARS.find((x) => x.id === id);
    return p ? (rtl ? p.name_ar : p.name_en) : id;
  };
  const levelLabel = (lvl: number) => {
    const l = ARA_MATURITY_LEVELS.find((x) => x.level === lvl);
    return l ? (rtl ? l.label_ar : l.label_en) : "";
  };
  const pctOfTarget = (s: number) => Math.round((s / TARGET) * 100);
  const region = assessment.region === "saudi" ? T("Saudi Arabia", "المملكة العربية السعودية") : T("United Arab Emirates", "الإمارات العربية المتحدة");

  // Arabic needs a shaping-capable webfont in Chromium; the English report
  // uses the stylesheet's Open Sans stack. Same approach as the personal report.
  const arabicFont = rtl ? (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- print-only report page, loaded once per render */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
      {/* dangerouslySetInnerHTML on purpose: a quoted string child is HTML-escaped
          on the server and not on the client, which produced a hydration error
          that the dev overlay then printed INTO the PDF. */}
      <style dangerouslySetInnerHTML={{ __html: ".report-body-wrap, .report-page, .report-page * { font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif; }" }} />
    </>
  ) : null;

  if (rollup.units.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto" dir={rtl ? "rtl" : "ltr"}>
        {arabicFont}
        {!bare && <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label={T("Back to assessment", "العودة إلى التقييم")} />}
        <h1 className="text-2xl font-semibold mt-4" style={{ color: TOKENS.navy }}>
          {T("No units linked yet", "لم تُربط أي وحدات بعد")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {T(
            "A rollup compares the units beneath it - the departments in a division, or the divisions in an enterprise. Link at least two units on the assessment page, then this report will show how they compare. With one unit there is nothing to compare, and its own report already says everything this one could.",
            "يقارن التقرير الموحّد الوحدات التابعة له - الإدارات ضمن القطاع، أو القطاعات ضمن المنشأة. اربط وحدتين على الأقل من صفحة التقييم ليعرض هذا التقرير المقارنة بينها. مع وحدة واحدة لا يوجد ما يُقارَن، وتقريرها الخاص يقول كل ما يمكن أن يقوله هذا التقرير."
          )}
        </p>
      </div>
    );
  }

  const scoredUnits = rollup.units.filter((u) => u.overall != null);
  const cellFor = (score: number | undefined) => {
    if (score == null) return { background: "#f9fafb", color: "#cbd5e1", border: "1px solid #f1f5f9" };
    const level = levelForScore(score);
    const tint: Record<number, { bg: string; fg: string }> = {
      1: { bg: "#FB7185", fg: "white" },
      2: { bg: "#fdd9c7", fg: "#374151" },
      3: { bg: "#fef3c7", fg: "#374151" },
      4: { bg: "#a7f3d0", fg: "#065f46" },
      5: { bg: "#12805c", fg: "white" },
    };
    const t = tint[level] ?? tint[3];
    return { background: t.bg, color: t.fg, border: "none" };
  };
  const cellHead: React.CSSProperties = {
    textAlign: rtl ? "right" : "left", padding: "6pt 8pt", fontWeight: 600, fontSize: "9pt", color: "#374151",
  };
  const cell: React.CSSProperties = { padding: "6pt 8pt", fontSize: "9.5pt", color: "#374151" };
  const strongest = scoredUnits[0];
  const weakest = scoredUnits[scoredUnits.length - 1];
  // Unit names: the rollup carries EN and AR; spreads name units by their EN
  // label, so map back through the unit list when rendering Arabic.
  const unitName = (u: { label: string; label_ar: string }) => (rtl ? u.label_ar : u.label);
  const byLabel = new Map(rollup.units.map((u) => [u.label, u]));
  const localiseUnit = (label: string | null) => (label && byLabel.get(label) ? unitName(byLabel.get(label)!) : label ?? "");
  const top = rollup.unevenPillars[0];
  const shared = rollup.sharedGaps;

  return (
    <>
      {arabicFont}
      {!bare && (
        <div className="no-print bg-white border-b px-6 py-3 flex items-center justify-between" dir={rtl ? "rtl" : "ltr"}>
          <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label={T("Back to assessment", "العودة إلى التقييم")} />
          <div className="flex items-center gap-4 text-sm">
            <a className="underline" href={`/api/ara/reports/${assessment.id}/rollup/pdf?language=en`}>Download PDF (English)</a>
            <a className="underline" href={`/api/ara/reports/${assessment.id}/rollup/pdf?language=ar`}>تنزيل PDF (العربية)</a>
          </div>
        </div>
      )}

      <div className={`report-body-wrap ${bare ? "" : "bg-gray-100 py-8"}`} dir={rtl ? "rtl" : "ltr"}>
        {/* ─── Cover ─── */}
        <section
          className="report-page report-cover flex flex-col justify-between"
          style={{ background: "#010131", color: "white" }}
        >
          <div className="flex items-center gap-3">
            <VifmLogo variant="white" size="md" />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.7 }}>
              {assessment.is_sandbox
                ? T("Confidential - Sample - Not for Client Distribution", "سري - نموذج توضيحي - ليس للتوزيع على العملاء")
                : T("Confidential - For Internal VIFM Use", "سري - للاستخدام الداخلي في VIFM")}
            </p>
            <h1 className="mt-6" style={{ fontSize: "34pt", fontWeight: 700, lineHeight: 1.15 }}>
              {orgName}
            </h1>
            <p className="text-lg mt-3" style={{ color: "white", opacity: 0.85 }}>
              {T(`${stageLabel} AI Readiness - Cross-unit comparison`, `الجاهزية للذكاء الاصطناعي على مستوى ${stageLabel} - مقارنة بين الوحدات`)}
            </p>
            <p className="text-sm mt-6" style={{ color: "white", opacity: 0.75 }}>
              {rollup.units.length} {T("units", "وحدات")} · {rollup.totalRespondents} {T("respondents", "مشاركاً")}
            </p>
          </div>
          <div className="flex justify-between text-xs" style={{ color: "white", opacity: 0.75 }}>
            <div>
              <p>{region}</p>
              <p>{assessment.scope_label ?? stageLabel}</p>
            </div>
            <div style={{ textAlign: rtl ? "left" : "right" }}>
              <p>{T("Report generated", "أُنشئ التقرير في")} {reportDate}</p>
              <p>Virginia Institute of Finance and Management</p>
            </div>
          </div>
        </section>

        {/* ─── Executive summary ─── */}
        <section className="report-page">
          <SectionHeader
            eyebrow={T("Cross-unit summary", "ملخّص المقارنة بين الوحدات")}
            title={T("How the units compare", "كيف تتقارن الوحدات")}
            kicker={T(
              "Each unit was assessed separately and has its own report. This view compares them: where they stand together, and where they differ.",
              "قُيِّمت كل وحدة على حدة ولها تقريرها الخاص. يقارن هذا العرض بينها: أين تتفق وأين تختلف."
            )}
          />

          <div className="stat-strip" style={{ marginTop: "16pt" }}>
            <StatTile
              label={T("Units assessed", "الوحدات المقيَّمة")}
              value={String(rollup.units.length)}
              accent={`${scoredUnits.length} ${T("with scores", "لها درجات")}`}
              accentColor={TOKENS.navy}
            />
            <StatTile
              label={T(`${stageLabel} readiness`, `جاهزية ${stageLabel}`)}
              value={rollup.overall != null ? rollup.overall.toFixed(2) : "-"}
              accent={rollup.overallBand ? (rtl ? rollup.overallBand.label_ar : rollup.overallBand.label_en) : T("Not yet scored", "لم تُحتسب بعد")}
              accentColor={TOKENS.navy}
            />
            <StatTile
              label={T("Shared gaps", "فجوات مشتركة")}
              value={String(shared.length)}
              accent={T("Every unit below 4.00", "كل الوحدات دون 4.00")}
              accentColor={TOKENS.rose}
            />
            <StatTile
              label={T("Uneven pillars", "ركائز متفاوتة")}
              value={String(rollup.unevenPillars.length)}
              accent={T(`Units differ by ${UNEVEN_THRESHOLD.toFixed(1)}+`, `تفاوت بين الوحدات بمقدار ${UNEVEN_THRESHOLD.toFixed(1)} فأكثر`)}
              accentColor={TOKENS.amber}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "18pt", marginTop: "20pt", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "8.5pt", letterSpacing: rtl ? 0 : "0.12em", textTransform: "uppercase", color: TOKENS.mute, fontWeight: 700, margin: "0 0 6pt" }}>
                {T("Narrative", "القراءة")}
              </p>
              <p className="report-body">
                {rtl ? (
                  <>
                    عبر {rollup.units.length} وحدات و{rollup.totalRespondents} مشاركاً، تسجّل <strong>{orgName}</strong>{" "}
                    <strong>{rollup.overall != null ? rollup.overall.toFixed(2) : "-"} / 5.00</strong>
                    {rollup.overallBand ? ` (${rollup.overallBand.label_ar})` : ""}.
                    {strongest && weakest && scoredUnits.length > 1 && (
                      <> أقوى الوحدات <strong>{unitName(strongest)}</strong> عند {strongest.overall!.toFixed(2)}؛ وأضعفها <strong>{unitName(weakest)}</strong> عند {weakest.overall!.toFixed(2)}.</>
                    )}
                    {shared.length > 0 && (
                      <> {shared.length} {shared.length === 1 ? "ركيزة تقع" : "ركائز تقع"} دون المستهدف في <em>كل</em> وحدة، بدءاً بـ<strong>{pillarName(shared[0].pillar_id)}</strong>.</>
                    )}
                  </>
                ) : (
                  <>
                    Across {rollup.units.length} units and {rollup.totalRespondents} respondents,{" "}
                    <strong>{orgName}</strong> scores{" "}
                    <strong>{rollup.overall != null ? rollup.overall.toFixed(2) : "-"} / 5.00</strong>
                    {rollup.overallBand ? ` (${rollup.overallBand.label_en})` : ""}.
                    {strongest && weakest && scoredUnits.length > 1 && (
                      <> The strongest unit is <strong>{unitName(strongest)}</strong> at {strongest.overall!.toFixed(2)}; the weakest is <strong>{unitName(weakest)}</strong> at {weakest.overall!.toFixed(2)}.</>
                    )}
                    {shared.length > 0 && (
                      <> {shared.length} pillar{shared.length === 1 ? " sits" : "s sit"} below target in <em>every</em> unit, starting with <strong>{pillarName(shared[0].pillar_id)}</strong>.</>
                    )}
                  </>
                )}
              </p>
              {/* The point of a rollup: the average is the least useful number
                  on the page when the units disagree. */}
              {top && (
                <p className="report-body" style={{ marginTop: "6pt" }}>
                  {rtl ? (
                    <>في <strong>{pillarName(top.pillar_id)}</strong> تتباعد الوحدات بمقدار {top.spread.toFixed(2)} ({localiseUnit(top.weakest)} {top.min.toFixed(2)} إلى {localiseUnit(top.strongest)} {top.max.toFixed(2)}). متوسط واحد لا يصف أياً منهما.</>
                  ) : (
                    <>On <strong>{pillarName(top.pillar_id)}</strong> the units are {top.spread.toFixed(2)} apart ({localiseUnit(top.weakest)} {top.min.toFixed(2)} to {localiseUnit(top.strongest)} {top.max.toFixed(2)}). A single average describes neither.</>
                  )}
                </p>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MaturityGauge score={rollup.overall} lang={lang} />
            </div>
          </div>

          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "14pt" }}>
            {rtl
              ? `درجة ${stageLabel} هي ${rollup.weighting === "respondents" ? "متوسط مرجّح بعدد المشاركين لدرجات الوحدات، فالوحدة الأكبر لها وزن أكبر" : "متوسط بسيط لدرجات الوحدات، فلكل وحدة الوزن نفسه"}. ودرجة كل وحدة هي متوسط الركائز الداخلة في نطاق تلك الوحدة.`
              : `The ${stageLower} score is a ${rollup.weighting === "respondents" ? "respondent-weighted average of the unit scores, so a larger unit counts for more" : "straight average of the unit scores, so every unit counts equally"}. Each unit score is the mean of the pillars in that unit's own scope.`}
          </p>
        </section>

        {/* ─── Unit ranking ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Units ranked", "ترتيب الوحدات")}</h2>
          <p className="report-body">
            {T(
              "Every unit on the same 1.00-5.00 scale, against the 4.00 AI Ready target. Respondents shown because a score from three people carries less weight than one from forty.",
              "كل وحدة على المقياس نفسه من 1.00 إلى 5.00، مقابل المستهدف 4.00 (الجاهزية للذكاء الاصطناعي). يُعرض عدد المشاركين لأن درجة من ثلاثة أشخاص أقل وزناً من درجة من أربعين."
            )}
          </p>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginTop: "12pt" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>{T("Unit", "الوحدة")}</th>
                <th style={cellHead}>{T("Respondents", "المشاركون")}</th>
                <th style={cellHead}>{T("Score", "الدرجة")}</th>
                <th style={cellHead}>{T("% of target", "% من المستهدف")}</th>
                <th style={cellHead}>{T("Maturity", "النضج")}</th>
              </tr>
            </thead>
            <tbody>
              {rollup.units.map((u) => {
                const lvl = u.overall != null ? levelForScore(u.overall) : null;
                return (
                  <tr key={u.assessment_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>
                      <strong>{unitName(u)}</strong>
                      {u.pooled && (
                        <span style={{ color: "#6b7280", fontSize: "8.5pt" }}>
                          {" "}({u.children.length} {T(u.children.length === 1 ? "department" : "departments", u.children.length === 1 ? "إدارة" : "إدارات")})
                        </span>
                      )}
                    </td>
                    <td style={cell}>{u.completed_respondents}</td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {u.overall != null ? u.overall.toFixed(2) : "-"}
                    </td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>
                      {u.overall != null ? `${pctOfTarget(u.overall)}%` : "-"}
                    </td>
                    <td style={cell}>{lvl != null ? `L${lvl} ${levelLabel(lvl)}` : T("Not scored", "لم تُحتسب")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        {/* ─── Drill-down: the departments inside each division (enterprise only) ─── *
         * An enterprise compares its divisions, and each division's number is
         * pooled from its departments. The reader who owns a division needs to
         * see which department is carrying or dragging it. */}
        {rollup.units.some((u) => u.children.length > 0) && (
          <div style={{ marginTop: "18pt" }}>
            <h3 className="report-h3">{T("Departments within each division", "الإدارات داخل كل قطاع")}</h3>
            <p className="report-body">
              {T(
                "Each division's score above is a respondent-weighted pool of the departments listed here. A division can look average while one department inside it is well ahead and another well behind - this is where that shows.",
                "درجة كل قطاع أعلاه هي متوسط مرجّح بعدد المشاركين للإدارات المدرجة هنا. قد يبدو القطاع متوسطاً بينما تتقدّم إدارة داخله كثيراً وتتأخر أخرى كثيراً - وهنا يظهر ذلك."
              )}
            </p>
            {rollup.units.filter((u) => u.children.length > 0).map((div) => (
              <div key={div.assessment_id} style={{ marginTop: "12pt" }}>
                <h3 className="report-h3">{unitName(div)} · {div.overall != null ? div.overall.toFixed(2) : "-"}</h3>
                <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={cellHead}>{T("Department", "الإدارة")}</th>
                      <th style={cellHead}>{T("Respondents", "المشاركون")}</th>
                      <th style={cellHead}>{T("Score", "الدرجة")}</th>
                      <th style={cellHead}>{T("% of target", "% من المستهدف")}</th>
                      <th style={cellHead}>{T("Maturity", "النضج")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...div.children].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)).map((d) => {
                      const lvl = d.overall != null ? levelForScore(d.overall) : null;
                      return (
                        <tr key={d.assessment_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={cell}><strong>{unitName(d)}</strong></td>
                          <td style={cell}>{d.completed_respondents}</td>
                          <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{d.overall != null ? d.overall.toFixed(2) : "-"}</td>
                          <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{d.overall != null ? `${pctOfTarget(d.overall)}%` : "-"}</td>
                          <td style={cell}>{lvl != null ? `L${lvl} ${levelLabel(lvl)}` : T("Not scored", "لم تُحتسب")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        </section>

        {/* ─── Units x pillars matrix ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Units by pillar", "الوحدات حسب الركيزة")}</h2>
          <p className="report-body">
            {T(
              `Every unit against every pillar it was assessed on. Blank means the pillar was not in that unit's scope, which is not the same as a low score. Colour is the maturity level, so a row of green and one red cell is a targeted problem, and a uniformly amber column is a problem the whole ${stageLower} shares.`,
              `كل وحدة مقابل كل ركيزة قُيِّمت عليها. الخلية الفارغة تعني أن الركيزة لم تكن ضمن نطاق تلك الوحدة، وهذا يختلف عن الدرجة المنخفضة. يمثّل اللون مستوى النضج؛ فصفٌّ أخضر بخلية حمراء واحدة مشكلة محدّدة، وعمودٌ كهرماني بالكامل مشكلة يتقاسمها ${stageLabel} كله.`
            )}
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: `120pt repeat(${rollup.pillars.length}, 1fr)`,
            gap: "2pt",
            marginTop: "14pt",
            fontSize: "8.5pt",
          }}>
            <div />
            {rollup.pillars.map((p) => (
              <div key={p} style={{ textAlign: "center", color: "#6b7280", fontSize: "7pt", lineHeight: 1.2, paddingBottom: "3pt" }}>
                {pillarName(p)}
              </div>
            ))}
            {rollup.units.map((u) => (
              <div key={u.assessment_id} style={{ display: "contents" }}>
                <div style={{ padding: "6pt 8pt", fontWeight: 500, fontSize: "8.5pt", color: "#374151", background: "#f9fafb", borderRadius: "3pt" }}>
                  {unitName(u)}
                </div>
                {rollup.pillars.map((p) => {
                  const v = u.byPillar.get(p);
                  return (
                    <div key={`${u.assessment_id}-${p}`} style={{
                      ...cellFor(v),
                      padding: "6pt",
                      textAlign: "center",
                      borderRadius: "3pt",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      minHeight: "22pt",
                    }}>
                      {v != null ? v.toFixed(2) : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8pt", marginTop: "10pt" }}>
            {rtl ? (
              <>تتراوح الدرجات من <strong>1.00 إلى 5.00</strong>. <strong>4.00 هو مستهدف الجاهزية للذكاء الاصطناعي، وليس الحد الأقصى</strong> - يقع المستوى الرابع «{levelLabel(4)}» (4.00-4.44) والخامس «{levelLabel(5)}» (4.50-5.00) فوقه.</>
            ) : (
              <>Scores run <strong>1.00 to 5.00</strong>. <strong>4.00 is the AI Ready target, not the maximum</strong> - L4 {levelLabel(4)} (4.00-4.44) and L5 {levelLabel(5)} (4.50-5.00) sit above it.</>
            )}
          </p>

          {/* A pillar in the parent's scope that NO unit assessed produces no
              row and no colour, which reads as "fine". Naming it is the
              difference between no evidence and no problem. */}
          {rollup.uncoveredPillars.length > 0 && (
            <div style={{
              marginTop: "14pt", padding: "10pt 12pt",
              background: "#fffbeb", border: "1pt solid #FBBF24",
              borderRadius: "6pt",
            }}>
              <p className="report-body" style={{ margin: 0, fontSize: "9.5pt" }}>
                {rtl ? (
                  <><strong>لم تُقيَّم على هذا المستوى.</strong> {rollup.uncoveredPillars.map(pillarName).join("، ")} ضمن نطاق {stageLabel} لكن لم تغطِّها أي وحدة تابعة - فهذه الركائز تُحدَّد عادةً فوق مستوى الوحدة المفردة. لم تُجمع أي أدلة، وهذا يختلف عن عدم وجود فجوة. قيِّمها على مستوى {stageLabel} لاكتمال الصورة.</>
                ) : (
                  <><strong>Not assessed at this level.</strong> {rollup.uncoveredPillars.map(pillarName).join(", ")} {rollup.uncoveredPillars.length === 1 ? "is" : "are"} in the {stageLower}&apos;s scope but {rollup.uncoveredPillars.length === 1 ? "was" : "were"} not covered by any unit beneath it - these are typically set above the individual unit. No evidence was collected, which is not the same as no gap. Assess {rollup.uncoveredPillars.length === 1 ? "it" : "them"} at {stageLower} level to complete the picture.</>
                )}
              </p>
            </div>
          )}
        </section>

        {/* ─── Where the units differ ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Shared gaps and uneven pillars", "الفجوات المشتركة والركائز المتفاوتة")}</h2>
          <p className="report-body">
            {T(
              "This is the finding a single unit's report cannot produce. A gap every unit shares is usually structural and is fixed once, centrally. A pillar where the units are far apart is usually capability that already exists somewhere in the organisation and has not travelled.",
              "هذه هي النتيجة التي لا يستطيع تقرير وحدة واحدة إنتاجها. الفجوة التي تتقاسمها كل الوحدات غالباً هيكلية وتُعالَج مرة واحدة مركزياً. أما الركيزة التي تتباعد فيها الوحدات فغالباً قدرة موجودة أصلاً في مكان ما من المنظمة ولم تنتقل بعد."
            )}
          </p>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>
            {T("Shared gaps", "الفجوات المشتركة")} ({shared.length})
          </h3>
          {shared.length === 0 ? (
            <p className="report-body report-muted">
              {T(
                "No pillar is below target in every unit. Each gap belongs to specific units, so the work is targeted rather than central.",
                "لا توجد ركيزة دون المستهدف في كل الوحدات. كل فجوة تخص وحدات بعينها، فالعمل موجَّه لا مركزي."
              )}
            </p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>{T("Pillar", "الركيزة")}</th>
                  <th style={cellHead}>{T("Mean", "المتوسط")}</th>
                  <th style={cellHead}>{T("% of target", "% من المستهدف")}</th>
                  <th style={cellHead}>{T("Best unit", "أفضل وحدة")}</th>
                </tr>
              </thead>
              <tbody>
                {shared.map((s) => (
                  <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{s.mean.toFixed(2)}</td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{pctOfTarget(s.mean)}%</td>
                    <td style={cell}>{localiseUnit(s.strongest)} ({s.max.toFixed(2)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="report-h3" style={{ marginTop: "16pt" }}>
            {T("Uneven pillars", "الركائز المتفاوتة")} ({rollup.unevenPillars.length})
          </h3>
          {rollup.unevenPillars.length === 0 ? (
            <p className="report-body report-muted">
              {T(
                `No pillar shows a spread of ${UNEVEN_THRESHOLD.toFixed(1)} or more between units. The units are performing consistently, so the ${stageLower} average is a fair description of all of them.`,
                `لا توجد ركيزة يبلغ التفاوت فيها بين الوحدات ${UNEVEN_THRESHOLD.toFixed(1)} فأكثر. أداء الوحدات متّسق، لذا فإن متوسط ${stageLabel} وصف عادل لها جميعاً.`
              )}
            </p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>{T("Pillar", "الركيزة")}</th>
                  <th style={cellHead}>{T("Spread", "التفاوت")}</th>
                  <th style={cellHead}>{T("Strongest", "الأقوى")}</th>
                  <th style={cellHead}>{T("Weakest", "الأضعف")}</th>
                </tr>
              </thead>
              <tbody>
                {rollup.unevenPillars.map((s) => (
                  <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {s.spread.toFixed(2)}
                    </td>
                    <td style={cell}>{localiseUnit(s.strongest)} ({s.max.toFixed(2)})</td>
                    <td style={cell}>{localiseUnit(s.weakest)} ({s.min.toFixed(2)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{
            marginTop: "18pt", padding: "12pt 14pt",
            background: "var(--ara-bg-soft)", border: "1pt solid var(--ara-line)",
            borderInlineStart: "3pt solid var(--ara-accent)", borderRadius: "6pt",
          }}>
            <h3 className="report-h3" style={{ marginTop: 0 }}>{T("Reading this together", "قراءة الصورة كاملة")}</h3>
            <p className="report-body" style={{ margin: 0 }}>
              {T(
                "Shared gaps set the central agenda: policy, platform and standards that no single unit can fix alone. Uneven pillars set the internal agenda: the unit already scoring highest has practice worth moving, and the Phase 2 workshop is where that transfer gets specified. Each unit's own report carries its detailed findings and its recommended actions.",
                "تحدّد الفجوات المشتركة الأجندة المركزية: السياسات والمنصّات والمعايير التي لا تستطيع وحدة بمفردها إصلاحها. وتحدّد الركائز المتفاوتة الأجندة الداخلية: لدى الوحدة الأعلى درجة ممارسة تستحق النقل، وورشة المرحلة الثانية هي حيث يُحدَّد هذا النقل. ويحمل تقرير كل وحدة نتائجها التفصيلية وإجراءاتها الموصى بها."
              )}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
