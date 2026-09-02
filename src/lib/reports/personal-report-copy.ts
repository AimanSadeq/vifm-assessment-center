import type { AraIndividualFactorId, AraIndividualMaturityStageId } from "@/lib/constants/ara-individual-factors";

/**
 * Bilingual copy for the personal AI-readiness report - ONE home for the
 * coaching blurbs, stage next-steps and legend panels that the English
 * (React-PDF) and Arabic (Puppeteer) renderers each carried a private copy of.
 * Two copies drifted; the unified HTML renderer reads both languages from here.
 *
 * Arabic is MSA in GCC-business register and still needs native review before
 * public distribution (see CLAUDE.md "Important Notes").
 */


export const STAGE_RANGE_EN: Record<AraIndividualMaturityStageId, string> = {
  emerging: "below 3",
  practising: "3 to below 4",
  embedded: "4 and above",
};


export const STAGE_RANGE_AR: Record<AraIndividualMaturityStageId, string> = {
  emerging: "أقل من 3",
  practising: "من 3 إلى أقل من 4",
  embedded: "4 فأكثر",
};

export const FACTOR_GUIDANCE: Record<
  AraIndividualFactorId,
  Record<AraIndividualMaturityStageId, string>
> = {
  thinking_sense_check: {
    emerging:
      "Treat every AI output as a draft. Build a personal checklist of 'always verify' items - numbers, names, citations - and run it before anything leaves your hands.",
    practising:
      "You're checking AI work, but probably only when it feels off. Define explicit triggers (high-stakes claims, unfamiliar domains) that automatically push you to verify, so the habit doesn't depend on suspicion.",
    embedded:
      "You spot hallucinations naturally. Share your verification techniques with the team and codify them into a sense-check protocol others can follow when you're not in the room.",
  },
  results_working_practice: {
    emerging:
      "Pick one recurring task and integrate AI into it for two weeks. Track the time saved - that data builds confidence faster than experimenting at random across everything you do.",
    practising:
      "You're using AI on real work. Invest now in prompt templates and reusable workflows so your productivity compounds across runs instead of starting from scratch each time.",
    embedded:
      "AI is part of how you work. Document your strongest workflow patterns so colleagues can adopt them without re-inventing the wheel - multiplying your impact past your own keyboard.",
  },
  people_collaboration: {
    emerging:
      "Start as a translator: when AI helps you on a task, briefly tell a colleague what it did well and where you stepped in. That opens the conversation without putting anyone on the spot.",
    practising:
      "You're sharing AI usefully. Go further - invite teammates to bring their AI questions to you, and set a recurring 15-minute slot for the team to compare prompts and patterns.",
    embedded:
      "You're a multiplier on AI adoption. Watch for over-reliance signals (colleagues taking outputs at face value) and surface them constructively before they show up in a deliverable.",
  },
  self_adaptive_mindset: {
    emerging:
      "Block 30 minutes a week to learn about one new AI capability - not to use it, just to know it exists. Curiosity is the leading indicator of every other factor improving.",
    practising:
      "You stay curious. Stress-test your role now: pick a task you do well and ask 'what would AI need to do this better?' - that surfaces where to lean in versus where to deepen your own expertise.",
    embedded:
      "You adapt fluidly. Use that capacity to mentor someone earlier in their AI journey - teaching cements your own adaptability and surfaces your blind spots.",
  },
};


export const FACTOR_GUIDANCE_AR: Record<
  AraIndividualFactorId,
  Record<AraIndividualMaturityStageId, string>
