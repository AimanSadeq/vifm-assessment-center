-- ============================================================
-- Caliber — competency catalogue coverage check
-- Paste into Supabase → SQL Editor and run.
-- ============================================================

-- QUERY 1 — All 38 competencies + how many ACTIVE courses are tagged
-- to each. Any row with active_courses = 0 is a coverage gap.
select
  cl.name as cluster,
  c.name  as competency,
  count(t.course_id) filter (where co.is_active) as active_courses
from competencies c
join competency_clusters cl on cl.id = c.cluster_id
left join vifm_course_competency_tags t on t.competency_id = c.id
left join vifm_courses co on co.id = t.course_id
group by cl.sort_order, cl.name, c.sort_order, c.name
order by cl.sort_order, c.sort_order;


-- QUERY 2 — Just the gaps: competencies with ZERO active courses.
-- No rows returned = full coverage.
select cl.name as cluster, c.name as competency
from competencies c
join competency_clusters cl on cl.id = c.cluster_id
where not exists (
  select 1
  from vifm_course_competency_tags t
  join vifm_courses co on co.id = t.course_id
  where t.competency_id = c.id and co.is_active = true
)
order by cl.sort_order, c.sort_order;
