import type { AraPillarId } from "@/types/ara";
import type { Horizon, Effort } from "./rollup-roadmap";

/**
 * Bilingual copy for the consolidation report. Everything here is chosen by
 * DATA (which quadrant a pillar falls in, which level a mean sits at); nothing
 * is tailored by hand. Keep the vocabulary canonical: levels are L1 Unaware ..
 * L5 Leading, the target is 4.00 AI Ready, the two findings are "shared gap"
 * and "uneven pillar".
 */

type Lang = "en" | "ar";
const pick = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

/** What each pillar covers - one line, both languages (ARA_PILLARS carries EN only). */
export const PILLAR_SCOPE: Record<AraPillarId, { en: string; ar: string }> = {
  strategy: { en: "AI mandate, executive sponsorship, budget and use-case prioritisation.", ar: "التفويض المتعلق بالذكاء الاصطناعي، والرعاية التنفيذية، والميزانية، وترتيب أولويات حالات الاستخدام." },
  data: { en: "Data quality, ownership, sovereignty and shadow-AI exposure.", ar: "جودة البيانات وملكيتها وسيادتها والتعرض للذكاء الاصطناعي غير المصرح به." },
  technology: { en: "Cloud sovereignty, approved AI tooling, MLOps and sandboxes.", ar: "سيادة السحابة، وأدوات الذكاء الاصطناعي المعتمدة، وعمليات نماذج التعلم الآلي، وبيئات التجربة." },
  talent: { en: "AI literacy, specialist skills, hiring and learning pathways.", ar: "الإلمام بالذكاء الاصطناعي، والمهارات المتخصصة، والتوظيف، ومسارات التعلّم." },
  culture: { en: "Appetite for change, experimentation and trust in AI-assisted decisions.", ar: "الرغبة في التغيير، والتجريب، والثقة في القرارات المدعومة بالذكاء الاصطناعي." },
  governance: { en: "Policies, ethics, accountability and regulatory alignment.", ar: "السياسات والأخلاقيات والمساءلة والمواءمة التنظيمية." },
  operations: { en: "Use-case portfolio, delivery capacity and value tracking.", ar: "محفظة حالات الاستخدام، وقدرة التنفيذ، وتتبّع القيمة." },
  model_management: { en: "Model lifecycle, monitoring, drift and retirement.", ar: "دورة حياة النماذج، والمراقبة، والانحراف، والإيقاف." },
};

export type PillarSituation = "central" | "lift" | "move" | "sustain";

/**
 * Which quadrant of the agenda matrix a pillar sits in, from the report's two
 * canonical findings (never from the mean alone, which contradicted them):
 *   central = shared gap (every unit below 4.00) and units agree -> one central programme
 *   lift    = shared gap but one unit is well ahead              -> transfer + central floor
 *   move    = some unit is at target but units are far apart     -> move practice, no new spend
 *   sustain = some unit is at target and units agree             -> keep, extend to target
 */
export function situationFor(sharedGap: boolean, spread: number, unevenThreshold: number): PillarSituation {
  const uneven = spread >= unevenThreshold;
  if (sharedGap && !uneven) return "central";
  if (sharedGap && uneven) return "lift";
  if (!sharedGap && uneven) return "move";
  return "sustain";
}

export function situationLabel(s: PillarSituation, lang: Lang): string {
  return {
    central: pick(lang, "Central programme", "برنامج مركزي"),
    lift: pick(lang, "Lift the rest", "رفع البقية"),
    move: pick(lang, "Move practice", "نقل الممارسات"),
    sustain: pick(lang, "Sustain", "الحفاظ"),
  }[s];
}

