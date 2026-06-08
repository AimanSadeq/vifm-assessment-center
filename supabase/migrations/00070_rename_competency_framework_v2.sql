-- ============================================================
-- VIFM Assessment Center — Competency Framework v2 rename
-- Migration 00070
--
-- Re-authors the 8 cluster names and all 38 competency names +
-- descriptions to the original, research-grounded v2 set (see
-- docs/competency-framework-v2-design.md). The 4 domains
-- (THINKING/RESULTS/PEOPLE/SELF) are UNCHANGED.
--
-- SAFETY:
--  * Renames are done BY UUID (ids from 00002 are stable), so every
--    foreign key — construct_competency_links, psychometrics links,
--    ac_competency_validation_evidence, evidence map, etc. — keeps
--    pointing at the same rows. No FK remap needed.
--  * Name-join seed migrations (00054, 00066) and the Reflect
--    alignment (00034) run EARLIER than 00070, so on a fresh
--    `db reset` they still match the old names (present at that point)
--    and create their links by id BEFORE this rename runs.
--  * Reflect 360 template competencies were aligned to the OLD AC
--    names by 00034; we re-point those 5 here so the course-recommender
--    bridge keeps resolving.
--  * Idempotent: UPDATE-by-id is safe to re-run; the Reflect
--    WHERE name_en = '<old>' clauses simply no-op once renamed.
-- ============================================================

-- ── Clusters (by UUID; domains unchanged) ───────────────────
UPDATE competency_clusters SET name = 'Strategic & Commercial Reasoning'   WHERE id = 'c1000001-0000-0000-0000-000000000001';
UPDATE competency_clusters SET name = 'Innovation & Complexity'            WHERE id = 'c1000001-0000-0000-0000-000000000002';
UPDATE competency_clusters SET name = 'Delivery & Execution'              WHERE id = 'c1000001-0000-0000-0000-000000000003';
UPDATE competency_clusters SET name = 'Adaptability & Change'             WHERE id = 'c1000001-0000-0000-0000-000000000004';
UPDATE competency_clusters SET name = 'Influence & Communication'         WHERE id = 'c1000001-0000-0000-0000-000000000005';
UPDATE competency_clusters SET name = 'Leading & Developing Others'       WHERE id = 'c1000001-0000-0000-0000-000000000006';
UPDATE competency_clusters SET name = 'Integrity & Character'             WHERE id = 'c1000001-0000-0000-0000-000000000007';
UPDATE competency_clusters SET name = 'Growth & Personal Effectiveness'   WHERE id = 'c1000001-0000-0000-0000-000000000008';

-- ── Competencies (by UUID): name + description ──────────────
-- Cluster 1 — Strategic & Commercial Reasoning
UPDATE competencies SET name = 'Forward Strategy Setting',     description = 'Anticipates how markets, regulation, and client needs will shift, and converts that foresight into clear strategic direction.' WHERE id = 'a0000001-0000-0000-0000-000000000001';
UPDATE competencies SET name = 'Commercial & Market Awareness', description = 'Reads the competitive and economic landscape to spot opportunities and risks that advance organisational goals.' WHERE id = 'a0000001-0000-0000-0000-000000000002';
UPDATE competencies SET name = 'Financial Literacy & Acumen',  description = 'Interprets statements, ratios, and capital/liquidity indicators and uses them to weigh trade-offs and justify decisions.' WHERE id = 'a0000001-0000-0000-0000-000000000003';
UPDATE competencies SET name = 'Critical Analysis',            description = 'Breaks down ambiguous, data-heavy problems, tests assumptions, and weighs evidence to reach well-reasoned conclusions.' WHERE id = 'a0000001-0000-0000-0000-000000000004';
UPDATE competencies SET name = 'Sound Judgement',              description = 'Makes timely, balanced decisions under incomplete information, accounting for risk, stakeholders, and second-order consequences.' WHERE id = 'a0000001-0000-0000-0000-000000000005';

-- Cluster 2 — Innovation & Complexity
UPDATE competencies SET name = 'Creative Problem-Solving',     description = 'Generates and tests original approaches that improve products, processes, or outcomes rather than defaulting to precedent.' WHERE id = 'a0000001-0000-0000-0000-000000000006';
UPDATE competencies SET name = 'Navigating Complexity',        description = 'Makes sense of high-volume, interdependent, sometimes conflicting information to define and act on problems.' WHERE id = 'a0000001-0000-0000-0000-000000000007';
UPDATE competencies SET name = 'Systems & Global Perspective', description = 'Considers the wider system — cross-border, cross-function, macro-economic — when framing issues and weighing impact.' WHERE id = 'a0000001-0000-0000-0000-000000000008';
UPDATE competencies SET name = 'Digital & Data Fluency',       description = 'Applies digital tools, automation, and data analysis to improve how work gets done and decisions get made.' WHERE id = 'a0000001-0000-0000-0000-000000000009';

