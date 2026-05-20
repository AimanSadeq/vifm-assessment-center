import { notFound } from "next/navigation";
import { computeParticipantScoring, type ParticipantScoring } from "@/lib/reflect/scoring";
import {
  recommendCoursesForReflectParticipant,
  HIGH_FIT_THRESHOLD,
  type RecommendedCourse,
} from "@/lib/recommender/courses";

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

  // Course recommendations — best-effort. If the framework competency names
  // don't match the AC catalogue we silently fall back to an empty list and
  // the recommendation page renders a placeholder.
  const recPayload = await recommendCoursesForReflectParticipant({
    participantId: id,
    limit: 5,
  });

  const bare = sp.bare === "1";
  const lang: "en" | "ar" | "bilingual" =
    sp.lang === "ar" ? "ar" : sp.lang === "bilingual" ? "bilingual" : "en";

  return (
    <ReportBody
      scoring={scoring}
      recommendations={recPayload.recommendations}
      unmappedCompetencies={recPayload.unmapped}
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
  lang,
  bare,
}: {
  scoring: ParticipantScoring;
  recommendations: RecommendedCourse[];
  unmappedCompetencies: string[];
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
          <div className="eyebrow">{showAr ? "VIFM Reflect · 360° Leadership Feedback" : "VIFM Reflect · 360° Leadership Feedback"}</div>
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
              ? "سرّي — للاستخدام التطويري الفردي فقط. لا يُستخدم لأغراض الاختيار أو الترقية."
              : "Confidential — for personal development use only. Not to be used for selection or promotion decisions."}
          </div>
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
          <li><strong>{rtl ? "أنت" : "Self"}</strong> — {rtl ? "تقييمك الذاتي" : "your own self-assessment"}</li>
          <li><strong>{rtl ? "المدير المباشر" : "Manager"}</strong> — {rtl ? "تقييم مديرك المباشر" : "your line manager's view"}</li>
          <li><strong>{rtl ? "الزملاء" : "Peers"}</strong> — {rtl ? "متوسط آراء زملائك" : "the pooled view of your peers"}</li>
          <li><strong>{rtl ? "التقارير المباشرة" : "Direct reports"}</strong> — {rtl ? "متوسط آراء من يعملون معك مباشرة" : "the pooled view of those who report to you"}</li>
        </ul>
        <div className="callout">
          {rtl
            ? `تظل آراء الزملاء والتقارير المباشرة مجهولة الهوية: لا يُكشف أي متوسط لفئة معينة إلا إذا أكمل ${scoring.anonymity_min_n} مقيّمين على الأقل في تلك الفئة.`
            : `Peer and direct-report responses are anonymised: no group score is shown until at least ${scoring.anonymity_min_n} raters in that group have responded.`}
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
            value={scoring.overall_gap !== null ? (scoring.overall_gap > 0 ? `+${scoring.overall_gap.toFixed(2)}` : scoring.overall_gap.toFixed(2)) : "—"}
            sub={rtl ? "أنت ↔ الآخرون" : "Self ↔ Others"}
          />
        </div>

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
      </section>

      {/* Strengths */}
      <BehaviorListPage
        title={rtl ? "نقاط القوة" : "Strengths"}
        subtitle={rtl ? "أعلى 5 سلوكيات حسب رأي الآخرين" : "Top 5 behaviours by Others' mean"}
        behaviors={scoring.strengths}
        rtl={rtl}
        tone="strength"
      />

      {/* Development areas */}
      <BehaviorListPage
        title={rtl ? "مجالات التطوير" : "Development areas"}
        subtitle={rtl ? "أقل 5 سلوكيات حسب رأي الآخرين" : "Bottom 5 behaviours by Others' mean"}
        behaviors={scoring.development_areas}
        rtl={rtl}
        tone="develop"
      />

      {/* Blind spots */}
      <BehaviorListPage
        title={rtl ? "النقاط العمياء" : "Blind spots"}
        subtitle={
          rtl
            ? "السلوكيات التي تقيّمها أعلى مما يقيّمها الآخرون — فرصة لزيادة الوعي الذاتي"
            : "Behaviours where you rate yourself higher than others — an opportunity to raise self-awareness"
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
            ? "السلوكيات التي يقيّمها الآخرون أعلى مما تقيّمها بنفسك — لا تقلّل من قدرتك"
            : "Behaviours where others rate you higher than you rate yourself — don't undersell these"
        }
        behaviors={scoring.hidden_strengths}
        rtl={rtl}
        tone="hidden"
      />

      {/* Per-competency detail */}
      <section className="page no-break-after">
        <h2>{rtl ? "تفاصيل حسب الكفاية" : "Per-competency detail"}</h2>
        {scoring.competencies.map((c) => (
          <div key={c.competency_id} className="comp-card">
            <h3>{rtl ? c.name_ar ?? c.name_en : c.name_en}</h3>
            <div className="comp-row">
              <KpiInline label={rtl ? "أنت" : "Self"} value={fmtScore(c.self_mean)} />
              <KpiInline label={rtl ? "الآخرون" : "Others"} value={fmtScore(c.others_mean)} />
              <KpiInline
                label={rtl ? "الفجوة" : "Gap"}
                value={c.gap !== null ? (c.gap > 0 ? `+${c.gap.toFixed(2)}` : c.gap.toFixed(2)) : "—"}
              />
            </div>
            <div className="group-bars">
              {c.by_group.filter((g) => g.rater_count > 0).map((g) => (
                <div key={g.rater_role} className="group-bar-row">
                  <span className="group-bar-label">{roleLabelShort(g.rater_role, rtl)}</span>
                  <span className="group-bar-track">
                    {g.hidden_by_anonymity ? (
                      <em className="group-bar-hidden">{rtl ? "إخفاء الهوية" : "Anonymised"}</em>
                    ) : (
                      <span className="group-bar-fill" style={{ width: `${((g.mean ?? 0) / 5) * 100}%` }} />
                    )}
                  </span>
                  <span className="group-bar-value">{g.hidden_by_anonymity ? "—" : fmtScore(g.mean)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

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

      {/* IDP scaffold */}
      <section className="page">
        <h2>{rtl ? "خطة التطوير الفردية" : "Your Individual Development Plan"}</h2>
        <p className="lead">
          {rtl
            ? "استخدم هذا الإطار خلال جلسة الاستخلاص مع مستشار VIFM. ستحدّدون معًا الأولويات الثلاث الأهم بناءً على ما قرأته أعلاه."
            : "Use this scaffold during your debrief session with a VIFM coach. Together you'll lock in your top three development priorities based on what you've read above."}
        </p>
        <ol className="idp">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <h4>{rtl ? `الأولوية ${n}` : `Priority ${n}`}</h4>
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
}) {
  return (
    <section className={`page tone-${tone}`}>
      <h2>{title}</h2>
      <div className="lead">{subtitle}</div>
      {behaviors.length === 0 ? (
        <p className="empty">{rtl ? "لا توجد عناصر في هذه القائمة." : "Nothing in this list."}</p>
      ) : (
        <ol className="behavior-list">
          {behaviors.map((b, i) => (
            <li key={b.behavior_id}>
              <div className="behavior-text">
                <span className="behavior-rank">{i + 1}</span>
                {rtl ? b.text_ar ?? b.text_en : b.text_en}
              </div>
              <div className="behavior-meta">
                <span><strong>{rtl ? "أنت" : "Self"}:</strong> {fmtScore(b.self_score)}</span>
                <span><strong>{rtl ? "الآخرون" : "Others"}:</strong> {fmtScore(b.others_mean)}</span>
                <span><strong>{rtl ? "الفجوة" : "Gap"}:</strong> {b.gap !== null ? (b.gap > 0 ? `+${b.gap.toFixed(2)}` : b.gap.toFixed(2)) : "—"}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}


// ──────────────────────────────────────────────────────────────
// Item-level detail — every behaviour with the per-rater-group
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
          ? "كل سلوك في الإطار مع متوسطه عند كل فئة من المقيّمين. الخلايا المخفية تعود إلى عتبة إخفاء الهوية."
          : "Every behaviour in the framework with its mean per rater group. Hidden cells fall under the anonymity threshold."}
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
                {compBehs.map((b) => (
                  <tr key={b.behavior_id}>
                    <td className="item-behavior">
                      {rtl ? b.text_ar ?? b.text_en : b.text_en}
                    </td>
                    {RATER_GROUPS_FOR_TABLE.map((g) => {
                      const grp = b.by_group.find((x) => x.rater_role === g.role);
                      if (!grp || grp.rater_count === 0) {
                        return <td key={g.role} className="item-group dim">—</td>;
                      }
                      if (grp.hidden_by_anonymity) {
                        return <td key={g.role} className="item-group dim">·</td>;
                      }
                      return (
                        <td key={g.role} className="item-group">
                          {fmtScore(grp.mean)}
                        </td>
                      );
                    })}
                    <td className="item-group">
                      {b.gap === null
                        ? "—"
                        : b.gap > 0
                          ? `+${b.gap.toFixed(2)}`
                          : b.gap.toFixed(2)}
                    </td>
                  </tr>
                ))}
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
              {items.map((v, i) => (
                <li key={`${s.kind}-${i}`} className="verbatim-item">
                  <span className="verbatim-role">{roleLabelShort(v.rater_role, rtl)}</span>
                  <span className="verbatim-text">{v.text}</span>
                </li>
              ))}
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
  if (v === null) return "—";
  return v.toFixed(2);
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
// Print CSS — single source of truth so Puppeteer renders identically
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
.group-bar-track { height: 3mm; background: var(--vifm-soft); border-radius: 1.5mm; overflow: hidden; }
.group-bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--vifm-accent), var(--vifm-primary)); }
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

/* IDP */
.idp { padding-left: 5mm; margin: 0; }
.idp li { padding: 3mm 0; border-bottom: 0.6pt solid var(--vifm-border); page-break-inside: avoid; }
.idp li:last-child { border-bottom: 0; }
.idp-row { display: flex; gap: 4mm; align-items: baseline; margin: 2mm 0; }
.idp-row > span:first-child { color: var(--vifm-muted); font-size: 9pt; min-width: 42mm; }
.idp-line { flex: 1; border-bottom: 0.6pt solid var(--vifm-border); height: 5mm; }

/* Item-level table */
.item-table-card { margin-bottom: 4mm; page-break-inside: avoid; }
.item-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 1.5mm; }
.item-table th { background: var(--vifm-soft); color: var(--vifm-primary); padding: 1.5mm 2mm; text-align: center; font-weight: 600; font-size: 8.5pt; }
.item-table th.item-behavior { text-align: left; }
.item-table td { padding: 1.8mm 2mm; border-bottom: 0.5pt solid var(--vifm-border); text-align: center; font-variant-numeric: tabular-nums; }
.item-table td.item-behavior { text-align: left; color: var(--vifm-dark); font-size: 9.5pt; line-height: 1.35; }
.item-table td.dim { color: var(--vifm-muted); }
.item-table tr:last-child td { border-bottom: 0; }

/* Verbatim Start/Stop/Continue */
.verbatim-section { margin-bottom: 5mm; page-break-inside: avoid; }
.verbatim-list { list-style: none; padding: 0; margin: 0; }
.verbatim-item { padding: 2.5mm 0; border-bottom: 0.5pt solid var(--vifm-border); display: grid; grid-template-columns: 28mm 1fr; gap: 4mm; align-items: baseline; }
.verbatim-item:last-child { border-bottom: 0; }
.verbatim-role { color: var(--vifm-muted); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.verbatim-text { color: var(--vifm-dark); font-size: 10.5pt; line-height: 1.45; white-space: pre-wrap; }

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
