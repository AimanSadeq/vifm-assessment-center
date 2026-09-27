// VIFM behavioural framework v2 - 21 competencies across 4 domains / 8 clusters.
//
// The single source of the v1 -> v2 mapping. The migration that loads v2
// (00226) is generated from this file, and the code bank, report lenses and
// translation tables read it, so the mapping lives in exactly one place.
//
// Shape of the change:
//   * 8 v1 competencies carry over unchanged (same row, same id).
//   * 12 new competencies each absorb 2-3 v1 competencies (a merge).
//   * Mobilising Around Purpose moves from RESULTS to PEOPLE; it gets a new
//     row so v1 reports keep showing it where it was.
//   * Financial Literacy & Acumen and Digital & Data Fluency leave the
//     behavioural framework (they are knowledge, measured by Technical).
//   * The "Adaptability & Change" cluster empties and is retired.
//
// Arabic names and definitions are best-effort and pending human review, as
// for the v1 framework.

export const V2_FRAMEWORK_VERSION = 2;

const V1 = (n: number) => `a0000001-0000-0000-0000-${String(n).padStart(12, "0")}`;
const V2 = (n: number) => `a0000002-0000-0000-0000-${String(n).padStart(12, "0")}`;
const CL = (n: number) => `c1000001-0000-0000-0000-${String(n).padStart(12, "0")}`;

/** v1 clusters kept in v2, and the one retired (it has no members left). */
export const V2_RETIRED_CLUSTER_IDS = [CL(4)] as const; // Adaptability & Change

export type V2Competency = {
  id: string;
  clusterId: string;
  sortOrder: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** The v1 competencies this one absorbs (their items, indicators and tips pool here). */
  absorbs: string[];
};

