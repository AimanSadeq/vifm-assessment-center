"use client";

// "What we measure" - CEFR-aligned definitions of the four skills and the
// sub-criteria within Writing and Speaking. Shown on the result so the taker
// (and reviewer) understands exactly what each score represents. Bilingual.

type Def = { term: { en: string; ar: string }; desc: { en: string; ar: string } };

const SKILLS: Def[] = [
  {
    term: { en: "Reading", ar: "القراءة" },
    desc: {
      en: "Understanding written English - finding the gist, locating detail, inferring meaning, and reading vocabulary in context.",
      ar: "فهم اللغة الإنجليزية المكتوبة - استخلاص الفكرة العامة، وتحديد التفاصيل، واستنتاج المعنى، وفهم المفردات في سياقها.",
    },
  },
  {
    term: { en: "Listening", ar: "الاستماع" },
    desc: {
      en: "Understanding spoken English from a single hearing - gist, specific detail, inference, and following the flow of speech.",
      ar: "فهم اللغة الإنجليزية المنطوقة من استماع واحد - الفكرة العامة، والتفاصيل، والاستنتاج، ومتابعة تسلسل الحديث.",
    },
  },
  {
    term: { en: "Writing", ar: "الكتابة" },
    desc: {
      en: "Producing written English that completes a workplace task, assessed on the seven criteria below.",
      ar: "إنتاج كتابة إنجليزية تُنجز مهمة عملية، وتُقيَّم وفق المعايير السبعة أدناه.",
    },
  },
  {
    term: { en: "Speaking", ar: "التحدث" },
    desc: {
      en: "Producing spoken English in response to a prompt, assessed on the criteria below.",
      ar: "إنتاج حديث إنجليزي ردًا على مُحفّز، ويُقيَّم وفق المعايير أدناه.",
    },
  },
];

const WRITING_CRIT: Def[] = [
  { term: { en: "Task achievement", ar: "تحقيق المهمة" }, desc: { en: "How fully and relevantly the response answers the prompt.", ar: "مدى استيفاء الإجابة للمطلوب وملاءمتها للمهمة." } },
  { term: { en: "Coherence & cohesion", ar: "الترابط والتماسك" }, desc: { en: "Logical organisation and the linking of ideas.", ar: "التنظيم المنطقي للأفكار والربط بينها." } },
  { term: { en: "Lexical resource", ar: "الثروة اللغوية" }, desc: { en: "Range and precision of vocabulary.", ar: "اتساع المفردات ودقتها." } },
  { term: { en: "Grammar range & accuracy", ar: "القواعد ودقتها" }, desc: { en: "Variety and correctness of grammatical structures.", ar: "تنوّع التراكيب النحوية وصحتها." } },
  { term: { en: "Register (business-like)", ar: "الأسلوب المهني" }, desc: { en: "A professional tone appropriate to a workplace email/message.", ar: "أسلوب مهني يناسب رسائل العمل." } },
  { term: { en: "Etiquette & courtesy", ar: "اللياقة والكياسة" }, desc: { en: "Politeness, appropriate greetings/closings, and cultural sensitivity.", ar: "اللباقة والتحية والختام المناسبان والحساسية الثقافية." } },
  { term: { en: "Spelling & punctuation", ar: "الإملاء والترقيم" }, desc: { en: "Mechanical accuracy of the writing.", ar: "الدقة الإملائية وعلامات الترقيم." } },
];

const SPEAKING_CRIT: Def[] = [
  { term: { en: "Fluency", ar: "الطلاقة" }, desc: { en: "Smoothness and pace of speech without undue hesitation.", ar: "انسيابية الحديث وإيقاعه دون تردد مفرط." } },
  { term: { en: "Coherence", ar: "الترابط" }, desc: { en: "Logical sequencing and connection of ideas when speaking.", ar: "تسلسل الأفكار وربطها أثناء الحديث." } },
  { term: { en: "Lexical resource", ar: "الثروة اللغوية" }, desc: { en: "Range and precision of spoken vocabulary.", ar: "اتساع المفردات المنطوقة ودقتها." } },
  { term: { en: "Grammar range & accuracy", ar: "القواعد ودقتها" }, desc: { en: "Variety and correctness of structures in speech.", ar: "تنوّع التراكيب وصحتها في الحديث." } },
  { term: { en: "Pronunciation", ar: "النطق" }, desc: { en: "Clarity of sounds, stress and intonation (acoustic where available).", ar: "وضوح الأصوات والنبر والتنغيم (صوتيًا عند توفره)." } },
];

function Group({ heading, items, ar }: { heading: string; items: Def[]; ar: boolean }) {
  return (
    <div>
      <p className="mt-2 text-xs font-semibold text-primary">{heading}</p>
      <dl className="mt-1 space-y-1">
        {items.map((d) => (
          <div key={d.term.en} className="text-xs leading-relaxed">
            <dt className="inline font-medium text-[#111232]">{ar ? d.term.ar : d.term.en}: </dt>
            <dd className="inline text-slate-500">{ar ? d.desc.ar : d.desc.en}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FluentDefinitions({ ar }: { ar: boolean }) {
  return (
    <details className="rounded-xl border bg-white p-5 shadow-sm" dir={ar ? "rtl" : "ltr"}>
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        {ar ? "ما الذي نقيسه (التعريفات)" : "What we measure (definitions)"}
      </summary>
      <div className="mt-3 space-y-3">
        <Group heading={ar ? "المهارات الأربع" : "The four skills"} items={SKILLS} ar={ar} />
        <Group heading={ar ? "معايير الكتابة" : "Writing criteria"} items={WRITING_CRIT} ar={ar} />
        <Group heading={ar ? "معايير التحدث" : "Speaking criteria"} items={SPEAKING_CRIT} ar={ar} />
      </div>
    </details>
  );
}