export function situationExplains(s: PillarSituation, lang: Lang): string {
  return {
    central: pick(lang,
      "Every unit is below the 4.00 target and they agree. No unit can fix this alone; it is a policy, platform or standards problem that is solved once, centrally, and inherited by all of them.",
      "كل الوحدات دون المستهدف 4.00 ومتفقة. لا تستطيع أي وحدة إصلاح ذلك بمفردها؛ إنها مسألة سياسات أو منصّات أو معايير تُحل مرة واحدة مركزياً وترثها الوحدات جميعاً."),
    lift: pick(lang,
      "Every unit is below the 4.00 target, but one is well ahead of the rest. Set a central floor and use the leading unit's practice to lift the others; the transfer is cheaper than building from scratch.",
      "كل الوحدات دون المستهدف 4.00، لكن إحداها متقدمة بوضوح على البقية. حدّد حداً أدنى مركزياً واستخدم ممارسة الوحدة الرائدة لرفع البقية؛ فالنقل أرخص من البناء من الصفر."),
    move: pick(lang,
      "At least one unit has reached the target, but the units are far apart. The capability exists somewhere in the organisation and has not travelled. This needs a transfer, not new spend.",
      "بلغت وحدة واحدة على الأقل المستهدف، لكن الوحدات متباعدة. القدرة موجودة في مكان ما من المنظمة ولم تنتقل بعد. يحتاج هذا إلى نقل لا إلى إنفاق جديد."),
    sustain: pick(lang,
      "At least one unit has reached the target and the rest are close behind. Protect what works and bring every unit to 4.00 through the units' own plans.",
      "بلغت وحدة واحدة على الأقل المستهدف والبقية قريبة منها. حافظ على ما ينجح وأوصل كل وحدة إلى 4.00 عبر خطط الوحدات نفسها."),
  }[s];
}

export type ConsolidationAction = { title: string; body: string; horizon: Horizon; effort: Effort; outcome: string };

/**
 * Three actions for a pillar at consolidation level. Chosen by situation,
 * with unit names substituted so the reader sees their own organisation
 * rather than a template. `strongest` / `weakest` are already localised.
 */
