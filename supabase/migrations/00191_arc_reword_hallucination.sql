-- Reword the two ARC individual-snapshot items that used "hallucinating".
-- Trial review (Omar): the word implies cognitive ability / emotions and is
-- inaccurate for an AI system. Reworded to neutral, behaviourally-clear language
-- ("fabricating information / confident but false claims") in EN + AR. Matched by
-- the distinctive text so it applies across any bank version and is a no-op once
-- run (the old wording no longer matches). Original seeds: 00026 (Q102 self-
-- rating) + 00081 (Q303 knowledge-check).

-- 1. Self-rating item (AI Sense-Check).
UPDATE ara_questions
SET
  question_text_en = 'I can recognise when an AI tool is fabricating information - producing confident, plausible-sounding claims that are actually false.',
  question_text_ar = 'أستطيع التعرف على متى تُنتج أداة الذكاء الاصطناعي معلومات ملفقة أو غير صحيحة تبدو معقولة.'
WHERE question_text_en LIKE '%is hallucinating or fabricating%';

-- 2. Knowledge-check item (AI Sense-Check).
UPDATE ara_questions
SET
  question_text_en = 'Which of these is the clearest sign that an AI chatbot may be fabricating information (a confident but false claim)?',
  question_text_ar = 'أي مما يلي هو أوضح علامة على أن روبوت الدردشة قد يختلق المعلومات؟'
WHERE question_text_en LIKE '%clearest sign that an AI chatbot may be hallucinating%';