> = {
  thinking_sense_check: {
    emerging:
      "تعامل مع كل مخرجات الذكاء الاصطناعي كمسودة. ضع قائمة شخصية بـ«ما يجب التحقق منه دائماً» - الأرقام والأسماء والمراجع - ومرّ بها قبل تسليم أي عمل.",
    practising:
      "تتحقق من عمل الذكاء الاصطناعي، لكن بشكل تفاعلي في الغالب. حدّد محفزات صريحة (ادعاءات عالية المخاطر، مجالات غير مألوفة) تدفعك إلى التحقق تلقائياً؛ حتى لا تعتمد العادة على الشك.",
    embedded:
      "ترصد الهلوسة بشكل طبيعي. شارك أساليب التحقق مع فريقك ودوّنها في بروتوكول يستطيع الآخرون اتباعه حين لا تكون حاضراً.",
  },
  results_working_practice: {
    emerging:
      "اختر مهمة متكررة وادمج الذكاء الاصطناعي فيها لمدة أسبوعين، وتتبّع الوقت الموفّر - هذه البيانات تبني الثقة أسرع من التجريب العشوائي.",
    practising:
      "تستخدم الذكاء الاصطناعي في عمل حقيقي. استثمر الآن في قوالب التعليمات وسير العمل القابلة لإعادة الاستخدام؛ تتراكم الإنتاجية بدلاً من البدء من الصفر في كل مرة.",
    embedded:
      "الذكاء الاصطناعي جزء من طريقة عملك. دوّن أنماط سير العمل الأقوى لديك ليتبناها زملاؤك دون إعادة اختراع العجلة - يضاعف ذلك أثرك بعيداً عن لوحة مفاتيحك.",
  },
  people_collaboration: {
    emerging:
      "ابدأ بدور المترجم: حين يساعدك الذكاء الاصطناعي في مهمة، اشرح لزميل باختصار ما أبدع فيه وأين تدخّلت أنت. يفتح ذلك الحوار دون إحراج أحد.",
    practising:
      "تشارك بشكل مفيد. خذها خطوة أبعد: ادع زملاءك لطرح أسئلتهم عن الذكاء الاصطناعي عليك، وحدّد لقاءً منتظماً مدته 15 دقيقة ليقارن الفريق التعليمات والأنماط.",
    embedded:
      "أنت مضاعِف لتبنّي الذكاء الاصطناعي. ترصّد إشارات الاعتماد المفرط - زملاء يقبلون المخرجات دون تمحيص - وأشِر إليها بشكل بنّاء قبل أن تظهر في تسليم.",
  },
  self_adaptive_mindset: {
    emerging:
      "خصّص 30 دقيقة أسبوعياً لتعلّم قدرة جديدة في الذكاء الاصطناعي؛ ليس لاستخدامها، بل لمعرفة وجودها. الفضول هو المؤشر القائد لتحسّن كل عامل آخر.",
    practising:
      "تحافظ على فضولك. اختبر دورك الآن: اختر مهمة تتقنها واسأل «ماذا يحتاج الذكاء الاصطناعي ليؤديها أفضل؟» - يكشف ذلك أين تنحاز وأين تعمّق خبرتك.",
    embedded:
      "تتكيف بسلاسة. استثمر هذه القدرة في إرشاد شخص في بداية رحلته مع الذكاء الاصطناعي؛ التعليم يرسّخ تكيّفك ويكشف نقاط ضعفك.",
  },
};


export const STAGE_NEXT_STEPS: Record<AraIndividualMaturityStageId, { title: string; bullets: string[] }> = {
  emerging: {
    title: "Where to focus next",
    bullets: [
      "Pick the one factor with your lowest score and apply the per-factor guidance from page 1 for the next two weeks. Don't try to lift all four at once.",
      "Schedule a single 30-minute weekly slot specifically for AI practice. Without a calendar block, the habit won't form.",
      "Find one person on your team who's further along on AI - a peer, not a manager - and ask them to share one prompt they trust. Borrowing beats starting cold.",
    ],
  },
  practising: {
    title: "Where to focus next",
    bullets: [
      "You're past the experiment phase. Convert your three most-repeated AI interactions into named, saved prompts so you stop reinventing them.",
      "Pair your strongest factor with your weakest: use the muscle you've already built to expand into the area you're avoiding. AI Working Practice often pulls AI Sense-Check up with it, for example.",
      "Surface one concrete AI-assisted outcome to your manager or team this month - speed gain, quality lift, mistake caught. Visibility unlocks investment.",
    ],
  },
  embedded: {
    title: "Where to focus next",
    bullets: [
      "Your individual fluency is solid. The next ceiling is influence: pick one team norm (verification, prompt sharing, escalation rules) and propose it.",
      "Audit one of your AI workflows for fairness, confidentiality, and policy fit. Embedded users get blindsided by governance, not by tools.",
      "Mentor someone in the Emerging tier - the act of teaching one person will surface gaps in your own model and harden your judgment.",
    ],
  },
};


export const STAGE_NEXT_STEPS_AR: Record<
  AraIndividualMaturityStageId,
  { title: string; bullets: string[] }