/** The 13 new rows. */
export const V2_NEW_COMPETENCIES: V2Competency[] = [
  {
    id: V2(1),
    clusterId: CL(1),
    sortOrder: 1,
    nameEn: "Critical Analysis & Judgement",
    nameAr: "التحليل النقدي وحُسن التقدير",
    descriptionEn:
      "Breaks ambiguous, data-heavy problems into their parts, tests assumptions, and weighs competing explanations before reaching a view. Turns that reasoning into timely, balanced decisions, even when information is incomplete, weighing risk, stakeholders and second-order consequences. Stands behind decisions with reasoning that holds up to scrutiny.",
    descriptionAr:
      "يفكّك المشكلات الغامضة والكثيفة بالبيانات إلى أجزائها، ويختبر الافتراضات، ويوازن بين التفسيرات المتنافسة قبل أن يكوّن رأياً. ويحوّل هذا التحليل إلى قرارات متوازنة وفي وقتها حتى عندما تكون المعلومات ناقصة، مع مراعاة المخاطر وأصحاب المصلحة والنتائج غير المباشرة. ويدافع عن قراراته بمنطق يصمد أمام التدقيق.",
    absorbs: [V1(4), V1(5)],
  },
  {
    id: V2(2),
    clusterId: CL(1),
    sortOrder: 2,
    nameEn: "Strategic & Commercial Insight",
    nameAr: "البصيرة الاستراتيجية والتجارية",
    descriptionEn:
      "Reads the competitive, economic and regulatory landscape and anticipates how markets and client needs will shift. Converts that insight into a clear, prioritised direction framed around long-term value, and links day-to-day work to the commercial outcomes it should produce. Sets direction others can understand, align to and act on.",
    descriptionAr:
      "يقرأ المشهد التنافسي والاقتصادي والتنظيمي ويستشرف كيف ستتغير الأسواق واحتياجات العملاء. ويحوّل هذه البصيرة إلى توجّه واضح ذي أولويات مبني على القيمة طويلة الأمد، ويربط العمل اليومي بالنتائج التجارية المرجوّة منه. ويضع توجّهاً يستطيع الآخرون فهمه والالتفاف حوله والعمل به.",
    absorbs: [V1(1), V1(2), V1(41)],
  },
  {
    id: V2(3),
    clusterId: CL(2),
    sortOrder: 2,
    nameEn: "Navigating Complexity & Ambiguity",
    nameAr: "التعامل مع التعقيد والغموض",
    descriptionEn:
      "Makes sense of high-volume, interdependent and sometimes conflicting information, and sees how decisions ripple across functions, markets and time. Stays effective and decisive when direction, data or conditions are unclear, making progress on what is known and adjusting as new information arrives. Brings clarity that lets the organisation act.",
    descriptionAr:
      "يستوعب المعلومات الكثيرة والمترابطة والمتعارضة أحياناً، ويرى كيف تنعكس القرارات عبر الوظائف والأسواق وعلى مدى الزمن. ويبقى فعّالاً وحاسماً عندما يكون الاتجاه أو البيانات أو الظروف غير واضحة، فيتقدّم بناءً على المعلوم ويعدّل مساره مع ورود معلومات جديدة. ويضفي وضوحاً يمكّن المؤسسة من التصرّف.",
    absorbs: [V1(7), V1(8), V1(15)],
  },
  {
    id: V2(4),
    clusterId: CL(3),
    sortOrder: 2,
    nameEn: "Delivery & Accountability",
    nameAr: "الإنجاز والمساءلة",
    descriptionEn:
      "Takes personal responsibility for measurable results and follows through from commitment to completion, sustaining standards when conditions are difficult. Holds self and others to what was promised, owns mistakes openly and fixes them rather than shifting blame. Builds a track record of reliability the organisation can plan around.",
    descriptionAr:
      "يتحمّل المسؤولية الشخصية عن نتائج قابلة للقياس ويتابع من الالتزام حتى الإنجاز، محافظاً على المعايير عندما تصعب الظروف. ويُلزم نفسه والآخرين بما وُعد به، ويعترف بأخطائه علناً ويصلحها بدلاً من إلقاء اللوم. ويبني سجلاً من الموثوقية يمكن للمؤسسة أن تخطط على أساسه.",
    absorbs: [V1(11), V1(12)],
  },
  {
    id: V2(5),
    clusterId: CL(3),
    sortOrder: 4,
    nameEn: "Planning & Resourcing",
    nameAr: "التخطيط وتوفير الموارد",
    descriptionEn:
      "Sequences work so the most important commitments are met, distinguishing the urgent from the important. Secures and deploys the people, budget and tools the work needs, making the case for resources where they will have most impact. Keeps delivery on track by anticipating dependencies and adjusting plans as conditions change.",
    descriptionAr:
      "يرتّب العمل بحيث تُنجَز الالتزامات الأهم، مميّزاً بين العاجل والمهم. ويؤمّن الأفراد والميزانية والأدوات التي يحتاجها العمل ويوظّفها، ويدافع عن الموارد حيث يكون أثرها أكبر. ويحافظ على مسار التنفيذ باستباق الاعتماديات وتعديل الخطط مع تغيّر الظروف.",
    absorbs: [V1(13), V1(38)],
  },
  {
    id: V2(6),
    clusterId: CL(9),
    sortOrder: 1,
    nameEn: "Customer & Stakeholder Focus",
    nameAr: "التركيز على العملاء وأصحاب المصلحة",
    descriptionEn:
      "Understands and anticipates the needs of customers and stakeholders, internal and external, and delivers reliably against them. Maps who is affected by and who can affect the work, and engages each appropriately and early. Keeps diverse interests aligned around shared goals and treats their experience as a measure of success.",
    descriptionAr:
      "يفهم احتياجات العملاء وأصحاب المصلحة الداخليين والخارجيين ويستبقها ويلبّيها بموثوقية. ويحدّد من يتأثر بالعمل ومن يمكنه التأثير فيه، ويتواصل مع كلٍّ منهم بالشكل المناسب ومبكراً. ويحافظ على اتساق المصالح المتنوعة حول أهداف مشتركة، ويعدّ تجربتهم مقياساً للنجاح.",
    absorbs: [V1(39), V1(40)],
  },
  {
    id: V2(7),
    clusterId: CL(5),
    sortOrder: 1,
    nameEn: "Clear & Adaptive Communication",
    nameAr: "التواصل الواضح والمرن",
    descriptionEn:
      "Conveys complex content clearly, tailoring message, tone and medium to the audience, and listens to check understanding rather than assuming it. Adjusts style in the moment to fit the person and the situation, flexing between directness and diplomacy without losing authenticity. Makes sure the right people grasp and act on what matters.",
    descriptionAr:
      "ينقل المحتوى المعقّد بوضوح، مكيّفاً الرسالة والنبرة والوسيلة بحسب الجمهور، ويصغي للتأكد من الفهم بدلاً من افتراضه. ويعدّل أسلوبه في اللحظة بما يناسب الشخص والموقف، متنقلاً بين المباشرة والدبلوماسية دون أن يفقد أصالته. ويحرص على أن يستوعب الأشخاص المعنيون ما يهم ويتصرفوا بناءً عليه.",
    absorbs: [V1(19), V1(28)],
  },
  {
    id: V2(8),
    clusterId: CL(5),
    sortOrder: 2,
    nameEn: "Influence & Agreement",
    nameAr: "التأثير والوصول إلى الاتفاق",
    descriptionEn:
      "Builds well-reasoned, audience-aware cases that win genuine commitment, and addresses concerns rather than overriding them. Surfaces and resolves disagreement directly and calmly, keeping the focus on the issue. Reaches durable agreements through preparation and fair trade-offs, holding firm on what matters while staying flexible on how.",
    descriptionAr:
      "يبني حججاً منطقية تراعي الجمهور وتكسب التزاماً حقيقياً، ويعالج المخاوف بدلاً من تجاوزها. ويطرح الخلافات ويحلّها مباشرة وبهدوء مع إبقاء التركيز على القضية. ويصل إلى اتفاقات مستدامة عبر الإعداد والمقايضات العادلة، متمسكاً بما هو مهم ومرناً في طريقة تحقيقه.",
    absorbs: [V1(20), V1(21), V1(22)],
  },
  {
    id: V2(9),
    clusterId: CL(5),
    sortOrder: 3,
    nameEn: "Networks & Collaboration",
    nameAr: "بناء الشبكات والتعاون",
    descriptionEn:
      "Builds and sustains useful relationships inside and outside the organisation, investing in them before they are needed. Reaches beyond their own team to coordinate, share information and solve problems jointly. Puts the wider result ahead of silo loyalty so the organisation wins as a whole.",
    descriptionAr:
      "يبني علاقات مفيدة داخل المؤسسة وخارجها ويحافظ عليها، ويستثمر فيها قبل الحاجة إليها. ويتجاوز حدود فريقه للتنسيق وتبادل المعلومات وحل المشكلات بشكل مشترك. ويقدّم النتيجة الأشمل على الولاء للوحدات المنعزلة لتنجح المؤسسة ككل.",
    absorbs: [V1(23), V1(26)],
  },
  {
    id: V2(10),
    clusterId: CL(7),
    sortOrder: 1,
    nameEn: "Integrity & Principled Courage",
    nameAr: "النزاهة والشجاعة المبدئية",
    descriptionEn:
      "Acts honestly and fairly, within the spirit as well as the letter of professional standards, even when no one is watching. Raises difficult issues and challenges poor decisions, even at personal or political cost. Aligns words with actions so commitments are believed, earning a reputation others can rely on.",
    descriptionAr:
      "يتصرف بأمانة وإنصاف وفق روح المعايير المهنية ونصّها، حتى عندما لا يراقبه أحد. ويطرح القضايا الصعبة ويعترض على القرارات الضعيفة ولو كان ذلك على حساب مصلحته الشخصية أو السياسية. ويطابق أقواله أفعاله فتكون التزاماته موضع ثقة، ويكسب سمعة يعتمد عليها الآخرون.",
    absorbs: [V1(32), V1(31), V1(27)],
  },
  {
    id: V2(11),
    clusterId: CL(8),
    sortOrder: 1,
    nameEn: "Resilience & Composure",
    nameAr: "المرونة النفسية ورباطة الجأش",
    descriptionEn:
      "Stays calm, clear and constructive under pressure, scrutiny and setbacks, keeping emotion in check so thinking stays sharp. Recovers quickly from disappointment and learns from it. Manages energy and the competing demands of work and life so performance holds up over time, not just in the moment.",
    descriptionAr:
      "يبقى هادئاً وواضحاً وبنّاءً تحت الضغط والتدقيق وعند الانتكاسات، ويضبط انفعالاته ليظل تفكيره حاداً. ويتعافى سريعاً من الإحباط ويتعلّم منه. ويدير طاقته والمتطلبات المتنافسة للعمل والحياة بحيث يستمر أداؤه على المدى الطويل لا في اللحظة فقط.",
    absorbs: [V1(17), V1(36), V1(37)],
  },
  {
    id: V2(12),
    clusterId: CL(8),
    sortOrder: 2,
    nameEn: "Learning Agility",
    nameAr: "سرعة التعلّم",
    descriptionEn:
      "Learns rapidly from new and first-time situations and applies the lessons in unfamiliar conditions. Experiments when facing unfamiliar problems and adjusts quickly, treating both wins and failures as information. Takes ownership of their own development so their skills keep pace with changing demands.",
    descriptionAr:
      "يتعلّم بسرعة من المواقف الجديدة وغير المسبوقة ويطبّق الدروس في ظروف غير مألوفة. ويجرّب عند مواجهة مشكلات غير مألوفة ويتكيّف سريعاً، معتبراً النجاح والإخفاق مصدرين للمعرفة. ويتولّى مسؤولية تطوير نفسه بحيث تواكب مهاراته المتطلبات المتغيّرة.",
    absorbs: [V1(34), V1(35), V1(16)],
  },
  {
    id: V2(13),
    clusterId: CL(6),
    sortOrder: 3,
    nameEn: "Mobilising Around Purpose",
    nameAr: "الحشد حول الهدف",
    descriptionEn:
      "Articulates a compelling sense of direction that connects people's work to a larger goal and motivates action. Helps individuals see how their contribution matters and why it is worth their effort. Turns purpose into shared energy and commitment rather than leaving it as a slogan.",
    descriptionAr:
      "يعبّر عن توجّه ملهم يربط عمل الأفراد بهدف أكبر ويحفّزهم على العمل. ويساعد الأفراد على رؤية أهمية مساهمتهم ولماذا تستحق جهدهم. ويحوّل الهدف إلى طاقة والتزام مشتركين بدلاً من أن يبقى شعاراً.",
    absorbs: [V1(18)],
  },
];

