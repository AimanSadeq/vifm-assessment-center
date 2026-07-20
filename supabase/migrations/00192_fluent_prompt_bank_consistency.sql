-- Align the live Fluent prompt bank (eng_fluent_items) so each prompt's stated
-- word/second count matches its min_words / min_seconds - mirroring the corrected
-- code seed (fluent-prompt-seed.ts). The trial saw three different numbers on one
-- writing screen (prompt "80" / counter "min 70" / guidance "70-90") and a
-- speaking prompt say "45s" while the counter said "/40s". These UPDATEs widen the
-- prompt's single count to the band [min, min+20] and fix the 45/40 mismatch.
-- Matched by the old prompt text, so this is a no-op once run / on a fresh bank.

-- ── Writing: state the band [min_words, min_words+20] ──
UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 50 words','about 50-70 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 50 كلمة','نحو 50-70 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 50 words%';

UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 60 words','about 50-70 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 60 كلمة','نحو 50-70 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 60 words%';

UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 80 words','about 70-90 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 80 كلمة','نحو 70-90 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 80 words%';

UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 90 words','about 90-110 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 90 كلمة','نحو 90-110 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 90 words%';

UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 100 words','about 90-110 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 100 كلمة','نحو 90-110 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 100 words%';

UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 130 words','about 120-140 words'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','نحو 130 كلمة','نحو 120-140 كلمة')))
WHERE stem->>'prompt_en' LIKE '%about 130 words%';

-- ── Speaking: prompt seconds == min_seconds ──
-- B1 items were min_seconds 40 but the prompt said "45 seconds": set min to 45.
-- Scoped to rows whose prompt ALREADY says 45s, so a genuine future "40 seconds"
-- item is never silently bumped to 45 (which would re-create the mismatch).
UPDATE eng_fluent_items SET stem = jsonb_set(stem, '{min_seconds}', '45'::jsonb)
WHERE stem->>'min_seconds' = '40' AND stem->>'prompt_en' LIKE '%about 45 seconds%';

-- A B2 item's prompt said "50 seconds" but min_seconds is 45: match the prompt to 45.
UPDATE eng_fluent_items SET stem = jsonb_set(jsonb_set(stem,
  '{prompt_en}', to_jsonb(replace(stem->>'prompt_en','about 50 seconds','about 45 seconds'))),
  '{prompt_ar}', to_jsonb(replace(stem->>'prompt_ar','لمدة 50 ثانية','لمدة 45 ثانية')))
WHERE stem->>'prompt_en' LIKE '%about 50 seconds%';
