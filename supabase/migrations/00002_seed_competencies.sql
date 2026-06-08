-- ============================================================
-- VIFM Assessment Center - Seed: Competency Framework
-- 4 Domains → 8 Clusters → 38 Competencies
-- Source: VIFM Assessment Center Blueprint (Section 3.2)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DOMAINS
-- ────────────────────────────────────────────────────────────

INSERT INTO competency_domains (id, name, sort_order) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'THINKING', 1),
  ('d0000001-0000-0000-0000-000000000002', 'RESULTS',  2),
  ('d0000001-0000-0000-0000-000000000003', 'PEOPLE',   3),
  ('d0000001-0000-0000-0000-000000000004', 'SELF',     4);


-- ────────────────────────────────────────────────────────────
-- CLUSTERS
-- ────────────────────────────────────────────────────────────

-- THINKING domain
INSERT INTO competency_clusters (id, domain_id, name, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'Strategic Thinking', 1),
  ('c1000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 'Innovation',         2);

-- RESULTS domain
INSERT INTO competency_clusters (id, domain_id, name, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000002', 'Execution', 3),
  ('c1000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000002', 'Change',    4);

-- PEOPLE domain
INSERT INTO competency_clusters (id, domain_id, name, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000003', 'Influence',       5),
  ('c1000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000003', 'Team Leadership', 6);

-- SELF domain
INSERT INTO competency_clusters (id, domain_id, name, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000004', 'Character',              7),
  ('c1000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000004', 'Personal Effectiveness', 8);


-- ────────────────────────────────────────────────────────────
-- COMPETENCIES (38 total)
-- ────────────────────────────────────────────────────────────

-- Cluster: Strategic Thinking (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'Strategic Mindset',     'Seeing ahead to future possibilities and translating them into breakthrough strategies.', 1),
  ('a0000001-0000-0000-0000-000000000002', 'c1000001-0000-0000-0000-000000000001', 'Business Insight',      'Applying knowledge of business and the marketplace to advance the organization''s goals.', 2),
  ('a0000001-0000-0000-0000-000000000003', 'c1000001-0000-0000-0000-000000000001', 'Financial Acumen',      'Interpreting and applying understanding of key financial indicators to make better business decisions.', 3),
  ('a0000001-0000-0000-0000-000000000004', 'c1000001-0000-0000-0000-000000000001', 'Analytical Reasoning',  'Identifying and understanding complex issues; reviewing related information to develop and evaluate options and implement solutions.', 4),
  ('a0000001-0000-0000-0000-000000000005', 'c1000001-0000-0000-0000-000000000001', 'Decision Quality',      'Making good and timely decisions that keep the organization moving forward.', 5);

-- Cluster: Innovation (4 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000006', 'c1000001-0000-0000-0000-000000000002', 'Cultivates Innovation', 'Creating new and better ways for the organization to be successful.', 1),
  ('a0000001-0000-0000-0000-000000000007', 'c1000001-0000-0000-0000-000000000002', 'Manages Complexity',    'Making sense of complex, high-quantity, and sometimes contradictory information to effectively solve problems.', 2),
  ('a0000001-0000-0000-0000-000000000008', 'c1000001-0000-0000-0000-000000000002', 'Global Perspective',    'Taking a broad view when approaching issues; using a global lens.', 3),
  ('a0000001-0000-0000-0000-000000000009', 'c1000001-0000-0000-0000-000000000002', 'Digital Fluency',       'Leveraging digital technologies, tools, and data to drive business outcomes.', 4);

-- Cluster: Execution (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000010', 'c1000001-0000-0000-0000-000000000003', 'Action Oriented',       'Taking on new opportunities and tough challenges with a sense of urgency, high energy, and enthusiasm.', 1),
  ('a0000001-0000-0000-0000-000000000011', 'c1000001-0000-0000-0000-000000000003', 'Drives Results',        'Consistently achieving results, even under tough circumstances.', 2),
  ('a0000001-0000-0000-0000-000000000012', 'c1000001-0000-0000-0000-000000000003', 'Ensures Accountability','Holding self and others accountable to meet commitments.', 3),
  ('a0000001-0000-0000-0000-000000000013', 'c1000001-0000-0000-0000-000000000003', 'Plans and Aligns',      'Planning and prioritizing work to meet commitments aligned with organizational goals.', 4),
  ('a0000001-0000-0000-0000-000000000014', 'c1000001-0000-0000-0000-000000000003', 'Optimizes Processes',   'Knowing the most effective and efficient processes to get things done, with a focus on continuous improvement.', 5);

-- Cluster: Change (4 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000015', 'c1000001-0000-0000-0000-000000000004', 'Manages Ambiguity',        'Operating effectively, even when things are not certain or the way forward is not clear.', 1),
  ('a0000001-0000-0000-0000-000000000016', 'c1000001-0000-0000-0000-000000000004', 'Nimble Learning',          'Learning through experimentation when tackling new problems, using both successes and failures as learning fodder.', 2),
  ('a0000001-0000-0000-0000-000000000017', 'c1000001-0000-0000-0000-000000000004', 'Being Resilient',          'Rebounding from setbacks and adversity when facing difficult situations.', 3),
  ('a0000001-0000-0000-0000-000000000018', 'c1000001-0000-0000-0000-000000000004', 'Drives Vision and Purpose','Painting a compelling picture of the vision and strategy that motivates others to action.', 4);

-- Cluster: Influence (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000019', 'c1000001-0000-0000-0000-000000000005', 'Communicates Effectively', 'Developing and delivering multi-mode communications that convey a clear understanding of the unique needs of different audiences.', 1),
  ('a0000001-0000-0000-0000-000000000020', 'c1000001-0000-0000-0000-000000000005', 'Persuades',                'Using compelling arguments to gain the support and commitment of others.', 2),
  ('a0000001-0000-0000-0000-000000000021', 'c1000001-0000-0000-0000-000000000005', 'Manages Conflict',         'Handling conflict situations effectively, with a minimum of noise.', 3),
  ('a0000001-0000-0000-0000-000000000022', 'c1000001-0000-0000-0000-000000000005', 'Negotiation',              'Achieving mutually beneficial agreements through dialogue and compromise.', 4),
  ('a0000001-0000-0000-0000-000000000023', 'c1000001-0000-0000-0000-000000000005', 'Builds Networks',          'Effectively building formal and informal relationship networks inside and outside the organization.', 5);

-- Cluster: Team Leadership (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000024', 'c1000001-0000-0000-0000-000000000006', 'Develops Talent',          'Developing people to meet both their career goals and the organization''s goals.', 1),
  ('a0000001-0000-0000-0000-000000000025', 'c1000001-0000-0000-0000-000000000006', 'Builds Effective Teams',   'Building strong-identity teams that apply their diverse skills and perspectives to achieve common goals.', 2),
  ('a0000001-0000-0000-0000-000000000026', 'c1000001-0000-0000-0000-000000000006', 'Collaboration',            'Building partnerships and working collaboratively with others to meet shared objectives.', 3),
  ('a0000001-0000-0000-0000-000000000027', 'c1000001-0000-0000-0000-000000000006', 'Instills Trust',           'Gaining the confidence and trust of others through honesty, integrity, and authenticity.', 4),
  ('a0000001-0000-0000-0000-000000000028', 'c1000001-0000-0000-0000-000000000006', 'Situational Adaptability', 'Adapting approach and demeanor in real time to match the shifting demands of different situations.', 5);

-- Cluster: Character (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000029', 'c1000001-0000-0000-0000-000000000007', 'Self-Awareness',           'Using a combination of feedback and reflection to gain productive insight into personal strengths and weaknesses.', 1),
  ('a0000001-0000-0000-0000-000000000030', 'c1000001-0000-0000-0000-000000000007', 'Emotional Intelligence',   'Recognizing, understanding, and managing one''s own emotions and those of others.', 2),
  ('a0000001-0000-0000-0000-000000000031', 'c1000001-0000-0000-0000-000000000007', 'Courage',                  'Stepping up to address difficult issues, saying what needs to be said.', 3),
  ('a0000001-0000-0000-0000-000000000032', 'c1000001-0000-0000-0000-000000000007', 'Integrity',                'Consistently behaving in an honest, fair, and ethical manner.', 4),
  ('a0000001-0000-0000-0000-000000000033', 'c1000001-0000-0000-0000-000000000007', 'Cultural Sensitivity',     'Understanding and respecting diverse cultural norms, values, and practices.', 5);

-- Cluster: Personal Effectiveness (5 competencies)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000034', 'c1000001-0000-0000-0000-000000000008', 'Learning Agility',    'Quickly learning from experience and applying insights to perform successfully under new or first-time conditions.', 1),
  ('a0000001-0000-0000-0000-000000000035', 'c1000001-0000-0000-0000-000000000008', 'Self-Development',    'Actively seeking new ways to grow and be challenged using both formal and informal development channels.', 2),
  ('a0000001-0000-0000-0000-000000000036', 'c1000001-0000-0000-0000-000000000008', 'Composure',           'Being calm and composed under pressure, handling stress effectively.', 3),
  ('a0000001-0000-0000-0000-000000000037', 'c1000001-0000-0000-0000-000000000008', 'Work-Life Balance',   'Maintaining a healthy balance between work demands and personal life.', 4),
  ('a0000001-0000-0000-0000-000000000038', 'c1000001-0000-0000-0000-000000000008', 'Resourcefulness',     'Securing and deploying resources effectively and efficiently.', 5);
