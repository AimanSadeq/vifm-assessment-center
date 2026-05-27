import { notFound } from "next/navigation";
import { computeParticipantScoring, type ParticipantScoring } from "@/lib/reflect/scoring";
import {
  recommendCoursesForReflectParticipant,
  HIGH_FIT_THRESHOLD,
  type RecommendedCourse,
} from "@/lib/recommender/courses";
import {
  generateReflectBehaviorTips,
  type BehaviorTip,
} from "@/lib/ai/reflect-behavior-tips";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type SearchParams = Promise<{ bare?: string; lang?: string }>;

export default async function ReflectParticipantReportPage({
  params,
  searchParams,
}: Params & { searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const scoring = await computeParticipantScoring(id);
  if (!scoring) return notFound();

  // Course recommendations - best-effort. If the framework competency names
  // don't match the AC catalogue we silently fall back to an empty list and
  // the recommendation page renders a placeholder.
  const recPayload = await recommendCoursesForReflectParticipant({
    participantId: id,
    limit: 5,
  });

  // P3.4 - Per-behavior AI development tips for the top-5 dev areas.
  // Single Claude call; falls back to a generic tip when no API key.
  const behaviorTips = await generateReflectBehaviorTips(
    scoring.development_areas.map((b) => ({
      behavior_id: b.behavior_id,
      text_en: b.text_en,
      text_ar: b.text_ar,
      others_mean: b.others_mean,
    }))
  );

  const bare = sp.bare === "1";
  const lang: "en" | "ar" | "bilingual" =
    sp.lang === "ar" ? "ar" : sp.lang === "bilingual" ? "bilingual" : "en";

  return (
    <ReportBody
      scoring={scoring}
      recommendations={recPayload.recommendations}
      unmappedCompetencies={recPayload.unmapped}
      behaviorTips={behaviorTips}
      lang={lang}
      bare={bare}
    />
  );
}

// ──────────────────────────────────────────────────────────────
// Layout
// ──────────────────────────────────────────────────────────────

function ReportBody({
  scoring,
  recommendations,
  unmappedCompetencies,
  behaviorTips,
  lang,
  bare,
}: {
  scoring: ParticipantScoring;
  recommendations: RecommendedCourse[];
  unmappedCompetencies: string[];
  behaviorTips: BehaviorTip[];
  lang: "en" | "ar" | "bilingual";
  bare: boolean;
}) {
  const showEn = lang === "en" || lang === "bilingual";
  const showAr = lang === "ar" || lang === "bilingual";
  const rtl = lang === "ar";

  return (
    <div className={`reflect-pdf ${bare ? "bare" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <style>{REPORT_CSS}</style>

      {/* Cover */}
      <section className="page cover">
        <div className="brand-stripe" />
        <div className="cover-inner">
          <div className="eyebrow">{showAr ? "Reflect 360 · Leadership Feedback" : "Reflect 360 · Leadership Feedback"}</div>
          <h1>{showEn && scoring.participant_name}{showEn && showAr && " · "}{showAr && (scoring.participant_name_ar ?? scoring.participant_name)}</h1>
          {scoring.participant_role_title && (
            <div className="role-title">{scoring.participant_role_title}</div>
          )}
          <dl className="cover-meta">
            <dt>{rtl ? "البرنامج" : "Engagement"}</dt>
            <dd>{scoring.engagement_name}</dd>
            <dt>{rtl ? "المؤسسة" : "Organisation"}</dt>
            <dd>{rtl ? scoring.organization_name_ar ?? scoring.organization_name : scoring.organization_name}</dd>
            <dt>{rtl ? "تاريخ التقرير" : "Report date"}</dt>
            <dd>{new Date(scoring.generated_at).toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
          </dl>
          <div className="confidentiality">
            {rtl
              ? "سرّي - للاستخدام التطويري الفردي فقط. لا يُستخدم لأغراض الاختيار أو الترقية."
              : "Confidential - for personal development use only. Not to be used for selection or promotion decisions."}
          </div>

          {/* P3.1 Cover wheel - Self vs Others polygons on the competency axes */}
          <CoverWheel scoring={scoring} rtl={rtl} />
        </div>
      </section>

      {/* How to read */}
      <section className="page">
        <h2>{rtl ? "كيف تقرأ هذا التقرير" : "How to read this report"}</h2>
        <div className="scale-grid">
          <ScaleRow n={1} en="Almost never" ar="نادرًا جدًا" rtl={rtl} />
          <ScaleRow n={2} en="Rarely" ar="نادرًا" rtl={rtl} />
          <ScaleRow n={3} en="Sometimes" ar="أحيانًا" rtl={rtl} />
          <ScaleRow n={4} en="Often" ar="غالبًا" rtl={rtl} />
          <ScaleRow n={5} en="Almost always" ar="دائمًا تقريبًا" rtl={rtl} />
        </div>
        <h3>{rtl ? "فئات المقيّمين" : "Rater groups"}</h3>
        <ul className="rater-groups">
          <li><strong>{rtl ? "أنت" : "Self"}</strong> - {rtl ? "تقييمك الذاتي" : "your own self-assessment"}</li>
          <li><strong>{rtl ? "المدير المباشر" : "Manager"}</strong> - {rtl ? "تقييم مديرك المباشر" : "your line manager's view"}</li>
          <li><strong>{rtl ? "الزملاء" : "Peers"}</strong> - {rtl ? "متوسط آراء زملائك" : "the pooled view of your peers"}</li>
          <li><strong>{rtl ? "التقارير المباشرة" : "Direct reports"}</strong> - {rtl ? "متوسط آراء من يعملون معك مباشرة" : "the pooled view of those who report to you"}</li>
        </ul>
        <div className="callout">
          {rtl
            ? `تظل آراء الزملاء والتقارير المباشرة مجهولة الهوية: لا يُكشف أي متوسط لفئة معينة إلا إذا أكمل ${scoring.anonymity_min_n} مقيّمين على الأقل في تلك الفئة.`
            : `Peer and direct-report responses are anonymised: no group score is shown until at least ${scoring.anonymity_min_n} raters in that group have responded.`}
        </div>

        <h3>{rtl ? "النطاق المرجعي" : "The Favorable Zone"}</h3>
        <div className="favorable-zone-legend">
          <span className="favorable-zone-swatch" />
          <span>
            {rtl
              ? "النطاق المرجعي (3.5–4.25) هو المدى الذي يتم فيه عادةً تقييم القادة الفعّالين في 360 درجة. تظهر شرائح ملوّنة خفيفة على كل شريط لتعطيك خلفية مقارنة سريعة."
              : "The Favorable Zone (3.5–4.25) is the range where effective leaders are typically rated on 360s. A soft band appears on every bar so you can see, at a glance, whether each rater group's mean is within, below, or above that benchmark."}
          </span>
        </div>
      </section>

      {/* Summary */}
      <section className="page">
        <h2>{rtl ? "الملخّص" : "Summary"}</h2>
        <div className="summary-grid">
          <KpiCard
            label={rtl ? "المعدل العام" : "Overall mean"}
            value={fmtScore(scoring.overall_mean)}
            sub={rtl ? "كل المقيّمين" : "All raters"}
          />
          <KpiCard
            label={rtl ? "تقييمك الذاتي" : "Your self-view"}
            value={fmtScore(scoring.overall_self)}
            sub={rtl ? "كيف ترى نفسك" : "How you see yourself"}
          />
          <KpiCard
            label={rtl ? "تقييم الآخرين" : "Others' view"}
            value={fmtScore(scoring.overall_others)}
            sub={rtl ? "متوسط الفئات الأخرى" : "Pooled non-self mean"}
          />
          <KpiCard
            label={rtl ? "الفجوة" : "Gap"}
            value={scoring.overall_gap !== null ? (scoring.overall_gap > 0 ? `+${scoring.overall_gap.toFixed(2)}` : scoring.overall_gap.toFixed(2)) : "-"}
            sub={rtl ? "أنت ↔ الآخرون" : "Self ↔ Others"}
          />
        </div>

        {/* P2 reassessment: side-by-side overall comparison */}
        {scoring.prior_overall_others !== null && (
          <PriorDeltaCard scoring={scoring} rtl={rtl} />
        )}

        {/* P1: Critical-competency alignment between Self and Manager */}
        <CriticalAlignmentCard scoring={scoring} rtl={rtl} />

        <h3>{rtl ? "متوسطات حسب الفئة" : "Means by rater group"}</h3>
        <table className="group-table">
          <thead>
            <tr>
              <th>{rtl ? "الفئة" : "Rater group"}</th>
              <th>{rtl ? "المقيّمون" : "Raters"}</th>
              <th>{rtl ? "الإجابات" : "Responses"}</th>
              <th>{rtl ? "المتوسط" : "Mean"}</th>
            </tr>
          </thead>
          <tbody>
            {scoring.by_group.map((g) => (
              <tr key={g.rater_role}>
                <td>{roleLabelShort(g.rater_role, rtl)}</td>
                <td className="num">{g.rater_count}</td>
                <td className="num">{g.response_count}</td>
                <td className="num">
                  {g.hidden_by_anonymity
                    ? <em>{rtl ? "غير معروض (إخفاء الهوية)" : "Hidden (anonymity)"}</em>
                    : fmtScore(g.mean)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* P2: tenure breakdown */}
        <TenureBreakdownCard scoring={scoring} rtl={rtl} />
      </section>

      {/* Strengths */}
      <BehaviorListPage
        title={rtl ? "نقاط القوة" : "Strengths"}
        subtitle={rtl ? "أعلى 5 سلوكيات حسب رأي الآخرين" : "Top 5 behaviours by Others' mean"}
        behaviors={scoring.strengths}
        rtl={rtl}
        tone="strength"
      />

      {/* Development areas - with P3.4 AI coaching tips */}
      <BehaviorListPage
        title={rtl ? "مجالات التطوير" : "Development areas"}
        subtitle={rtl ? "أقل 5 سلوكيات حسب رأي الآخرين - مع نصيحة تطويرية لكل سلوك" : "Bottom 5 behaviours by Others' mean - with a coaching tip for each"}
        behaviors={scoring.development_areas}
        rtl={rtl}
        tone="develop"
        tips={behaviorTips}
      />

      {/* Blind spots */}
      <BehaviorListPage
        title={rtl ? "النقاط العمياء" : "Blind spots"}
        subtitle={
          rtl
            ? "السلوكيات التي تقيّمها أعلى مما يقيّمها الآخرون - فرصة لزيادة الوعي الذاتي"
            : "Behaviours where you rate yourself higher than others - an opportunity to raise self-awareness"
        }
        behaviors={scoring.blind_spots}
        rtl={rtl}
        tone="blind"
      />

      {/* Hidden strengths */}
      <BehaviorListPage
        title={rtl ? "نقاط القوة الخفية" : "Hidden strengths"}
        subtitle={
          rtl
            ? "السلوكيات التي يقيّمها الآخرون أعلى مما تقيّمها بنفسك - لا تقلّل من قدرتك"
            : "Behaviours where others rate you higher than you rate yourself - don't undersell these"
        }
        behaviors={scoring.hidden_strengths}
        rtl={rtl}
        tone="hidden"
      />

      {/* Per-competency detail */}
      <section className="page no-break-after">
        <h2>{rtl ? "تفاصيل حسب الكفاية" : "Per-competency detail"}</h2>
        {scoring.competencies.map((c) => {
          const selfMarkedCritical = scoring.critical_alignment.self_picks.includes(c.competency_id);
          const managerMarkedCritical = scoring.critical_alignment.manager_picks.includes(c.competency_id);
          const bothMarkedCritical = selfMarkedCritical && managerMarkedCritical;
          return (
          <div key={c.competency_id} className="comp-card">
            <h3>
              {rtl ? c.name_ar ?? c.name_en : c.name_en}
              {bothMarkedCritical && (
                <span className="critical-pill critical-both">
                  {rtl ? "حرج (أنت + المدير)" : "Critical (Self + Mgr)"}
                </span>
              )}
              {!bothMarkedCritical && selfMarkedCritical && (
                <span className="critical-pill critical-self">
                  {rtl ? "حرج (أنت)" : "Critical (Self)"}
                </span>
              )}
              {!bothMarkedCritical && managerMarkedCritical && (
                <span className="critical-pill critical-mgr">
                  {rtl ? "حرج (المدير)" : "Critical (Mgr)"}
                </span>
              )}
            </h3>
            <div className="comp-row">
              <KpiInline label={rtl ? "أنت" : "Self"} value={fmtScore(c.self_mean)} />
              <KpiInline label={rtl ? "الآخرون" : "Others"} value={fmtScore(c.others_mean)} />
              <KpiInline
                label={rtl ? "الفجوة" : "Gap"}
                value={c.gap !== null ? (c.gap > 0 ? `+${c.gap.toFixed(2)}` : c.gap.toFixed(2)) : "-"}
              />
              {c.prior_others_mean !== null && c.others_mean !== null && (
                <PriorDeltaInline
                  prior={c.prior_others_mean}
                  current={c.others_mean}
                  rtl={rtl}
                />
              )}
            </div>
            <div className="group-bars">
              {c.by_group.filter((g) => g.rater_count > 0).map((g) => (
                <div key={g.rater_role} className="group-bar-row">
                  <span className="group-bar-label">{roleLabelShort(g.rater_role, rtl)}</span>
                  <span className="group-bar-track">
                    {/* Favorable Zone band: 3.5–4.25 on a 0–5 scale = 70%–85% of track */}
                    <span className="favorable-zone" />
                    {g.hidden_by_anonymity ? (
                      <em className="group-bar-hidden">{rtl ? "إخفاء الهوية" : "Anonymised"}</em>
                    ) : (
                      <span className="group-bar-fill" style={{ width: `${((g.mean ?? 0) / 5) * 100}%` }} />
                    )}
                  </span>
                  <span className="group-bar-value">{g.hidden_by_anonymity ? "-" : fmtScore(g.mean)}</span>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </section>

      {/* P3.2 Reference Group Comparison - single horizontal-dots view */}
      <ReferenceGroupComparisonPage scoring={scoring} rtl={rtl} />

      {/* P3.3 Strengths & Development Summary */}
      <StrengthsDevSummaryPage scoring={scoring} rtl={rtl} />

      {/* Item-level detail (P0 parity pass) */}
      <ItemLevelDetailPages
        scoring={scoring}
        rtl={rtl}
      />

      {/* Verbatim Start / Stop / Continue (P0 parity pass) */}
      {scoring.open_responses.length > 0 && (
        <VerbatimPage scoring={scoring} rtl={rtl} />
      )}

      {/* Recommended VIFM programmes */}
      <section className="page">
        <h2>{rtl ? "البرامج التدريبية الموصى بها من VIFM" : "Recommended VIFM programmes"}</h2>
        <p className="lead">
          {rtl
            ? "هذه البرامج تستهدف الفجوات الأعلى ظهورًا في تقييمك. اطلب عرض السعر مباشرةً، أو ناقشها مع مدرّبك خلال الجلسة."
            : "These programmes target the gaps that stood out most in your feedback. Request a quote directly, or work them into your IDP with your coach."}
        </p>
        {recommendations.length === 0 ? (
          <div className="callout">
            {rtl
              ? "لا توجد توصيات تلقائية متاحة في الوقت الراهن لإطار الكفايات الخاص بهذا التقرير. يستطيع مدرّبك ربطك يدويًا ببرامج VIFM المناسبة."
              : "No automated recommendations are available for this competency framework. Your coach can map you to suitable VIFM programmes manually."}
            {unmappedCompetencies.length > 0 && (
              <div className="unmapped-detail">
                {rtl ? "كفايات لم تُربط: " : "Unmapped competencies: "}
                {unmappedCompetencies.join(" · ")}
              </div>
            )}
          </div>
        ) : (
          <ol className="programme-list">
            {recommendations.map((p, i) => {
              const isHighFit = p.total_score >= HIGH_FIT_THRESHOLD;
              const topDriver = p.drivers
                .slice()
                .sort((a, b) => b.contribution - a.contribution)[0];
              const courseSlug = p.course_code ?? p.course_id;
              const quoteUrl =
                `/courses/${encodeURIComponent(courseSlug)}/request-quote?source=reflect` +
                `&engagement=${scoring.engagement_id}` +
                `&participant=${scoring.participant_id}`;
              return (
                <li key={p.course_id}>
                  <div className="programme-head">
                    <span className="programme-rank">{i + 1}</span>
                    <span className="programme-title">
                      {rtl ? p.title_ar ?? p.title_en : p.title_en}
                    </span>
                    {isHighFit && (
                      <span className="programme-fit">{rtl ? "★ مناسب جدًا" : "★ HIGH FIT"}</span>
                    )}
                  </div>
                  <div className="programme-meta">
                    {p.course_code && <span>{p.course_code}</span>}
                    <span>{p.vertical.replace(/_/g, " ")}</span>
                    <span>{rtl ? "المستوى" : "Level"}: {p.level}</span>
                    <span>{p.default_duration_days} {rtl ? "أيام" : "days"}</span>
                  </div>
                  <div className="programme-drivers">
                    {p.drivers.map((d, di) => (
                      <span key={di} className="programme-driver-chip">
                        {d.label}{" "}
                        <span className="programme-driver-math">
                          ({d.gap.toFixed(1)} × {d.relevance})
                        </span>
                      </span>
                    ))}
                  </div>
                  {topDriver?.rationale && (
                    <p className="programme-rationale">{topDriver.rationale}</p>
                  )}
                  <div className="programme-cta">
                    <a href={quoteUrl} className="programme-cta-link">
                      {rtl ? "اطلب عرض سعر ←" : "Request a quote →"}
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* IDP scaffold - K-S-S frame (KEEP / STOP / START) */}
      <section className="page">
        <h2>{rtl ? "خطة التطوير الفردية" : "Your Individual Development Plan"}</h2>
        <p className="lead">
          {rtl
            ? "هذا الإطار يلتقط ما تريد الاحتفاظ به وما تريد التخلص منه وما تريد البدء به. املأه خلال جلسة الاستخلاص مع مستشار VIFM - مستندًا إلى ما كتبه المقيّمون أعلاه."
            : "This scaffold captures what to keep doing, what to stop, and what to start. Complete it during your debrief with a VIFM coach - anchored to what your raters wrote above."}
        </p>
        <ol className="idp">
          {(rtl
            ? [
                { tag: "KSS", title: "احتفظ بـ", caption: "السلوكيات التي تخدمك جيدًا - لا تفقدها أثناء التغيير." },
                { tag: "KSS", title: "توقّف عن", caption: "السلوكيات التي تكلّفك أكثر مما تعطيك - تخلّص منها أولًا." },
                { tag: "KSS", title: "ابدأ في", caption: "السلوكيات الجديدة التي ستحدث الفرق الأكبر - جرّب واحدًا في وقت." },
              ]
            : [
                { tag: "KEEP", title: "KEEP doing", caption: "Behaviours that serve you well - don't lose these as you change." },
                { tag: "STOP", title: "STOP doing", caption: "Behaviours that cost more than they give - drop these first." },
                { tag: "START", title: "START doing", caption: "New behaviours that will move the needle most - try one at a time." },
              ]
          ).map((block, i) => (
            <li key={i}>
              <h4>
                <span className={`kss-tag kss-${i === 0 ? "keep" : i === 1 ? "stop" : "start"}`}>{block.tag}</span>
                {block.title}
              </h4>
              <p className="kss-caption">{block.caption}</p>
              <div className="idp-row"><span>{rtl ? "السلوك المستهدف" : "Target behaviour"}</span><span className="idp-line" /></div>
              <div className="idp-row"><span>{rtl ? "لماذا الآن" : "Why now"}</span><span className="idp-line" /></div>
              <div className="idp-row"><span>{rtl ? "الإجراءات الأولى" : "First actions"}</span><span className="idp-line" /></div>
              <div className="idp-row"><span>{rtl ? "كيف ستقيس النجاح" : "How you'll measure success"}</span><span className="idp-line" /></div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function ScaleRow({ n, en, ar, rtl }: { n: number; en: string; ar: string; rtl: boolean }) {
  return (
    <div className="scale-row">
      <span className="scale-num">{n}</span>
      <span className="scale-label">{rtl ? ar : en}</span>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function KpiInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="kpi-inline"><span className="kpi-inline-label">{label}</span><span className="kpi-inline-value">{value}</span></span>
  );
}

function BehaviorListPage({
  title,
  subtitle,
  behaviors,
  rtl,
  tone,
  tips,
}: {
  title: string;
  subtitle: string;
  behaviors: Array<{
    behavior_id: string;
    text_en: string;
    text_ar: string | null;
    self_score: number | null;
    others_mean: number | null;
    gap: number | null;
  }>;
  rtl: boolean;
  tone: "strength" | "develop" | "blind" | "hidden";
  tips?: BehaviorTip[];
}) {
  const tipById = new Map(tips?.map((t) => [t.behavior_id, t]) ?? []);
  return (
    <section className={`page tone-${tone}`}>
      <h2>{title}</h2>
      <div className="lead">{subtitle}</div>
      {behaviors.length === 0 ? (
        <p className="empty">{rtl ? "لا توجد عناصر في هذه القائمة." : "Nothing in this list."}</p>
      ) : (
        <ol className="behavior-list">
          {behaviors.map((b, i) => {
            const tip = tipById.get(b.behavior_id);
            return (
              <li key={b.behavior_id}>
                <div className="behavior-text">
                  <span className="behavior-rank">{i + 1}</span>
                  {rtl ? b.text_ar ?? b.text_en : b.text_en}
                </div>
                <div className="behavior-meta">
                  <span><strong>{rtl ? "أنت" : "Self"}:</strong> {fmtScore(b.self_score)}</span>
                  <span><strong>{rtl ? "الآخرون" : "Others"}:</strong> {fmtScore(b.others_mean)}</span>
                  <span><strong>{rtl ? "الفجوة" : "Gap"}:</strong> {b.gap !== null ? (b.gap > 0 ? `+${b.gap.toFixed(2)}` : b.gap.toFixed(2)) : "-"}</span>
                </div>
                {tip && (
                  <div className="behavior-tip">
                    <span className="behavior-tip-label">
                      {rtl ? "نصيحة تطويرية" : "Coaching tip"}
                    </span>
                    <p className="behavior-tip-text">{rtl ? tip.tip_ar : tip.tip_en}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Cover-page wheel (P3.1). SVG radar chart with two polygons:
// Self (purple) and Others (teal), one axis per competency. The
// iconic 360 visualization. Pure SVG so it renders cleanly under
// Puppeteer without any client-side chart library.
// ──────────────────────────────────────────────────────────────

function CoverWheel({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  const comps = scoring.competencies;
  if (comps.length < 3) return null;

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 32;
  const labelR = r + 18;

  // Angle per competency, starting at the top (12 o'clock) and going
  // clockwise. Same convention as every competitor we sampled.
  const angle = (i: number): number => (i / comps.length) * 2 * Math.PI - Math.PI / 2;

  const pointAt = (val: number, i: number) => {
    const a = angle(i);
    const ratio = Math.max(0, Math.min(5, val)) / 5;
    return [cx + r * ratio * Math.cos(a), cy + r * ratio * Math.sin(a)] as const;
  };

  const polygonPoints = (
    accessor: (c: ParticipantScoring["competencies"][number]) => number | null
  ): string | null => {
    const pts: Array<readonly [number, number]> = [];
    for (let i = 0; i < comps.length; i += 1) {
      const v = accessor(comps[i]);
      if (v === null) return null;
      pts.push(pointAt(v, i));
    }
    return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  };

  const selfPoly = polygonPoints((c) => c.self_mean);
  const othersPoly = polygonPoints((c) => c.others_mean);

  // Concentric grid rings at 1, 2, 3, 4, 5
  const rings = [1, 2, 3, 4, 5].map((n) => (n / 5) * r);

  return (
    <div className="cover-wheel-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" className="cover-wheel">
        {/* Favorable Zone band (3.5–4.25) - annular wedge */}
        <circle cx={cx} cy={cy} r={(4.25 / 5) * r} fill="rgba(217, 119, 6, 0.10)" />
        <circle cx={cx} cy={cy} r={(3.5 / 5) * r} fill="white" />

        {/* Grid rings */}
        {rings.map((rr, i) => (
          <circle key={i} cx={cx} cy={cy} r={rr} fill="none" stroke="#E5EAF2" strokeWidth={0.5} />
        ))}

        {/* Axis lines */}
        {comps.map((_, i) => {
          const [x, y] = pointAt(5, i);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5EAF2" strokeWidth={0.5} />
          );
        })}

        {/* Others polygon (teal) */}
        {othersPoly && (
          <polygon
            points={othersPoly}
            fill="rgba(83, 145, 213, 0.20)"
            stroke="#5391D5"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        )}

        {/* Self polygon (purple) */}
        {selfPoly && (
          <polygon
            points={selfPoly}
            fill="rgba(109, 40, 217, 0.18)"
            stroke="#6D28D9"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeDasharray="2.5,2"
          />
        )}

        {/* Axis labels */}
        {comps.map((c, i) => {
          const a = angle(i);
          const x = cx + labelR * Math.cos(a);
          const y = cy + labelR * Math.sin(a);
          const name = rtl ? c.name_ar ?? c.name_en : c.name_en;
          const short = name.length > 16 ? name.slice(0, 15) + "…" : name;
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize={5}
              fill="#111232"
              textAnchor={Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end"}
              dominantBaseline={Math.sin(a) > 0.3 ? "hanging" : Math.sin(a) < -0.3 ? "alphabetic" : "middle"}
            >
              {short}
            </text>
          );
        })}
      </svg>
      <div className="cover-wheel-legend">
        <span className="cover-wheel-legend-item">
          <span className="cover-wheel-swatch cover-wheel-swatch-self" />
          {rtl ? "أنت" : "Self"}
        </span>
        <span className="cover-wheel-legend-item">
          <span className="cover-wheel-swatch cover-wheel-swatch-others" />
          {rtl ? "الآخرون" : "Others"}
        </span>
        <span className="cover-wheel-legend-item cover-wheel-legend-zone">
          <span className="cover-wheel-swatch cover-wheel-swatch-zone" />
          {rtl ? "النطاق المرجعي" : "Favorable Zone"}
        </span>
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────
// Prior-delta components (P2 reassessment). The card sits on the
// Summary page and gives a punchy headline ("↑ +0.4 vs prior run").
// The inline variant lives on every per-competency card.
// ──────────────────────────────────────────────────────────────

function PriorDeltaCard({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  if (scoring.prior_overall_others === null || scoring.overall_others === null) return null;
  const delta = scoring.overall_others - scoring.prior_overall_others;
  const sign = delta > 0 ? "+" : "";
  const tone = delta >= 0.2 ? "up" : delta <= -0.2 ? "down" : "flat";
  return (
    <div className={`prior-card prior-card-${tone}`}>
      <div className="prior-card-head">
        <span className="prior-card-eyebrow">
          {rtl ? "مقارنة بالتقييم السابق" : "vs prior assessment"}
        </span>
        {scoring.prior_engagement_name && (
          <span className="prior-card-name">{scoring.prior_engagement_name}</span>
        )}
      </div>
      <div className="prior-card-row">
        <div className="prior-card-side">
          <div className="prior-card-label">{rtl ? "السابق" : "Prior"}</div>
          <div className="prior-card-value">{scoring.prior_overall_others.toFixed(2)}</div>
        </div>
        <div className="prior-card-arrow">
          {tone === "up" ? "↑" : tone === "down" ? "↓" : "→"}
        </div>
        <div className="prior-card-side">
          <div className="prior-card-label">{rtl ? "الآن" : "Now"}</div>
          <div className="prior-card-value">{scoring.overall_others.toFixed(2)}</div>
        </div>
        <div className="prior-card-delta">
          {sign}{delta.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function PriorDeltaInline({
  prior,
  current,
  rtl,
}: {
  prior: number;
  current: number;
  rtl: boolean;
}) {
  const delta = current - prior;
  const sign = delta > 0 ? "+" : "";
  const tone = delta >= 0.2 ? "up" : delta <= -0.2 ? "down" : "flat";
  return (
    <span className={`prior-inline prior-inline-${tone}`}>
      <span className="kpi-inline-label">{rtl ? "مقابل السابق" : "vs prior"}</span>
      <span className="kpi-inline-value">
        {tone === "up" ? "↑" : tone === "down" ? "↓" : "→"} {sign}{delta.toFixed(2)}
      </span>
    </span>
  );
}


// ──────────────────────────────────────────────────────────────
// Tenure breakdown. Tiny strip on the Summary page that gives a
// one-line read on "how much do these raters actually know this
// person" - competitor reports surface this as small chips next
// to each verbatim and we follow the same pattern.
// ──────────────────────────────────────────────────────────────

function TenureBreakdownCard({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  const tb = scoring.tenure_breakdown;
  // Don't render the card if nobody answered - the field is optional.
  if (tb.answered === 0 && tb.unanswered === 0) return null;
  if (tb.answered === 0) return null;

  const rows: Array<{ key: keyof typeof tb.counts; label: string }> = [
    { key: "less_than_6mo", label: rtl ? "أقل من 6 أشهر" : "Less than 6 months" },
    { key: "six_mo_to_2yr", label: rtl ? "من 6 أشهر إلى سنتين" : "6 months – 2 years" },
    { key: "two_to_5yr", label: rtl ? "من سنتين إلى 5 سنوات" : "2 – 5 years" },
    { key: "over_5yr", label: rtl ? "أكثر من 5 سنوات" : "More than 5 years" },
  ];

  return (
    <>
      <h3>{rtl ? "مدة معرفة المقيّمين بك" : "How long raters have known you"}</h3>
      <div className="tenure-chips">
        {rows.map((r) => {
          const n = tb.counts[r.key];
          if (n === 0) return null;
          return (
            <span key={r.key} className="tenure-chip">
              <strong>{n}</strong> · {r.label}
            </span>
          );
        })}
        {tb.unanswered > 0 && (
          <span className="tenure-chip tenure-chip-muted">
            <strong>{tb.unanswered}</strong> ·{" "}
            {rtl ? "لم يجب على هذا السؤال" : "didn't answer"}
          </span>
        )}
      </div>
    </>
  );
}


// ──────────────────────────────────────────────────────────────
// Critical-competency alignment card. The single most-quoted
// coaching anchor from competitor 360s - shows the % overlap
// between Self's picks and the Manager's picks. When either side
// hasn't picked yet, we say so explicitly rather than rendering a
// misleading 0%.
// ──────────────────────────────────────────────────────────────

function CriticalAlignmentCard({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  const a = scoring.critical_alignment;

  if (!a.self_picked && !a.manager_picked) {
    return null;
  }

  const competencyName = (id: string): string => {
    const c = scoring.competencies.find((x) => x.competency_id === id);
    if (!c) return id.slice(0, 8);
    return rtl ? c.name_ar ?? c.name_en : c.name_en;
  };

  const onlyOnePicked = a.self_picked !== a.manager_picked;

  return (
    <div className="critical-card">
      <div className="critical-card-head">
        <h3 className="critical-card-title">
          {rtl ? "التوافق على الكفايات الحرجة" : "Critical-competency alignment"}
        </h3>
        <span className={`critical-card-pct critical-pct-${a.alignment_pct === null || a.alignment_pct >= 67 ? "high" : a.alignment_pct >= 34 ? "mid" : "low"}`}>
          {a.alignment_pct === null ? "-" : `${a.alignment_pct}%`}
        </span>
      </div>
      <p className="critical-card-lead">
        {onlyOnePicked
          ? rtl
            ? `${a.self_picked ? "أنت اخترت" : "اختار مديرك"} الكفايات الحرجة، لكن الجهة الأخرى لم تختر بعد. تابع معها لإكمال الصورة.`
            : `${a.self_picked ? "You've picked" : "Your manager has picked"} their critical competencies, but the other side hasn't yet. Follow up to complete the picture.`
          : rtl
            ? "تشير النسبة إلى مدى توافقك أنت ومديرك على أهم الكفايات لدورك. النسبة المنخفضة في حد ذاتها فرصة للحوار قبل أن تكون مشكلة."
            : "The percentage shows how much you and your manager agree on what's most critical for your role. A low alignment is a coaching opportunity, not a problem."}
      </p>
      <div className="critical-grid">
        <div className="critical-col">
          <div className="critical-col-head">
            {rtl ? "اختار كلاكما" : "Both picked"}{" "}
            <span className="critical-col-count">({a.both_picks.length})</span>
          </div>
          {a.both_picks.length === 0 ? (
            <em className="critical-empty">{rtl ? "لا يوجد" : "None"}</em>
          ) : (
            <ul className="critical-list">
              {a.both_picks.map((id) => (
                <li key={id}>{competencyName(id)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="critical-col">
          <div className="critical-col-head">
            {rtl ? "اخترت أنت فقط" : "Self only"}{" "}
            <span className="critical-col-count">
              ({a.self_picks.filter((id) => !a.manager_picks.includes(id)).length})
            </span>
          </div>
          {a.self_picks.filter((id) => !a.manager_picks.includes(id)).length === 0 ? (
            <em className="critical-empty">{rtl ? "لا يوجد" : "None"}</em>
          ) : (
            <ul className="critical-list">
              {a.self_picks
                .filter((id) => !a.manager_picks.includes(id))
                .map((id) => (
                  <li key={id}>{competencyName(id)}</li>
                ))}
            </ul>
          )}
        </div>
        <div className="critical-col">
          <div className="critical-col-head">
            {rtl ? "اختار المدير فقط" : "Manager only"}{" "}
            <span className="critical-col-count">
              ({a.manager_picks.filter((id) => !a.self_picks.includes(id)).length})
            </span>
          </div>
          {a.manager_picks.filter((id) => !a.self_picks.includes(id)).length === 0 ? (
            <em className="critical-empty">{rtl ? "لا يوجد" : "None"}</em>
          ) : (
            <ul className="critical-list">
              {a.manager_picks
                .filter((id) => !a.self_picks.includes(id))
                .map((id) => (
                  <li key={id}>{competencyName(id)}</li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────
// Reference Group Comparison (P3.2). For every competency, a
// horizontal 1–5 line with a coloured dot per rater group. Lets
// the reader scan misalignment patterns ("manager + peers low,
// direct reports high") in one page. Mirrors competitor pattern.
// ──────────────────────────────────────────────────────────────

const GROUP_LEGEND: Array<{ role: string; en: string; ar: string; color: string }> = [
  { role: "self", en: "Self", ar: "أنت", color: "#6D28D9" },
  { role: "manager", en: "Manager", ar: "المدير", color: "#B45309" },
  { role: "peer", en: "Peers", ar: "الزملاء", color: "#5391D5" },
  { role: "direct_report", en: "Direct reports", ar: "التقارير المباشرة", color: "#047857" },
  { role: "skip_level", en: "Skip-level", ar: "أعلى", color: "#9F1239" },
  { role: "other", en: "Other", ar: "أخرى", color: "#6B7280" },
];

function ReferenceGroupComparisonPage({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  return (
    <section className="page no-break-after">
      <h2>{rtl ? "مقارنة فئات المقيّمين" : "Reference group comparison"}</h2>
      <p className="lead">
        {rtl
          ? "كل كفاية على خط واحد. نقطة لكل فئة من المقيّمين. النقاط المتفرقة على نفس الخط تكشف اختلاف الإدراك بين الفئات بسرعة."
          : "Every competency on one line. One dot per rater group. Spread dots reveal differing perceptions across the groups at a glance."}
      </p>

      <div className="rgc-legend">
        {GROUP_LEGEND.map((g) => (
          <span key={g.role} className="rgc-legend-item">
            <span className="rgc-dot-swatch" style={{ background: g.color }} />
            {rtl ? g.ar : g.en}
          </span>
        ))}
      </div>

      <div className="rgc-axis">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="rgc-axis-tick">{n}</span>
        ))}
      </div>

      <div className="rgc-rows">
        {scoring.competencies.map((c) => (
          <div key={c.competency_id} className="rgc-row">
            <span className="rgc-label">{rtl ? c.name_ar ?? c.name_en : c.name_en}</span>
            <div className="rgc-track">
              {/* Favorable Zone band */}
              <span className="rgc-zone" />
              {/* Grid lines at 1..5 */}
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className="rgc-grid"
                  style={{ left: `${((n - 1) / 4) * 100}%` }}
                />
              ))}
              {c.by_group.map((g) => {
                if (g.mean === null) return null;
                const def = GROUP_LEGEND.find((x) => x.role === g.rater_role);
                if (!def) return null;
                const left = `${((g.mean - 1) / 4) * 100}%`;
                return (
                  <span
                    key={g.rater_role}
                    className="rgc-dot"
                    style={{ left, background: def.color }}
                    title={`${rtl ? def.ar : def.en}: ${g.mean.toFixed(2)}`}
                  >
                    <span className="rgc-dot-letter">
                      {(rtl ? def.ar : def.en).charAt(0)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Strengths & Development Summary (P3.3). Ranks every competency
// by Others-mean and splits into "Strengths" (within/above zone)
// and "Development areas" (below zone). When a competency is also
// flagged as role-critical (P1.5), it gets a "Critical Development
// Area!" tag - the single most impactful coaching signal.
// ──────────────────────────────────────────────────────────────

function StrengthsDevSummaryPage({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  const ZONE_LOW = 3.5;
  const criticalUnion = new Set([
    ...scoring.critical_alignment.self_picks,
    ...scoring.critical_alignment.manager_picks,
  ]);

  const ranked = scoring.competencies
    .filter((c) => c.others_mean !== null)
    .slice()
    .sort((a, b) => (b.others_mean ?? 0) - (a.others_mean ?? 0));

  const strengths = ranked.filter((c) => (c.others_mean ?? 0) >= ZONE_LOW);
  const dev = ranked.filter((c) => (c.others_mean ?? 0) < ZONE_LOW);

  return (
    <section className="page">
      <h2>{rtl ? "ملخّص نقاط القوة والتطوير" : "Strengths & Development Summary"}</h2>
      <p className="lead">
        {rtl
          ? "كل كفاية مرتّبة حسب رأي الآخرين. النطاق المرجعي يبدأ من 3.5. الكفايات الموسومة بـ «نقطة تطوير حرجة» اخترتموها أنت أو مديرك كحرجة وهي تحت النطاق - أعطها الأولوية في الخطة."
          : "Every competency ranked by Others' view. The Favorable Zone starts at 3.5. Anything flagged Critical Development Area was picked as role-critical by you or your manager AND is below the zone - prioritise these first in your plan."}
      </p>

      <h3 className="sds-strength-h">{rtl ? "نقاط القوة" : "Strengths"}</h3>
      {strengths.length === 0 ? (
        <p className="empty">{rtl ? "لم تُسجَّل بعد." : "None yet."}</p>
      ) : (
        <ul className="sds-list">
          {strengths.map((c) => (
            <li key={c.competency_id}>
              <span className="sds-name">
                {rtl ? c.name_ar ?? c.name_en : c.name_en}
                {criticalUnion.has(c.competency_id) && (
                  <span className="sds-critical-tag sds-critical-strength">
                    {rtl ? "كفاية حرجة" : "Critical Skill"}
                  </span>
                )}
              </span>
              <span className="sds-value">{fmtScore(c.others_mean)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="sds-dev-h">{rtl ? "مجالات التطوير" : "Development areas"}</h3>
      {dev.length === 0 ? (
        <p className="empty">{rtl ? "كل الكفايات في النطاق المرجعي أو أعلى." : "Every competency is within or above the Favorable Zone."}</p>
      ) : (
        <ul className="sds-list">
          {dev.map((c) => (
            <li key={c.competency_id}>
              <span className="sds-name">
                {rtl ? c.name_ar ?? c.name_en : c.name_en}
                {criticalUnion.has(c.competency_id) && (
                  <span className="sds-critical-tag sds-critical-dev">
                    {rtl ? "نقطة تطوير حرجة!" : "Critical Development Area!"}
                  </span>
                )}
              </span>
              <span className="sds-value">{fmtScore(c.others_mean)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Item-level detail - every behaviour with the per-rater-group
// breakdown that competitors put at the back of every report.
// Pages are chunked at ~12 rows per page so they always render
// at A4 without orphans.
// ──────────────────────────────────────────────────────────────

const RATER_GROUPS_FOR_TABLE: Array<{ role: string; en: string; ar: string }> = [
  { role: "self", en: "Self", ar: "أنت" },
  { role: "manager", en: "Mgr", ar: "المدير" },
  { role: "peer", en: "Peers", ar: "الزملاء" },
  { role: "direct_report", en: "DR", ar: "تقارير" },
  { role: "skip_level", en: "Skip", ar: "أعلى" },
  { role: "other", en: "Other", ar: "أخرى" },
];

function ItemLevelDetailPages({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  return (
    <section className="page no-break-after">
      <h2>{rtl ? "تفصيل السلوكيات" : "Item-level detail"}</h2>
      <p className="lead">
        {rtl
          ? "كل سلوك في الإطار مع متوسطه عند كل فئة من المقيّمين. الخلايا المخفية تعود إلى عتبة إخفاء الهوية. تشير علامة ⚠ إلى أن المقيّمين في تلك الفئة يختلفون بمقدار 3 درجات أو أكثر - اقرأ المتوسط بحذر."
          : "Every behaviour in the framework with its mean per rater group. Hidden cells fall under the anonymity threshold. A ⚠ flag means raters within that group disagree by 3+ points - read the mean with care."}
      </p>
      {scoring.competencies.map((c) => {
        const compBehs = scoring.behaviors.filter((b) => b.competency_id === c.competency_id);
        if (compBehs.length === 0) return null;
        return (
          <div key={c.competency_id} className="item-table-card">
            <h3>{rtl ? c.name_ar ?? c.name_en : c.name_en}</h3>
            <table className="item-table">
              <thead>
                <tr>
                  <th className="item-behavior">{rtl ? "السلوك" : "Behaviour"}</th>
                  {RATER_GROUPS_FOR_TABLE.map((g) => (
                    <th key={g.role} className="item-group">
                      {rtl ? g.ar : g.en}
                    </th>
                  ))}
                  <th className="item-group">{rtl ? "الفجوة" : "Gap"}</th>
                </tr>
              </thead>
              <tbody>
                {/* Return an array of <tr> per behavior (one main + one
                    optional comments row) instead of wrapping in a fragment.
                    Fragments inside <tbody> can corrupt table layout under
                    Puppeteer's strict table-parsing path - flagged by P3 audit. */}
                {compBehs.flatMap((b) => {
                  const rows = [
                    <tr key={b.behavior_id}>
                      <td className="item-behavior">
                        {rtl ? b.text_ar ?? b.text_en : b.text_en}
                      </td>
                      {RATER_GROUPS_FOR_TABLE.map((g) => {
                        const grp = b.by_group.find((x) => x.rater_role === g.role);
                        if (!grp || grp.rater_count === 0) {
                          return <td key={g.role} className="item-group dim">-</td>;
                        }
                        if (grp.hidden_by_anonymity) {
                          return <td key={g.role} className="item-group dim">·</td>;
                        }
                        const noConsensus = grp.spread !== null && grp.spread >= 3;
                        return (
                          <td key={g.role} className={noConsensus ? "item-group flag" : "item-group"}>
                            {fmtScore(grp.mean)}
                            {noConsensus && (
                              <span className="consensus-flag" title="raters disagree by 3+ points"> ⚠</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="item-group">
                        {b.gap === null
                          ? "-"
                          : b.gap > 0
                            ? `+${b.gap.toFixed(2)}`
                            : b.gap.toFixed(2)}
                      </td>
                    </tr>,
                  ];
                  if (b.comments.length > 0) {
                    rows.push(
                      <tr key={`${b.behavior_id}-comments`} className="item-comments-row">
                        <td colSpan={RATER_GROUPS_FOR_TABLE.length + 2} className="item-comments-cell">
                          <ul className="item-comments-list">
                            {b.comments.map((c, ci) => (
                              <li key={ci}>
                                <span className="item-comments-role">
                                  {roleLabelShort(c.rater_role, rtl)}
                                </span>
                                <span className="item-comments-text">
                                  &ldquo;{c.text}&rdquo;
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Verbatim Start / Stop / Continue. Groups verbatims by question
// (start/stop/continue), then within each by rater role. Self is
// always first so it bookends the participant's view.
// ──────────────────────────────────────────────────────────────

function VerbatimPage({
  scoring,
  rtl,
}: {
  scoring: ParticipantScoring;
  rtl: boolean;
}) {
  const SECTIONS: Array<{ kind: "start" | "stop" | "continue"; en: string; ar: string }> = [
    { kind: "start", en: "What raters say I should START", ar: "ما الذي ينبغي أن أبدأ به" },
    { kind: "stop", en: "What raters say I should STOP", ar: "ما الذي ينبغي أن أتوقّف عنه" },
    { kind: "continue", en: "What raters say I should CONTINUE", ar: "ما الذي ينبغي أن أستمر فيه" },
  ];

  const ROLE_ORDER: Record<string, number> = {
    self: 0,
    manager: 1,
    peer: 2,
    direct_report: 3,
    skip_level: 4,
    other: 5,
  };

  return (
    <section className="page">
      <h2>{rtl ? "بكلمات المقيّمين" : "In raters' own words"}</h2>
      <p className="lead">
        {rtl
          ? "تظهر هذه التعليقات كما كُتبت تمامًا. تُجمَّع التعليقات من فئة معيّنة (مثل الزملاء) فقط إذا أكمل عدد كافٍ من المقيّمين في تلك الفئة، بما يحترم سياسة إخفاء الهوية."
          : "Verbatims appear exactly as written. Comments from any non-self / non-manager group are only shown when the group meets the anonymity threshold."}
      </p>

      {SECTIONS.map((s) => {
        const items = scoring.open_responses
          .filter((v) => v.kind === s.kind)
          .slice()
          .sort((a, b) => (ROLE_ORDER[a.rater_role] ?? 99) - (ROLE_ORDER[b.rater_role] ?? 99));
        if (items.length === 0) {
          return (
            <div key={s.kind} className="verbatim-section">
              <h3>{rtl ? s.ar : s.en}</h3>
              <p className="empty">
                {rtl ? "لا توجد تعليقات في هذا القسم." : "No comments in this section."}
              </p>
            </div>
          );
        }
        return (
          <div key={s.kind} className="verbatim-section">
            <h3>{rtl ? s.ar : s.en}</h3>
            <ul className="verbatim-list">
              {items.map((v, i) => {
                const lang = detectVerbatimLanguage(v.text);
                const reportLang: "en" | "ar" = rtl ? "ar" : "en";
                // Only show the language chip when the verbatim language
                // doesn't match the report language - that's the case
                // where the consultant needs to be aware (and consider
                // translating during debrief).
                const showLangChip = lang !== "unknown" && lang !== reportLang;
                return (
                  <li key={`${s.kind}-${i}`} className="verbatim-item">
                    <span className="verbatim-role">
                      {roleLabelShort(v.rater_role, rtl)}
                      {v.tenure && (
                        <span className="verbatim-tenure">· {tenureLabelShort(v.tenure, rtl)}</span>
                      )}
                      {showLangChip && (
                        <span
                          className={`verbatim-lang verbatim-lang-${lang}`}
                          dir="ltr"
                        >
                          {lang === "ar" ? "AR" : "EN"}
                        </span>
                      )}
                    </span>
                    <span
                      className="verbatim-text"
                      dir={lang === "ar" ? "rtl" : lang === "en" ? "ltr" : undefined}
                    >
                      {v.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function fmtScore(v: number | null): string {
  if (v === null) return "-";
  return v.toFixed(2);
}

/**
 * Detect whether a verbatim is predominantly Arabic, predominantly
 * Latin/English, or neither. Counts characters in each Unicode block.
 * Returns "unknown" for short / mixed / non-text content so the caller
 * can decide not to render a chip.
 *
 * The Arabic block range U+0600–U+06FF covers all standard Arabic
 * letters; the Latin range U+0041–U+007A covers A–Z and a–z. We don't
 * try to be exhaustive about CJK / Cyrillic / etc - the only choice the
 * consultant is making is "do I need Arabic translation for this?".
 */
function detectVerbatimLanguage(text: string): "ar" | "en" | "unknown" {
  let arabic = 0;
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x0600 && cp <= 0x06FF) arabic += 1;
    else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) latin += 1;
  }
  const total = arabic + latin;
  if (total < 4) return "unknown";
  if (arabic / total >= 0.5) return "ar";
  if (latin / total >= 0.5) return "en";
  return "unknown";
}

function tenureLabelShort(t: string, rtl: boolean): string {
  const en: Record<string, string> = {
    less_than_6mo: "<6mo",
    six_mo_to_2yr: "6mo–2y",
    two_to_5yr: "2–5y",
    over_5yr: "5y+",
  };
  const ar: Record<string, string> = {
    less_than_6mo: "أقل من 6 أشهر",
    six_mo_to_2yr: "6 أشهر–سنتان",
    two_to_5yr: "سنتان–5 سنوات",
    over_5yr: "5 سنوات+",
  };
  return (rtl ? ar : en)[t] ?? t;
}

function roleLabelShort(role: string, rtl: boolean): string {
  const en: Record<string, string> = {
    self: "Self",
    manager: "Manager",
    peer: "Peers",
    direct_report: "Direct reports",
    skip_level: "Skip-level",
    other: "Other",
  };
  const ar: Record<string, string> = {
    self: "أنت",
    manager: "المدير",
    peer: "الزملاء",
    direct_report: "التقارير المباشرة",
    skip_level: "القائد الأعلى",
    other: "أخرى",
  };
  return (rtl ? ar : en)[role] ?? role;
}


// ──────────────────────────────────────────────────────────────
// Print CSS - single source of truth so Puppeteer renders identically
// across light themes. Mirrors VIFM Primary Blue + Accent Blue.
// ──────────────────────────────────────────────────────────────

const REPORT_CSS = `
:root {
  --vifm-primary: #010131;
  --vifm-accent: #5391D5;
  --vifm-dark: #111232;
  --vifm-muted: #5A5A6A;
  --vifm-soft: #F4F6FB;
  --vifm-border: #E5EAF2;
  --tone-strength: #047857;
  --tone-develop: #B45309;
  --tone-blind: #9F1239;
  --tone-hidden: #6D28D9;
}
@page { size: A4; margin: 16mm 14mm 14mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.reflect-pdf {
  font-family: "Open Sans", "Segoe UI", Arial, sans-serif;
  color: var(--vifm-dark);
  font-size: 11pt;
  line-height: 1.5;
}
.reflect-pdf.bare nav, .reflect-pdf.bare aside, .reflect-pdf.bare header.app { display: none !important; }
/* Suppress Next.js dev tools / error overlay for clean PDF capture */
body > nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }
.page {
  page-break-after: always;
  break-after: page;
  padding: 8mm 4mm 0;
}
.page:last-child { page-break-after: auto; break-after: auto; }
.no-break-after { page-break-after: auto !important; break-after: auto !important; }
h1 { color: var(--vifm-primary); font-size: 26pt; font-weight: 700; margin: 0 0 4mm; line-height: 1.15; }
h2 { color: var(--vifm-primary); font-size: 18pt; font-weight: 700; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 1.2pt solid var(--vifm-accent); }
h3 { color: var(--vifm-primary); font-size: 12pt; font-weight: 700; margin: 4mm 0 2mm; }
h4 { color: var(--vifm-primary); font-size: 11pt; font-weight: 700; margin: 3mm 0 1mm; }
.eyebrow { color: var(--vifm-accent); font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4mm; font-weight: 600; }
.lead { color: var(--vifm-muted); font-size: 10.5pt; margin: 0 0 6mm; }

/* Cover */
.cover { padding: 0; position: relative; min-height: 260mm; }
.brand-stripe { height: 28mm; background: linear-gradient(135deg, var(--vifm-primary), var(--vifm-accent)); }
.cover-inner { padding: 14mm 14mm 0; }
.role-title { color: var(--vifm-muted); font-size: 12pt; margin-bottom: 12mm; }
.cover-meta { display: grid; grid-template-columns: 38mm 1fr; row-gap: 2mm; column-gap: 4mm; margin-bottom: 14mm; }
.cover-meta dt { color: var(--vifm-muted); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; }
.cover-meta dd { margin: 0; font-size: 11pt; color: var(--vifm-dark); }
.confidentiality { background: var(--vifm-soft); border-radius: 3mm; padding: 4mm 5mm; color: var(--vifm-muted); font-size: 9.5pt; border-left: 3pt solid var(--vifm-accent); }

/* Scale grid */
.scale-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 8mm; margin-bottom: 6mm; }
.scale-row { display: flex; align-items: center; gap: 3mm; }
.scale-num { display: inline-flex; align-items: center; justify-content: center; width: 7mm; height: 7mm; border-radius: 50%; background: var(--vifm-soft); color: var(--vifm-primary); font-weight: 700; font-size: 10pt; }
.scale-label { color: var(--vifm-dark); }
.rater-groups { margin: 2mm 0 4mm; padding-left: 6mm; }
.rater-groups li { margin-bottom: 1.5mm; }
.callout { background: #FFF7E6; border-left: 3pt solid #D97706; padding: 3mm 4mm; border-radius: 2mm; color: #92400E; font-size: 9.5pt; }

/* Summary */
.summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3mm; margin-bottom: 6mm; }
.kpi { border: 1px solid var(--vifm-border); border-radius: 2.5mm; padding: 3.5mm; }
.kpi-label { color: var(--vifm-muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { color: var(--vifm-primary); font-size: 22pt; font-weight: 700; line-height: 1.05; margin-top: 1.5mm; }
.kpi-sub { color: var(--vifm-muted); font-size: 8.5pt; margin-top: 1mm; }

/* Group table */
.group-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.group-table th { background: var(--vifm-soft); color: var(--vifm-primary); padding: 2.5mm 3mm; text-align: left; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
.group-table td { padding: 2.5mm 3mm; border-bottom: 0.6pt solid var(--vifm-border); }
.group-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.group-table tr:last-child td { border-bottom: 0; }

/* Behavior lists */
.tone-strength h2 { border-bottom-color: var(--tone-strength); }
.tone-develop h2 { border-bottom-color: var(--tone-develop); }
.tone-blind h2 { border-bottom-color: var(--tone-blind); }
.tone-hidden h2 { border-bottom-color: var(--tone-hidden); }
.behavior-list { padding: 0; margin: 0; list-style: none; counter-reset: blist; }
.behavior-list li { padding: 3mm 0; border-bottom: 0.6pt solid var(--vifm-border); }
.behavior-list li:last-child { border-bottom: 0; }
.behavior-rank { display: inline-flex; align-items: center; justify-content: center; width: 6mm; height: 6mm; border-radius: 50%; background: var(--vifm-soft); color: var(--vifm-primary); font-size: 9pt; font-weight: 700; margin-right: 3mm; }
.behavior-text { font-size: 10.5pt; color: var(--vifm-dark); display: flex; align-items: flex-start; gap: 1mm; }
.behavior-meta { color: var(--vifm-muted); font-size: 9pt; margin-top: 1.5mm; padding-left: 9mm; display: flex; gap: 6mm; flex-wrap: wrap; }
/* P3.4 AI development tip */
.behavior-tip { margin: 2mm 0 0 9mm; padding: 3mm 4mm; border-left: 2.5pt solid var(--tone-develop); background: #FFFBEB; border-radius: 2mm; page-break-inside: avoid; }
.behavior-tip-label { display: block; font-size: 7.5pt; font-weight: 700; color: var(--tone-develop); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 1mm; }
.behavior-tip-text { margin: 0; color: var(--vifm-dark); font-size: 10pt; line-height: 1.5; }
.reflect-pdf[dir="rtl"] .behavior-tip { margin-left: 0; margin-right: 9mm; border-left: 0; border-right: 2.5pt solid var(--tone-develop); }
.empty { color: var(--vifm-muted); font-style: italic; }

/* Per-competency */
.comp-card { border: 1px solid var(--vifm-border); border-radius: 2.5mm; padding: 4mm; margin-bottom: 4mm; page-break-inside: avoid; }
.comp-row { display: flex; gap: 6mm; margin: 2mm 0; }
.kpi-inline { display: inline-flex; gap: 1.5mm; align-items: baseline; font-size: 10pt; }
.kpi-inline-label { color: var(--vifm-muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
.kpi-inline-value { font-weight: 700; color: var(--vifm-primary); font-variant-numeric: tabular-nums; }
.group-bars { display: grid; gap: 1.5mm; margin-top: 2mm; }
.group-bar-row { display: grid; grid-template-columns: 28mm 1fr 12mm; gap: 3mm; align-items: center; font-size: 9pt; }
.group-bar-label { color: var(--vifm-muted); }
.group-bar-track { height: 3mm; background: var(--vifm-soft); border-radius: 1.5mm; overflow: hidden; position: relative; }
.group-bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--vifm-accent), var(--vifm-primary)); position: relative; z-index: 1; }
/* Favorable Zone overlay: 3.5–4.25 on 0–5 scale = 70%–85% of track. Sits
   under the score fill so the fill still reads clearly. */
.favorable-zone { position: absolute; top: 0; bottom: 0; left: 70%; width: 15%; background: rgba(217, 119, 6, 0.18); border-left: 0.4pt dashed rgba(217, 119, 6, 0.55); border-right: 0.4pt dashed rgba(217, 119, 6, 0.55); z-index: 0; }
.favorable-zone-legend { display: flex; gap: 4mm; align-items: center; font-size: 9.5pt; color: var(--vifm-muted); background: var(--vifm-soft); padding: 3mm 4mm; border-radius: 2mm; margin-top: 2mm; }
.favorable-zone-swatch { display: inline-block; width: 14mm; height: 5mm; background: rgba(217, 119, 6, 0.18); border-left: 0.6pt dashed rgba(217, 119, 6, 0.7); border-right: 0.6pt dashed rgba(217, 119, 6, 0.7); border-radius: 1mm; flex-shrink: 0; }
.reflect-pdf[dir="rtl"] .favorable-zone { left: auto; right: 70%; }
.group-bar-value { text-align: right; font-variant-numeric: tabular-nums; color: var(--vifm-dark); }
.group-bar-hidden { color: var(--vifm-muted); font-size: 8pt; padding: 0 2mm; }

/* Recommended programmes */
.programme-list { padding: 0; margin: 0; list-style: none; }
.programme-list > li { padding: 4mm 0; border-bottom: 0.6pt solid var(--vifm-border); page-break-inside: avoid; }
.programme-list > li:last-child { border-bottom: 0; }
.programme-head { display: flex; align-items: baseline; gap: 3mm; flex-wrap: wrap; }
.programme-rank { display: inline-flex; align-items: center; justify-content: center; width: 6mm; height: 6mm; border-radius: 50%; background: var(--vifm-soft); color: var(--vifm-primary); font-size: 9pt; font-weight: 700; }
.programme-title { font-size: 11.5pt; font-weight: 700; color: var(--vifm-primary); }
.programme-fit { display: inline-block; font-size: 8pt; font-weight: 700; color: #047857; background: #D1FAE5; border: 0.6pt solid #6EE7B7; padding: 0.5mm 2mm; border-radius: 6mm; letter-spacing: 0.04em; }
.programme-meta { display: flex; gap: 4mm; flex-wrap: wrap; color: var(--vifm-muted); font-size: 9pt; margin: 1.5mm 0 2mm 9mm; text-transform: capitalize; }
.programme-drivers { display: flex; gap: 2mm; flex-wrap: wrap; margin-left: 9mm; }
.programme-driver-chip { display: inline-block; background: var(--vifm-soft); color: var(--vifm-primary); padding: 0.6mm 2.4mm; border-radius: 3mm; font-size: 9pt; }
.programme-driver-math { color: var(--vifm-muted); font-size: 8.5pt; }
.programme-rationale { margin: 2mm 0 0 9mm; color: var(--vifm-muted); font-size: 9pt; font-style: italic; }
.programme-cta { margin: 2.5mm 0 0 9mm; }
.programme-cta-link { color: var(--vifm-accent); font-size: 9.5pt; font-weight: 600; text-decoration: none; }
.unmapped-detail { margin-top: 2mm; color: var(--vifm-muted); font-size: 9pt; }

/* IDP - K-S-S frame */
.idp { padding-left: 5mm; margin: 0; list-style: none; }
.idp li { padding: 3mm 0 4mm; border-bottom: 0.6pt solid var(--vifm-border); page-break-inside: avoid; }
.idp li:last-child { border-bottom: 0; }
.idp h4 { display: flex; align-items: center; gap: 3mm; margin: 1mm 0 0.5mm; }
.kss-tag { display: inline-block; font-size: 8pt; font-weight: 700; padding: 0.6mm 2.4mm; border-radius: 4mm; letter-spacing: 0.06em; text-transform: uppercase; line-height: 1; }
.kss-keep { background: #D1FAE5; color: #047857; border: 0.5pt solid #6EE7B7; }
.kss-stop { background: #FEE2E2; color: #9F1239; border: 0.5pt solid #FCA5A5; }
.kss-start { background: #EDE9FE; color: #6D28D9; border: 0.5pt solid #C4B5FD; }
.kss-caption { color: var(--vifm-muted); font-size: 9pt; margin: 0 0 2mm; font-style: italic; }
.idp-row { display: flex; gap: 4mm; align-items: baseline; margin: 2mm 0; }
.idp-row > span:first-child { color: var(--vifm-muted); font-size: 9pt; min-width: 42mm; }
.idp-line { flex: 1; border-bottom: 0.6pt solid var(--vifm-border); height: 5mm; }

/* P3.1 Cover wheel - Self vs Others polygons on a polar plot */
.cover-wheel-wrap { margin-top: 12mm; padding: 4mm; background: white; border: 1px solid var(--vifm-border); border-radius: 3mm; max-width: 110mm; }
.cover-wheel { display: block; }
.cover-wheel-legend { display: flex; flex-wrap: wrap; gap: 4mm; justify-content: center; margin-top: 2mm; font-size: 8.5pt; color: var(--vifm-muted); }
.cover-wheel-legend-item { display: inline-flex; align-items: center; gap: 1.5mm; }
.cover-wheel-swatch { display: inline-block; width: 5mm; height: 2.5mm; border-radius: 0.5mm; }
.cover-wheel-swatch-self { background: rgba(109, 40, 217, 0.18); border: 0.6pt dashed #6D28D9; }
.cover-wheel-swatch-others { background: rgba(83, 145, 213, 0.20); border: 0.6pt solid #5391D5; }
.cover-wheel-swatch-zone { background: rgba(217, 119, 6, 0.20); border: 0.4pt solid rgba(217, 119, 6, 0.5); }

/* P2 reassessment - prior delta card + inline */
.prior-card { display: flex; flex-direction: column; gap: 2mm; padding: 4mm 5mm; margin: 3mm 0 5mm; border-radius: 2.5mm; border: 1px solid var(--vifm-border); }
.prior-card-up { background: linear-gradient(180deg, #ECFDF5 0%, #D1FAE5 100%); border-color: #6EE7B7; }
.prior-card-down { background: linear-gradient(180deg, #FEF2F2 0%, #FEE2E2 100%); border-color: #FCA5A5; }
.prior-card-flat { background: var(--vifm-soft); }
.prior-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; flex-wrap: wrap; }
.prior-card-eyebrow { color: var(--vifm-muted); font-size: 8.5pt; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
.prior-card-name { color: var(--vifm-muted); font-size: 9pt; font-style: italic; }
.prior-card-row { display: flex; align-items: center; gap: 4mm; }
.prior-card-side { display: flex; flex-direction: column; gap: 0.5mm; min-width: 14mm; }
.prior-card-label { color: var(--vifm-muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
.prior-card-value { color: var(--vifm-dark); font-size: 18pt; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.prior-card-arrow { color: var(--vifm-muted); font-size: 16pt; font-weight: 700; padding: 0 1mm; }
.prior-card-up .prior-card-arrow { color: #047857; }
.prior-card-down .prior-card-arrow { color: #9F1239; }
.prior-card-delta { margin-left: auto; font-size: 14pt; font-weight: 700; font-variant-numeric: tabular-nums; padding: 1mm 3mm; border-radius: 4mm; }
.prior-card-up .prior-card-delta { color: #047857; background: rgba(255,255,255,0.6); }
.prior-card-down .prior-card-delta { color: #9F1239; background: rgba(255,255,255,0.6); }
.prior-card-flat .prior-card-delta { color: var(--vifm-muted); background: white; }
.prior-inline { display: inline-flex; gap: 1.5mm; align-items: baseline; font-size: 10pt; padding: 0.4mm 2mm; border-radius: 3mm; }
.prior-inline-up { background: #D1FAE5; }
.prior-inline-up .kpi-inline-value { color: #047857; }
.prior-inline-down { background: #FEE2E2; }
.prior-inline-down .kpi-inline-value { color: #9F1239; }
.prior-inline-flat { background: var(--vifm-soft); }
.reflect-pdf[dir="rtl"] .prior-card-delta { margin-left: 0; margin-right: auto; }

/* Critical-competency alignment card */
.critical-card { border: 1px solid var(--vifm-border); border-radius: 2.5mm; padding: 4mm 5mm; margin: 4mm 0 6mm; background: var(--vifm-soft); page-break-inside: avoid; }
.critical-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; flex-wrap: wrap; }
.critical-card-title { margin: 0; color: var(--vifm-primary); font-size: 12pt; font-weight: 700; border-bottom: 0; padding: 0; }
.critical-card-pct { font-size: 18pt; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; padding: 0.6mm 3mm; border-radius: 4mm; }
.critical-pct-high { color: #047857; background: #D1FAE5; border: 0.5pt solid #6EE7B7; }
.critical-pct-mid { color: #B45309; background: #FEF3C7; border: 0.5pt solid #FCD34D; }
.critical-pct-low { color: #9F1239; background: #FEE2E2; border: 0.5pt solid #FCA5A5; }
.critical-card-lead { color: var(--vifm-muted); font-size: 9.5pt; margin: 2mm 0 4mm; line-height: 1.5; }
.critical-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; }
.critical-col-head { font-size: 9pt; font-weight: 600; color: var(--vifm-primary); margin-bottom: 1.5mm; text-transform: uppercase; letter-spacing: 0.05em; }
.critical-col-count { font-weight: 500; color: var(--vifm-muted); font-variant-numeric: tabular-nums; }
.critical-list { list-style: none; padding: 0; margin: 0; }
.critical-list li { font-size: 9.5pt; color: var(--vifm-dark); padding: 1.2mm 0; border-bottom: 0.4pt dotted var(--vifm-border); }
.critical-list li:last-child { border-bottom: 0; }
.critical-empty { color: var(--vifm-muted); font-style: italic; font-size: 9.5pt; }

/* Critical pill on per-competency cards */
.critical-pill { display: inline-block; margin-left: 3mm; font-size: 8pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 4mm; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; vertical-align: middle; }
.critical-both { color: #047857; background: #D1FAE5; border: 0.5pt solid #6EE7B7; }
.critical-self { color: #6D28D9; background: #EDE9FE; border: 0.5pt solid #C4B5FD; }
.critical-mgr { color: #B45309; background: #FEF3C7; border: 0.5pt solid #FCD34D; }
.reflect-pdf[dir="rtl"] .critical-pill { margin-left: 0; margin-right: 3mm; }

/* P3.2 Reference Group Comparison */
.rgc-legend { display: flex; flex-wrap: wrap; gap: 4mm; margin-bottom: 4mm; font-size: 9pt; color: var(--vifm-muted); padding: 2.5mm 4mm; background: var(--vifm-soft); border-radius: 2mm; }
.rgc-legend-item { display: inline-flex; align-items: center; gap: 1.5mm; }
.rgc-dot-swatch { display: inline-block; width: 3mm; height: 3mm; border-radius: 50%; }
.rgc-axis { display: flex; justify-content: space-between; margin: 0 0 1mm 65mm; font-size: 8.5pt; color: var(--vifm-muted); font-variant-numeric: tabular-nums; }
.rgc-axis-tick { width: 0; }
.rgc-rows { display: grid; gap: 1.5mm; }
.rgc-row { display: grid; grid-template-columns: 60mm 1fr; gap: 5mm; align-items: center; }
.rgc-label { font-size: 9.5pt; color: var(--vifm-dark); }
.rgc-track { position: relative; height: 6mm; background: var(--vifm-soft); border-radius: 1mm; }
.rgc-zone { position: absolute; top: 0; bottom: 0; left: 62.5%; width: 18.75%; background: rgba(217, 119, 6, 0.15); }
.rgc-grid { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.4pt solid var(--vifm-border); }
.rgc-dot { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 5mm; height: 5mm; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 0.5pt white; }
.rgc-dot-letter { color: white; font-size: 6.5pt; font-weight: 700; line-height: 1; }
.reflect-pdf[dir="rtl"] .rgc-zone { left: auto; right: 62.5%; }

/* P3.3 Strengths & Development Summary */
.sds-strength-h { border-bottom: 0.6pt solid #047857; color: #047857; padding-bottom: 1mm; }
.sds-dev-h { border-bottom: 0.6pt solid #B45309; color: #B45309; padding-bottom: 1mm; }
.sds-list { list-style: none; padding: 0; margin: 0 0 4mm; }
.sds-list li { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; padding: 2.5mm 0; border-bottom: 0.5pt solid var(--vifm-border); }
.sds-list li:last-child { border-bottom: 0; }
.sds-name { color: var(--vifm-dark); font-size: 10.5pt; }
.sds-value { color: var(--vifm-primary); font-weight: 700; font-variant-numeric: tabular-nums; font-size: 11pt; }
.sds-critical-tag { display: inline-block; margin-left: 3mm; font-size: 8pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 4mm; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; vertical-align: middle; }
.sds-critical-strength { color: #047857; background: #D1FAE5; border: 0.5pt solid #6EE7B7; }
.sds-critical-dev { color: #9F1239; background: #FEE2E2; border: 0.5pt solid #FCA5A5; }
.reflect-pdf[dir="rtl"] .sds-critical-tag { margin-left: 0; margin-right: 3mm; }

/* Item-level table */
.item-table-card { margin-bottom: 4mm; page-break-inside: avoid; }
.item-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 1.5mm; }
.item-table th { background: var(--vifm-soft); color: var(--vifm-primary); padding: 1.5mm 2mm; text-align: center; font-weight: 600; font-size: 8.5pt; }
.item-table th.item-behavior { text-align: left; }
.item-table td { padding: 1.8mm 2mm; border-bottom: 0.5pt solid var(--vifm-border); text-align: center; font-variant-numeric: tabular-nums; }
.item-table td.item-behavior { text-align: left; color: var(--vifm-dark); font-size: 9.5pt; line-height: 1.35; }
.item-table td.dim { color: var(--vifm-muted); }
.item-table td.flag { background: rgba(217, 119, 6, 0.08); color: var(--vifm-dark); }
.item-table .consensus-flag { color: #B45309; font-weight: 700; font-size: 8.5pt; }
.item-table tr:last-child td { border-bottom: 0; }
/* P4.2 per-behavior comments row */
.item-comments-row td { background: var(--vifm-soft); padding: 2mm 4mm; border-bottom: 0.5pt solid var(--vifm-border); }
.item-comments-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 1mm; }
.item-comments-list li { display: grid; grid-template-columns: 22mm 1fr; gap: 3mm; align-items: baseline; }
.item-comments-role { color: var(--vifm-accent); font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.item-comments-text { color: var(--vifm-dark); font-size: 9pt; line-height: 1.4; font-style: italic; }

/* Verbatim Start/Stop/Continue */
.verbatim-section { margin-bottom: 5mm; page-break-inside: avoid; }
.verbatim-list { list-style: none; padding: 0; margin: 0; }
.verbatim-item { padding: 2.5mm 0; border-bottom: 0.5pt solid var(--vifm-border); display: grid; grid-template-columns: 28mm 1fr; gap: 4mm; align-items: baseline; }
.verbatim-item:last-child { border-bottom: 0; }
.verbatim-role { color: var(--vifm-muted); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; display: flex; flex-direction: column; gap: 1mm; }
.verbatim-tenure { color: var(--vifm-muted); font-size: 8pt; font-weight: 500; text-transform: none; letter-spacing: 0; opacity: 0.85; }
.verbatim-lang { display: inline-block; align-self: flex-start; margin-top: 0.5mm; font-size: 7.5pt; font-weight: 700; padding: 0.3mm 1.5mm; border-radius: 3mm; letter-spacing: 0.06em; text-transform: uppercase; }
.verbatim-lang-ar { background: #FEF3C7; color: #92400E; border: 0.4pt solid #FCD34D; }
.verbatim-lang-en { background: #DBEAFE; color: #1E40AF; border: 0.4pt solid #93C5FD; }
.verbatim-text { color: var(--vifm-dark); font-size: 10.5pt; line-height: 1.45; white-space: pre-wrap; }

/* Tenure chips on Summary page */
.tenure-chips { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 2mm; }
.tenure-chip { display: inline-flex; align-items: center; gap: 1mm; background: var(--vifm-soft); border: 0.5pt solid var(--vifm-border); border-radius: 3mm; padding: 1.2mm 3mm; font-size: 9pt; color: var(--vifm-dark); }
.tenure-chip strong { color: var(--vifm-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
.tenure-chip-muted { background: transparent; color: var(--vifm-muted); border-style: dashed; }

/* RTL */
.reflect-pdf[dir="rtl"] .item-table th.item-behavior { text-align: right; }
.reflect-pdf[dir="rtl"] .item-table td.item-behavior { text-align: right; }
.reflect-pdf[dir="rtl"] .behavior-rank { margin-right: 0; margin-left: 3mm; }
.reflect-pdf[dir="rtl"] .programme-meta { margin-left: 0; margin-right: 9mm; }
.reflect-pdf[dir="rtl"] .programme-drivers { margin-left: 0; margin-right: 9mm; }
.reflect-pdf[dir="rtl"] .programme-rationale { margin-left: 0; margin-right: 9mm; }
.reflect-pdf[dir="rtl"] .programme-cta { margin-left: 0; margin-right: 9mm; }
.reflect-pdf[dir="rtl"] .behavior-meta { padding-left: 0; padding-right: 9mm; }
.reflect-pdf[dir="rtl"] .group-bar-value { text-align: left; }
.reflect-pdf[dir="rtl"] .confidentiality { border-left: 0; border-right: 3pt solid var(--vifm-accent); }
.reflect-pdf[dir="rtl"] .rater-groups { padding-left: 0; padding-right: 6mm; }
.reflect-pdf[dir="rtl"] .idp { padding-left: 0; padding-right: 5mm; }
.reflect-pdf[dir="rtl"] .group-table td.num { text-align: left; }
`;