export function consolidationActions(args: {
  pillar: string; situation: PillarSituation; strongest: string; weakest: string; stage: string; lang: Lang;
}): ConsolidationAction[] {
  const { pillar: p, strongest: s, weakest: w, stage, lang } = args;
  const L = (en: string, ar: string) => pick(lang, en, ar);
  switch (args.situation) {
    case "central":
      return [
        { title: L(`Name one owner for ${p}`, `تعيين مالك واحد لـ${p}`), body: L(`Appoint a single accountable owner at ${stage} level with a mandate over every unit, so the fix is designed once and adopted everywhere.`, `عيّن مالكاً واحداً مسؤولاً على مستوى ${stage} بتفويض يشمل كل الوحدات، بحيث يُصمَّم الحل مرة واحدة ويُعتمد في كل مكان.`), horizon: "quick", effort: "low", outcome: L("One accountable name and a mandate the units recognise.", "اسم واحد مسؤول وتفويض تعترف به الوحدات.") },
        { title: L(`Central standard for ${p}`, `معيار مركزي لـ${p}`), body: L(`Publish the shared policy, platform or standard the units are all missing, with a minimum level every unit must reach and a date.`, `انشر السياسة أو المنصّة أو المعيار المشترك الذي تفتقده كل الوحدات، مع حد أدنى يجب أن تبلغه كل وحدة وتاريخ محدد.`), horizon: "build", effort: "medium", outcome: L("A published standard and a floor no unit falls below.", "معيار منشور وحد أدنى لا تهبط دونه أي وحدة.") },
        { title: L("Re-measure across all units", "إعادة القياس في كل الوحدات"), body: L(`Re-run the ${p} items in every unit after the standard lands, so the ${stage} can show the gap closing rather than assert it.`, `أعد تطبيق بنود ${p} في كل وحدة بعد اعتماد المعيار، ليُظهر ${stage} انغلاق الفجوة بدل الاكتفاء بالقول.`), horizon: "transform", effort: "low", outcome: L("Evidence that the central fix reached every unit.", "دليل على أن الحل المركزي وصل إلى كل وحدة.") },
      ];
    case "lift":
      return [
        { title: L(`Document how ${s} does it`, `توثيق كيف تفعل ذلك ${s}`), body: L(`Capture ${s}'s working practice on ${p} - the roles, the routines, the tooling - as a short playbook the other units can adopt.`, `وثّق ممارسة ${s} في ${p} - الأدوار والروتينات والأدوات - في دليل موجز يمكن للوحدات الأخرى تبنّيه.`), horizon: "quick", effort: "low", outcome: L("A playbook grounded in a unit that already scores well.", "دليل عملي مستند إلى وحدة تسجّل درجات جيدة بالفعل.") },
        { title: L(`Set a ${stage}-wide floor`, `تحديد حد أدنى على مستوى ${stage}`), body: L(`Alongside the transfer, put the central minimum in place for ${p}, because ${w} is too far behind for peer practice alone to close the gap.`, `إلى جانب النقل، ضع الحد الأدنى المركزي لـ${p}، لأن ${w} متأخرة كثيراً بحيث لا تكفي ممارسة الأقران وحدها لسد الفجوة.`), horizon: "build", effort: "medium", outcome: L("A floor for the weakest units and a ceiling that keeps rising.", "حد أدنى للوحدات الأضعف وسقف يواصل الارتفاع.") },
        { title: L(`Pair ${s} with ${w}`, `إقران ${s} بـ${w}`), body: L(`Run a structured transfer: named counterparts, a quarterly cadence and one shared measure, starting with the unit furthest behind.`, `نفّذ نقلاً منظماً: نظراء محددون بالاسم، وإيقاع ربع سنوي، ومقياس مشترك واحد، بدءاً بالوحدة الأكثر تأخراً.`), horizon: "build", effort: "medium", outcome: L(`${w} within one level of ${s} inside a year.`, `${w} على بُعد مستوى واحد من ${s} خلال عام.`) },
      ];
    case "move":
      return [
        { title: L(`Make ${s} the reference unit`, `اعتماد ${s} وحدةً مرجعية`), body: L(`Formally recognise ${s} as the ${stage}'s reference for ${p} and give it the remit to show the others, so the practice moves with authority rather than goodwill.`, `اعترف رسمياً بـ${s} مرجعاً لـ${stage} في ${p} وامنحها صلاحية توجيه الوحدات الأخرى، لتنتقل الممارسة بسلطة لا بحسن النية.`), horizon: "quick", effort: "low", outcome: L("A named reference unit and a reason for others to listen.", "وحدة مرجعية معروفة وسبب يدفع الآخرين للإصغاء.") },
        { title: L(`Transfer plan for ${w}`, `خطة نقل لـ${w}`), body: L(`Agree what ${w} adopts from ${s} on ${p}, in what order, and who owns each step; keep the scope to the practices that explain the score difference.`, `اتفق على ما تتبنّاه ${w} من ${s} في ${p}، وبأي ترتيب، ومن يملك كل خطوة؛ واحصر النطاق في الممارسات التي تفسّر الفارق في الدرجة.`), horizon: "build", effort: "medium", outcome: L("The spread between units narrows without new budget.", "يتقلّص التفاوت بين الوحدات دون ميزانية جديدة.") },
        { title: L("Track the spread, not the mean", "تتبّع التفاوت لا المتوسط"), body: L(`Report the range between the strongest and weakest unit on ${p} each quarter; the ${stage} is done when the range is inside one level.`, `ارفع تقريراً كل ربع بالمدى بين الوحدة الأقوى والأضعف في ${p}؛ ويُعدّ ${stage} قد أنجز حين يقع المدى ضمن مستوى واحد.`), horizon: "transform", effort: "low", outcome: L("One number that says whether capability actually travelled.", "رقم واحد يقول إن كانت القدرة قد انتقلت فعلاً.") },
      ];
    case "sustain":
    default:
      return [
        { title: L(`Protect the ${p} routines`, `حماية روتينات ${p}`), body: L(`Write down what the units already do on ${p} so it survives staff changes and does not have to be rediscovered next year.`, `دوّن ما تفعله الوحدات أصلاً في ${p} كي يصمد أمام تغيّر الموظفين ولا يحتاج إلى إعادة اكتشاف العام المقبل.`), horizon: "quick", effort: "low", outcome: L("Practice that is institutional, not personal.", "ممارسة مؤسسية لا شخصية.") },
        { title: L("Close the last gap to 4.00", "سدّ الفجوة الأخيرة نحو 4.00"), body: L(`Each unit's own report names its remaining ${p} actions; the ${stage} role is to fund and sequence them, not to add a central layer.`, `يسمّي تقرير كل وحدة إجراءاتها المتبقية في ${p}؛ ودور ${stage} هو تمويلها وترتيبها، لا إضافة طبقة مركزية.`), horizon: "build", effort: "low", outcome: L("Every unit at or above the AI Ready target.", "كل وحدة عند مستهدف الجاهزية للذكاء الاصطناعي أو فوقه.") },
        { title: L("Lend the strength elsewhere", "إعارة القوة لركائز أخرى"), body: L(`Use the people who built ${p} as the transfer team for the pillars still behind; strong pillars are the ${stage}'s cheapest source of capability.`, `استعن بمن بنوا ${p} فريقاً لنقل الممارسات إلى الركائز المتأخرة؛ فالركائز القوية أرخص مصادر القدرة لدى ${stage}.`), horizon: "transform", effort: "medium", outcome: L("Strength in one pillar becomes progress in another.", "تتحوّل القوة في ركيزة إلى تقدّم في أخرى.") },
      ];
  }
}

