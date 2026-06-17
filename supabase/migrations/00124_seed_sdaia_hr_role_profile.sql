-- ════════════════════════════════════════════════════════════════
-- 00124 - Starter role profile: SDAIA HR / Talent Acquisition Specialist
--
-- A starter behavioural success profile for the SDAIA Talent-Acquisition
-- pilot (Pilot 1). Gives the Persona hiring picker a credible, SDAIA-relevant
-- target role (the seeded library is otherwise banking-only). 12 competencies
-- from the VIFM 41-competency framework, weighted + prioritised, with a target
-- proficiency per competency (00097). EDIT in Admin -> Role Profiles to match
-- the actual job description before going live.
--
-- competency rows join by NAME to the live competencies catalogue, so any name
-- mismatch is skipped rather than failing. Idempotent (ON CONFLICT DO NOTHING);
-- a fixed id lets a re-run no-op and lets the competency insert reference it.
-- ════════════════════════════════════════════════════════════════

INSERT INTO role_profiles (
  id, organization_id, name_en, name_ar, description, target_role,
  industry, region, default_target_proficiency
)
VALUES (
  '00000002-aaaa-0000-0000-000000000001',
  NULL,
  'SDAIA - HR / Talent Acquisition Specialist',
  'أخصائي الموارد البشرية / استقطاب المواهب (هيئة سدايا)',
  'Starter behavioural success profile for an HR / Talent Acquisition role (SDAIA TA pilot). Edit the competencies, weights and targets to fit the actual job description.',
  'HR / Talent Acquisition Specialist',
  'government',
  'saudi',
  3.5
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_profile_competencies (
  role_profile_id, competency_id, weight, priority, target_proficiency, reasoning
)
SELECT '00000002-aaaa-0000-0000-000000000001', c.id, v.weight, v.priority::text, v.target, v.reasoning
FROM (VALUES
  ('Clear & Adaptive Communication', 3.0, 'high',   4.0, 'Core to HR - clear, audience-tuned communication with candidates, managers and leadership.'),
  ('Trust & Credibility',            3.0, 'high',   4.0, 'HR is a trust-based function handling sensitive people decisions and data.'),
  ('Ethical Conduct',                3.0, 'high',   4.0, 'Fair, defensible, confidential handling of selection - critical for a government authority.'),
  ('Sound Judgement',                3.0, 'high',   4.0, 'Quality of shortlisting and selection decisions.'),
  ('Stakeholder Management',         3.0, 'high',   4.0, 'Partners with hiring managers and leaders to define and fill roles.'),
  ('Relationship Networks',          3.0, 'high',   4.0, 'Sources talent and builds internal + external hiring networks.'),
  ('Coaching & Talent Growth',       2.0, 'medium', 3.5, 'Develops talent and supports managers in growing their people.'),
  ('Cultural & Inclusive Sensitivity', 2.0, 'medium', 3.5, 'Inclusive, Saudization-aware hiring across a diverse workforce.'),
  ('Emotional Regulation & Empathy', 2.0, 'medium', 3.5, 'Reads people well and stays composed through interviews and difficult conversations.'),
  ('Customer Orientation',           2.0, 'medium', 3.5, 'Strong candidate and internal-client experience.'),
  ('Digital & Data Fluency',         2.0, 'medium', 3.5, 'HR analytics and tooling - fits an AI-authority context.'),
  ('Planning & Prioritisation',      2.0, 'medium', 3.5, 'Manages multiple open requisitions to timeline.')
) AS v(cname, weight, priority, target, reasoning)
JOIN competencies c ON c.name = v.cname
ON CONFLICT (role_profile_id, competency_id) DO NOTHING;