-- Cluster 3 — Delivery & Execution
UPDATE competencies SET name = 'Proactive Initiative',         description = 'Moves on opportunities and tough challenges early and with energy, rather than waiting to be directed.' WHERE id = 'a0000001-0000-0000-0000-000000000010';
UPDATE competencies SET name = 'Outcome Ownership',            description = 'Drives work through to measurable results, sustaining effort and standards even under difficult conditions.' WHERE id = 'a0000001-0000-0000-0000-000000000011';
UPDATE competencies SET name = 'Accountability for Commitments', description = 'Holds self and others to what was promised, following through transparently on deadlines and quality.' WHERE id = 'a0000001-0000-0000-0000-000000000012';
UPDATE competencies SET name = 'Planning & Prioritisation',    description = 'Sequences and resources work so the most important commitments are met in line with organisational goals.' WHERE id = 'a0000001-0000-0000-0000-000000000013';
UPDATE competencies SET name = 'Process Optimisation',         description = 'Designs and improves workflows for efficiency and control, with continuous improvement and without sacrificing compliance.' WHERE id = 'a0000001-0000-0000-0000-000000000014';

-- Cluster 4 — Adaptability & Change
UPDATE competencies SET name = 'Operating Through Uncertainty', description = 'Stays effective and decisive when direction, data, or conditions are unclear or shifting.' WHERE id = 'a0000001-0000-0000-0000-000000000015';
UPDATE competencies SET name = 'Learning by Doing',            description = 'Experiments when facing unfamiliar problems and adjusts quickly, treating both wins and failures as information.' WHERE id = 'a0000001-0000-0000-0000-000000000016';
UPDATE competencies SET name = 'Resilience Under Pressure',    description = 'Recovers from setbacks, sustained workload, and adversity while maintaining performance and composure.' WHERE id = 'a0000001-0000-0000-0000-000000000017';
UPDATE competencies SET name = 'Mobilising Around Purpose',    description = 'Articulates a compelling sense of direction that connects people''s work to a larger goal and motivates action.' WHERE id = 'a0000001-0000-0000-0000-000000000018';

-- Cluster 5 — Influence & Communication
UPDATE competencies SET name = 'Clear & Adaptive Communication', description = 'Conveys complex, strategic content clearly, tailoring message and mode to different audiences.' WHERE id = 'a0000001-0000-0000-0000-000000000019';
UPDATE competencies SET name = 'Persuasion & Buy-in',          description = 'Builds well-reasoned, audience-aware cases that win genuine support and commitment, not just compliance.' WHERE id = 'a0000001-0000-0000-0000-000000000020';
UPDATE competencies SET name = 'Constructive Conflict Handling', description = 'Surfaces and resolves disagreement directly and calmly, preserving relationships and momentum.' WHERE id = 'a0000001-0000-0000-0000-000000000021';
UPDATE competencies SET name = 'Principled Negotiation',       description = 'Reaches durable, mutually workable agreements through preparation, dialogue, and fair trade-offs.' WHERE id = 'a0000001-0000-0000-0000-000000000022';
UPDATE competencies SET name = 'Relationship Networks',        description = 'Builds and sustains useful internal and external relationships that create access, insight, and influence.' WHERE id = 'a0000001-0000-0000-0000-000000000023';

-- Cluster 6 — Leading & Developing Others
UPDATE competencies SET name = 'Coaching & Talent Growth',     description = 'Develops others toward their potential and the organisation''s needs through feedback, stretch, and support.' WHERE id = 'a0000001-0000-0000-0000-000000000024';
UPDATE competencies SET name = 'Building Cohesive Teams',      description = 'Forms teams with shared identity and purpose that combine diverse strengths to deliver together.' WHERE id = 'a0000001-0000-0000-0000-000000000025';
UPDATE competencies SET name = 'Cross-Functional Collaboration', description = 'Partners across units and disciplines to achieve shared objectives over local interests.' WHERE id = 'a0000001-0000-0000-0000-000000000026';
UPDATE competencies SET name = 'Trust & Credibility',          description = 'Earns confidence through honesty, consistency, and follow-through, becoming someone others rely on.' WHERE id = 'a0000001-0000-0000-0000-000000000027';
UPDATE competencies SET name = 'Interpersonal Adaptability',   description = 'Adjusts style and approach in the moment to fit the person and situation without losing authenticity.' WHERE id = 'a0000001-0000-0000-0000-000000000028';