/** How-to-read rows for the consolidation's methodology page. */
export function consolidationFactRows(args: { lang: Lang; stage: string; weighting: "respondents" | "equal"; unevenThreshold: number; retentionYears: number; ladder: string }) {
  const { lang, stage, weighting, unevenThreshold, retentionYears, ladder } = args;
  const L = (en: string, ar: string) => pick(lang, en, ar);
  return [
    { label: L("Scale", "المقياس"), value: L(`1.00 to 5.00 on five maturity levels: ${ladder}.`, `من 1.00 إلى 5.00 على خمسة مستويات نضج: ${ladder}.`) },
    { label: L("Target", "المستهدف"), value: L("4.00 AI Ready. It is a target, not the maximum: L4 and L5 sit above it.", "4.00 جاهز للذكاء الاصطناعي. إنه مستهدف لا حد أقصى: يقع المستويان الرابع والخامس فوقه.") },
    { label: L("Unit score", "درجة الوحدة"), value: L("The mean of the pillars in that unit's own scope. A pillar a unit was not asked about never counts against it.", "متوسط الركائز الداخلة في نطاق تلك الوحدة. الركيزة التي لم تُسأل عنها الوحدة لا تُحسب عليها أبداً.") },
    { label: L(`${stage} score`, `درجة ${stage}`), value: weighting === "respondents"
      ? L("Respondent-weighted mean of the unit scores, so a forty-person unit counts for more than a six-person one.", "متوسط مرجّح بعدد المشاركين لدرجات الوحدات، فوحدة من أربعين شخصاً تزن أكثر من وحدة من ستة.")
      : L("Straight mean of the unit scores, every unit weighted alike.", "متوسط بسيط لدرجات الوحدات، بوزن متساوٍ لكل وحدة.") },
    { label: L("Pooled unit", "وحدة مجمّعة"), value: L("A division inside an enterprise has no sitting of its own; its score is pooled from its departments, respondent-weighted.", "القطاع داخل المنشأة لا جلسة خاصة له؛ درجته مجمّعة من إداراته بترجيح عدد المشاركين.") },
    { label: L("Shared gap", "فجوة مشتركة"), value: L("A pillar below 4.00 in every unit that scored it.", "ركيزة دون 4.00 في كل وحدة قيّمتها.") },
    { label: L("Uneven pillar", "ركيزة متفاوتة"), value: L(`A pillar where the strongest and weakest unit are ${unevenThreshold.toFixed(2)} or more apart.`, `ركيزة تبعد فيها الوحدة الأقوى عن الأضعف بمقدار ${unevenThreshold.toFixed(2)} فأكثر.`) },
    { label: L("Not assessed", "لم تُقيَّم"), value: L("A pillar in this scope that no unit covered. No evidence was collected, which is not the same as no gap.", "ركيزة ضمن هذا النطاق لم تغطِّها أي وحدة. لم تُجمع أدلة، وهذا يختلف عن عدم وجود فجوة.") },
    { label: L("Individual layer", "الطبقة الفردية"), value: L("Where a unit ran it, each person has a four-factor profile and the unit a workforce mean; the consolidation pools those means.", "حيث فعّلتها الوحدة، لكل شخص ملف من أربعة عوامل وللوحدة متوسط قوى عاملة؛ ويجمّع التقرير الموحّد تلك المتوسطات.") },
    { label: L("Data retention", "الاحتفاظ بالبيانات"), value: L(`Responses are retained for ${retentionYears} years unless the contract says otherwise, then purged.`, `يُحتفظ بالإجابات لمدة ${retentionYears} سنوات ما لم ينص العقد على خلاف ذلك، ثم تُحذف.`) },
  ];
}