/** v1 competencies that carry over unchanged into v2 (same row, same id). */
export const V2_KEPT_COMPETENCY_IDS = [V1(6), V1(10), V1(14), V1(24), V1(25), V1(29), V1(30), V1(33)] as const;

/** v1 competencies that leave the behavioural framework with no successor
 *  (knowledge areas, measured by Technical). */
export const V2_RETIRED_WITHOUT_SUCCESSOR = [V1(3), V1(9)] as const;

/** Every retired v1 competency -> the v2 competency that absorbed it. */
export const V1_TO_V2: Readonly<Record<string, string>> = Object.fromEntries(
  V2_NEW_COMPETENCIES.flatMap((c) => c.absorbs.map((old) => [old, c.id])),
);

/** All v2 competency ids (21). */
export const V2_COMPETENCY_IDS: string[] = [...V2_KEPT_COMPETENCY_IDS, ...V2_NEW_COMPETENCIES.map((c) => c.id)];

/**
 * Extend a v1 report map (competency id -> category) to the v2 competencies.
 * Kept competencies already have their entry. A merged competency takes the
 * category most of its source competencies carry; a tie goes to the first
 * listed source (the merge's anchor). With `requireMajority`, a merged
 * competency is mapped only when at least half its sources were in the map at
 * all - used by lenses that cover a subset (EQ), so a mostly out-of-scope merge
 * stays out of scope. Mutates and returns the map, so v1 entries (which old
 * reports still need) are kept.
 */
export function extendMapToV2<T extends string>(map: Record<string, T>, opts?: { requireMajority?: boolean }): Record<string, T> {
  for (const c of V2_NEW_COMPETENCIES) {
    const cats = c.absorbs.map((id) => map[id]).filter((v): v is T => v != null);
    if (cats.length === 0) continue;
    if (opts?.requireMajority && cats.length * 2 < c.absorbs.length) continue;
    const count = new Map<T, number>();
    for (const v of cats) count.set(v, (count.get(v) ?? 0) + 1);
    let best = cats[0];
    for (const v of cats) if ((count.get(v) ?? 0) > (count.get(best) ?? 0)) best = v;
    map[c.id] = best;
  }
  return map;
}