-- Cluster 7 — Integrity & Character
UPDATE competencies SET name = 'Self-Insight',                 description = 'Uses feedback and reflection to understand own strengths, limits, and impact, and acts on that understanding.' WHERE id = 'a0000001-0000-0000-0000-000000000029';
UPDATE competencies SET name = 'Emotional Regulation & Empathy', description = 'Recognises and manages own emotions and reads others'', responding in ways that fit the situation.' WHERE id = 'a0000001-0000-0000-0000-000000000030';
UPDATE competencies SET name = 'Principled Courage',           description = 'Raises difficult issues and says what needs to be said, even at personal or political cost.' WHERE id = 'a0000001-0000-0000-0000-000000000031';
UPDATE competencies SET name = 'Ethical Conduct',              description = 'Acts honestly and fairly, within the spirit as well as the letter of professional and regulatory standards.' WHERE id = 'a0000001-0000-0000-0000-000000000032';
UPDATE competencies SET name = 'Cultural & Inclusive Sensitivity', description = 'Understands and respects diverse norms and perspectives, and works inclusively across them.' WHERE id = 'a0000001-0000-0000-0000-000000000033';

-- Cluster 8 — Growth & Personal Effectiveness
UPDATE competencies SET name = 'Adaptive Learning Capacity',   description = 'Learns rapidly from new and first-time situations and applies the lessons to perform in unfamiliar conditions.' WHERE id = 'a0000001-0000-0000-0000-000000000034';
UPDATE competencies SET name = 'Continuous Self-Development',  description = 'Actively seeks growth through formal and informal channels and applies it to raise own performance.' WHERE id = 'a0000001-0000-0000-0000-000000000035';
UPDATE competencies SET name = 'Composure Under Stress',       description = 'Stays calm, clear, and constructive when under pressure or scrutiny.' WHERE id = 'a0000001-0000-0000-0000-000000000036';
UPDATE competencies SET name = 'Sustainable Wellbeing',        description = 'Manages energy and the demands of work and life to sustain performance over time.' WHERE id = 'a0000001-0000-0000-0000-000000000037';
UPDATE competencies SET name = 'Resource Mobilisation',        description = 'Secures and deploys people, budget, and tools effectively to get work done.' WHERE id = 'a0000001-0000-0000-0000-000000000038';

-- ── Reflect 360 template: re-point the 5 names aligned by 00034 ──
-- (Old AC name → new AC name, so the course-recommender bridge keeps working.)
DO $b$
DECLARE
  v_framework_id uuid;
BEGIN
  SELECT id INTO v_framework_id
  FROM reflect_frameworks
  WHERE is_template = true AND name_en = 'VIFM Leadership Essentials'
  LIMIT 1;

  IF v_framework_id IS NULL THEN
    RAISE NOTICE 'VIFM Leadership Essentials template not found — skipping Reflect re-point.';
    RETURN;
  END IF;

  UPDATE reflect_competencies SET name_en = 'Mobilising Around Purpose',
    description_en = 'Articulates a compelling sense of direction that connects people''s work to a larger goal and motivates action.'
    WHERE framework_id = v_framework_id AND name_en = 'Drives Vision and Purpose';

  UPDATE reflect_competencies SET name_en = 'Outcome Ownership',
    description_en = 'Drives work through to measurable results, sustaining effort and standards even under difficult conditions.'
    WHERE framework_id = v_framework_id AND name_en = 'Drives Results';

  UPDATE reflect_competencies SET name_en = 'Building Cohesive Teams',
    description_en = 'Forms teams with shared identity and purpose that combine diverse strengths to deliver together.'
    WHERE framework_id = v_framework_id AND name_en = 'Builds Effective Teams';

  UPDATE reflect_competencies SET name_en = 'Clear & Adaptive Communication',
    description_en = 'Conveys complex, strategic content clearly, tailoring message and mode to different audiences.'
    WHERE framework_id = v_framework_id AND name_en = 'Communicates Effectively';

  UPDATE reflect_competencies SET name_en = 'Adaptive Learning Capacity',
    description_en = 'Learns rapidly from new and first-time situations and applies the lessons to perform in unfamiliar conditions.'
    WHERE framework_id = v_framework_id AND name_en = 'Learning Agility';
END
$b$;