> = {
  emerging: {
    title: "ركّز هنا تالياً",
    bullets: [
      "اختر العامل ذا الدرجة الأدنى وطبّق إرشاداته من الصفحة الأولى لمدة أسبوعين. لا تحاول رفع العوامل الأربعة دفعة واحدة.",
      "احجز في تقويمك جلسة أسبوعية ثابتة مدتها 30 دقيقة لممارسة الذكاء الاصطناعي. بدون موعد محدّد، لن تتشكّل العادة.",
      "ابحث عن زميل في فريقك متقدّم عليك في الذكاء الاصطناعي - زميل لا مدير - واطلب منه أن يشاركك تعليمة (Prompt) يثق بها. الاستعارة أسرع من البدء من الصفر.",
    ],
  },
  practising: {
    title: "ركّز هنا تالياً",
    bullets: [
      "تجاوزت مرحلة التجريب. حوّل أكثر ثلاث تفاعلات تكرّرها مع الذكاء الاصطناعي إلى تعليمات محفوظة بأسماء واضحة لتتوقف عن إعادة اختراعها.",
      "اقرن أقوى عامل لديك بأضعف عامل: استخدم القدرة التي بنيتها للتوسع في المنطقة التي تتجنبها. غالباً ما ترفع «الممارسة العملية» معها «تحقّق الذكاء الاصطناعي».",
      "اعرض هذا الشهر نتيجة ملموسة أنجزتها بمساعدة الذكاء الاصطناعي على مديرك أو فريقك: كسب في السرعة، تحسّن في الجودة، أو خطأ رصدته. الظهور يفتح أبواب الاستثمار.",
    ],
  },
  embedded: {
    title: "ركّز هنا تالياً",
    bullets: [
      "إتقانك الفردي راسخ. السقف التالي هو التأثير: اختر معياراً واحداً للفريق (التحقق، مشاركة التعليمات، قواعد التصعيد) واقترحه.",
      "راجع أحد مهامك المعتمدة على الذكاء الاصطناعي من زاويا الإنصاف والسرية ومطابقة السياسات. المستخدمون الراسخون يفاجئهم سوء الحوكمة، لا الأدوات.",
      "أرشد شخصاً في المرحلة الناشئة - التعليم يكشف ثغرات في نموذجك الخاص ويُصلب حُكمك.",
    ],
  },
};


export const HOW_TO_USE_PANELS = {
  read: {
    title: "How to read these scores",
    bullets: [
      "1.0 - 2.9 - Opportunity. Foundation-building zone; deliberate practice will move the needle quickly.",
      "3.0 - 3.9 - Developing. The habit exists; the next gain is making it reliable rather than situational.",
      "4.0 - 5.0 - Strong. You operate fluently; the lift now is sharing the practice and stress-testing it.",
    ],
  },
  about: {
    title: "What this measures",
    bullets: [
      "Four behavioural factors that predict whether AI tools turn into real outcomes for you, not just experiments.",
      "Each factor maps to VIFM Assessment Centre competencies you may already be working on - so AI growth compounds with the rest of your development.",
      "This snapshot is self-report only. A consultant-led deep-dive doubles the items and adds peer benchmarking.",
    ],
  },
};


export const HOW_TO_USE_PANELS_AR = {
  read: {
    title: "كيف تقرأ هذه النتائج",
    bullets: [
      "1.0 - 2.9 - فرصة. منطقة إرساء الأساس؛ الممارسة المتعمَّدة ستحرّك العقرب بسرعة.",
      "3.0 - 3.9 - قيد التطوير. العادة قائمة؛ المكسب التالي هو جعلها موثوقة لا ظرفية.",
      "4.0 - 5.0 - قوي. تعمل بطلاقة؛ التحدّي الآن مشاركة الممارسة واختبارها.",
    ],
  },
  about: {
    title: "ما الذي يقيسه هذا التقييم",
    bullets: [
      "أربعة عوامل سلوكية تتنبأ بما إذا كانت أدوات الذكاء الاصطناعي ستتحوّل إلى نتائج فعلية لك، لا مجرد تجارب.",
      "كل عامل مرتبط بكفاءات مركز تقييم VIFM التي قد تعمل عليها فعلاً، فيتراكم نموّك في الذكاء الاصطناعي مع بقية مسار تطوّرك.",
      "هذه اللقطة تقرير ذاتي فقط. التشخيص المعمّق بقيادة استشاري يضاعف عدد البنود ويضيف مقارنات مع الأقران.",
    ],
  },
};

