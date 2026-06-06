// VIFM Psychometrics — IPIP-50 (International Personality Item Pool, 50-item
// Big-Five Factor Markers; Goldberg, 1992). Public domain. 10 items per factor
// vs the Mini-IPIP's 4 → materially higher internal-consistency reliability, so
// this is the "longer validated form" for the personality bank.
//
// `reverse` is keyed to OUR scale direction (high score = more of the trait). The
// IPIP measures Neuroticism (N); we store Emotional Stability (S), so N+ items are
// reverse for S and N− items are forward.
//
// The SME seeds these into the bank as APPROVED psy_items via the console, after
// which bank-driven assembly serves the 50-item form and the response log makes
// each item calibratable. Arabic is best-effort MSA — human-review before live use
// (project convention for all Arabic content).

import type { IpipItem } from "./framework";

export const IPIP_50: IpipItem[] = [
  // ── Extraversion (E) ──
  { scale: "E", text_en: "Am the life of the party.", text_ar: "أنا محور الحياة في المناسبات.", reverse: false },
  { scale: "E", text_en: "Don't talk a lot.", text_ar: "لا أتحدّث كثيرًا.", reverse: true },
  { scale: "E", text_en: "Feel comfortable around people.", text_ar: "أشعر بالارتياح بين الناس.", reverse: false },
  { scale: "E", text_en: "Keep in the background.", text_ar: "أُفضّل البقاء في الخلفية.", reverse: true },
  { scale: "E", text_en: "Start conversations.", text_ar: "أبادر ببدء المحادثات.", reverse: false },
  { scale: "E", text_en: "Have little to say.", text_ar: "ليس لديّ الكثير لأقوله.", reverse: true },
  { scale: "E", text_en: "Talk to a lot of different people at parties.", text_ar: "أتحدّث مع كثير من الناس في المناسبات.", reverse: false },
  { scale: "E", text_en: "Don't like to draw attention to myself.", text_ar: "لا أحبّ لفت الانتباه إليّ.", reverse: true },
  { scale: "E", text_en: "Don't mind being the center of attention.", text_ar: "لا أمانع أن أكون محطّ الأنظار.", reverse: false },
  { scale: "E", text_en: "Am quiet around strangers.", text_ar: "أكون هادئًا بين الغرباء.", reverse: true },

  // ── Agreeableness (A) ──
  { scale: "A", text_en: "Feel little concern for others.", text_ar: "لا أكترث كثيرًا للآخرين.", reverse: true },
  { scale: "A", text_en: "Am interested in people.", text_ar: "أهتمّ بالناس.", reverse: false },
  { scale: "A", text_en: "Insult people.", text_ar: "أُهين الناس.", reverse: true },
  { scale: "A", text_en: "Sympathize with others' feelings.", text_ar: "أتعاطف مع مشاعر الآخرين.", reverse: false },
  { scale: "A", text_en: "Am not interested in other people's problems.", text_ar: "لا تعنيني مشكلات الآخرين.", reverse: true },
  { scale: "A", text_en: "Have a soft heart.", text_ar: "قلبي رحيم.", reverse: false },
  { scale: "A", text_en: "Am not really interested in others.", text_ar: "لا أهتمّ حقًّا بالآخرين.", reverse: true },
  { scale: "A", text_en: "Take time out for others.", text_ar: "أُخصّص وقتًا للآخرين.", reverse: false },
  { scale: "A", text_en: "Feel others' emotions.", text_ar: "أشعر بمشاعر الآخرين.", reverse: false },
  { scale: "A", text_en: "Make people feel at ease.", text_ar: "أجعل الناس يشعرون بالارتياح.", reverse: false },

  // ── Conscientiousness (C) ──
  { scale: "C", text_en: "Am always prepared.", text_ar: "أكون دائمًا مستعدًّا.", reverse: false },
  { scale: "C", text_en: "Leave my belongings around.", text_ar: "أترك أغراضي مبعثرة.", reverse: true },
  { scale: "C", text_en: "Pay attention to details.", text_ar: "أُولي التفاصيل اهتمامًا.", reverse: false },
  { scale: "C", text_en: "Make a mess of things.", text_ar: "أتسبّب في الفوضى.", reverse: true },
  { scale: "C", text_en: "Get chores done right away.", text_ar: "أُنجز المهام فورًا.", reverse: false },
  { scale: "C", text_en: "Often forget to put things back in their proper place.", text_ar: "كثيرًا ما أنسى إعادة الأشياء إلى أماكنها.", reverse: true },
  { scale: "C", text_en: "Like order.", text_ar: "أحبّ النظام.", reverse: false },
  { scale: "C", text_en: "Shirk my duties.", text_ar: "أتهرّب من واجباتي.", reverse: true },
  { scale: "C", text_en: "Follow a schedule.", text_ar: "ألتزم بجدول.", reverse: false },
  { scale: "C", text_en: "Am exacting in my work.", text_ar: "أكون دقيقًا في عملي.", reverse: false },

  // ── Emotional Stability (S) — IPIP Neuroticism, keyed for stability ──
  { scale: "S", text_en: "Get stressed out easily.", text_ar: "أتوتّر بسهولة.", reverse: true },
  { scale: "S", text_en: "Am relaxed most of the time.", text_ar: "أكون مسترخيًا معظم الوقت.", reverse: false },
  { scale: "S", text_en: "Worry about things.", text_ar: "أقلق بشأن الأمور.", reverse: true },
  { scale: "S", text_en: "Seldom feel blue.", text_ar: "نادرًا ما أشعر بالحزن.", reverse: false },
  { scale: "S", text_en: "Am easily disturbed.", text_ar: "أنزعج بسهولة.", reverse: true },
  { scale: "S", text_en: "Get upset easily.", text_ar: "أنفعل بسهولة.", reverse: true },
  { scale: "S", text_en: "Change my mood a lot.", text_ar: "يتغيّر مزاجي كثيرًا.", reverse: true },
  { scale: "S", text_en: "Have frequent mood swings.", text_ar: "تتقلّب حالتي المزاجية كثيرًا.", reverse: true },
  { scale: "S", text_en: "Get irritated easily.", text_ar: "أتضايق بسهولة.", reverse: true },
  { scale: "S", text_en: "Often feel blue.", text_ar: "كثيرًا ما أشعر بالحزن.", reverse: true },

  // ── Openness / Intellect (O) ──
  { scale: "O", text_en: "Have a rich vocabulary.", text_ar: "أمتلك حصيلة لغوية غنية.", reverse: false },
  { scale: "O", text_en: "Have difficulty understanding abstract ideas.", text_ar: "أجد صعوبة في فهم الأفكار المجرّدة.", reverse: true },
  { scale: "O", text_en: "Have a vivid imagination.", text_ar: "لديّ خيال واسع.", reverse: false },
  { scale: "O", text_en: "Am not interested in abstract ideas.", text_ar: "لا تعنيني الأفكار المجرّدة.", reverse: true },
  { scale: "O", text_en: "Have excellent ideas.", text_ar: "لديّ أفكار ممتازة.", reverse: false },
  { scale: "O", text_en: "Do not have a good imagination.", text_ar: "ليس لديّ خيال جيّد.", reverse: true },
  { scale: "O", text_en: "Am quick to understand things.", text_ar: "أفهم الأمور بسرعة.", reverse: false },
  { scale: "O", text_en: "Use difficult words.", text_ar: "أستخدم كلمات صعبة.", reverse: false },
  { scale: "O", text_en: "Spend time reflecting on things.", text_ar: "أقضي وقتًا في التأمّل في الأمور.", reverse: false },
  { scale: "O", text_en: "Am full of ideas.", text_ar: "أنا مليء بالأفكار.", reverse: false },
];
