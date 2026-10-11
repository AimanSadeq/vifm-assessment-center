-- Ali's Arabic edits (11 Oct 2026) to 5 figure_v1 data items. One transaction; guarded by the current Arabic stem.
BEGIN;
CREATE TEMP TABLE ar_fix (replaces text PRIMARY KEY, old_ar text, new_ar text, figure jsonb) ON COMMIT DROP;
INSERT INTO ar_fix VALUES
  ('aa80f9a3-ed9b-467d-8c27-f0c75d1917bd', 'يوضّح المخطط درجة الحرارة العليا في أربعة أيام. ما أعلى درجة حرارة سُجّلت؟', 'يوضّح المخطط درجة الحرارة العظمى في أربعة أيام. ما أعلى درجة حرارة سُجّلت؟', '{"kind":"data","style":"bar","title_en":"High temperature (°C)","title_ar":"درجة الحرارة العظمى (درجة مئوية)","label_head_en":"Day","label_head_ar":"اليوم","rows":[{"label_en":"Monday","label_ar":"الاثنين","value":22},{"label_en":"Tuesday","label_ar":"الثلاثاء","value":19},{"label_en":"Wednesday","label_ar":"الأربعاء","value":25},{"label_en":"Thursday","label_ar":"الخميس","value":21}],"replaces":"aa80f9a3-ed9b-467d-8c27-f0c75d1917bd"}'::jsonb),
  ('64e6a11d-6e1c-4a59-990a-719961bb8a2a', 'يوضّح المخطط كمية الأمطار اليومية على مدى أربعة أيام. في كم يوم كانت كمية الأمطار 6 مم بالضبط؟', 'يوضّح المخطط كمية الأمطار اليومية على مدى أربعة أيام. خلال كم يوم بلغت كمية الأمطار 6 ملم بالضبط؟', '{"kind":"data","style":"bar","title_en":"Daily rainfall (mm)","title_ar":"كمية الأمطار اليومية (ملم)","label_head_en":"Day","label_head_ar":"اليوم","rows":[{"label_en":"Day 1","label_ar":"اليوم 1","value":6},{"label_en":"Day 2","label_ar":"اليوم 2","value":6},{"label_en":"Day 3","label_ar":"اليوم 3","value":9},{"label_en":"Day 4","label_ar":"اليوم 4","value":3}],"replaces":"64e6a11d-6e1c-4a59-990a-719961bb8a2a"}'::jsonb),
  ('b6c4aaf6-151d-4a2a-8659-63b586309d46', 'يوضّح الجدول أزمنة عدّاء في أربع لفّات. بكم كانت أبطأ لفة أبطأ من متوسط زمن اللفة؟', 'يوضّح الجدول أزمنة عدّاء في أربع لفّات. كم ثانية يزيد زمن أبطأ لفة عن متوسط زمن اللفات الأربع؟', '{"kind":"data","style":"table","title_en":"Time (seconds)","title_ar":"الزمن (ثانية)","label_head_en":"Lap","label_head_ar":"اللفة","rows":[{"label_en":"Lap 1","label_ar":"اللفة 1","value":65},{"label_en":"Lap 2","label_ar":"اللفة 2","value":70},{"label_en":"Lap 3","label_ar":"اللفة 3","value":60},{"label_en":"Lap 4","label_ar":"اللفة 4","value":69}],"replaces":"b6c4aaf6-151d-4a2a-8659-63b586309d46"}'::jsonb),
  ('043892e7-550d-412c-ae35-abe0e5a12ade', 'يوضّح الجدول طول أربعة مسارات. يمشي متنزّه المسارات أ وج ود. ما المسافة الإجمالية المقطوعة؟', 'يوضّح الجدول طول أربعة مسارات. سار أحد المتنزهين في المسارات أ وج ود. ما إجمالي المسافة التي قطعها؟', '{"kind":"data","style":"table","title_en":"Length (km)","title_ar":"الطول (كم)","label_head_en":"Trail","label_head_ar":"المسار","rows":[{"label_en":"Trail A","label_ar":"المسار أ","value":3.5},{"label_en":"Trail B","label_ar":"المسار ب","value":4.2},{"label_en":"Trail C","label_ar":"المسار ج","value":2.8},{"label_en":"Trail D","label_ar":"المسار د","value":5.5}],"replaces":"043892e7-550d-412c-ae35-abe0e5a12ade"}'::jsonb),
  ('4f4c1ee7-03db-4f94-b8f2-2ca071e2eeb7', 'يوضّح المخطط المسافة المقطوعة مشياً كل يوم. كم كانت المسافة المقطوعة يوم الخميس أكثر منها يوم الاثنين؟', 'يوضّح المخطط المسافة المقطوعة مشياً كل يوم. بكم كيلومتر زادت المسافة المقطوعة يوم الخميس مقارنةً بيوم الاثنين؟', '{"kind":"data","style":"bar","title_en":"Distance walked (km)","title_ar":"المسافة المقطوعة (كم)","label_head_en":"Day","label_head_ar":"اليوم","rows":[{"label_en":"Monday","label_ar":"الاثنين","value":4},{"label_en":"Tuesday","label_ar":"الثلاثاء","value":7},{"label_en":"Wednesday","label_ar":"الأربعاء","value":5},{"label_en":"Thursday","label_ar":"الخميس","value":8}],"replaces":"4f4c1ee7-03db-4f94-b8f2-2ca071e2eeb7"}'::jsonb);
DO $$
BEGIN
  IF (SELECT count(*) FROM psy_items p JOIN ar_fix f ON p.figure->>'replaces' = f.replaces
      WHERE p.source = 'figure_v1' AND p.stem_ar = f.old_ar) <> 5 THEN
    RAISE EXCEPTION 'expected 5 figure_v1 items with the reviewed Arabic stems';
  END IF;
END $$;
UPDATE psy_items p SET stem_ar = f.new_ar, figure = f.figure, ar_reviewed = true
FROM ar_fix f WHERE p.source = 'figure_v1' AND p.figure->>'replaces' = f.replaces;
-- Ali reviewed all 11 Arabic data and shapes items; the other six needed no change.
UPDATE psy_items SET ar_reviewed = true
WHERE source = 'figure_v1' AND (facet = 'num_data' OR figure->>'replaces' = '667bd222-2b8e-4348-8cfb-84ba4edaad60');
COMMIT;
