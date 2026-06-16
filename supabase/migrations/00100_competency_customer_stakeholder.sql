-- ============================================================
-- 00100 - 9th cluster: Customer & Stakeholder Focus
--
-- Extends the canonical framework (4 domains / 8 clusters / 38 competencies)
-- with a 9th cluster + 3 competencies, so self (Persona), others (Reflect 360)
-- and role profiles can all evaluate customer/stakeholder behaviours on the
-- SAME framework. Placed under the RESULTS domain (customer/stakeholder focus
-- is about delivering value and outcomes to external parties).
--
-- Deterministic UUIDs continue the seed scheme (00002) so they match the
-- Persona behavioural bank (behavioral-items.ts): cluster c1...009,
-- competencies a0...039 / 040 / 041.
--
-- Idempotent: ON CONFLICT on the deterministic ids; dev tips re-seeded.
-- ============================================================

-- Cluster (under RESULTS = d0000001-...0002)
INSERT INTO competency_clusters (id, domain_id, name, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000002', 'Customer & Stakeholder Focus', 9)
ON CONFLICT (id) DO NOTHING;

-- Competencies (39-41)
INSERT INTO competencies (id, cluster_id, name, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000039', 'c1000001-0000-0000-0000-000000000009', 'Customer Orientation',   'Understanding and anticipating customer needs and delivering exceptional, reliable service.', 1),
  ('a0000001-0000-0000-0000-000000000040', 'c1000001-0000-0000-0000-000000000009', 'Stakeholder Management', 'Identifying, aligning and managing internal and external stakeholders with tact and trust.', 2),
  ('a0000001-0000-0000-0000-000000000041', 'c1000001-0000-0000-0000-000000000009', 'Value Creation',         'Focusing on sustainable value - linking work to commercial outcomes and the business value chain.', 3)
ON CONFLICT (id) DO NOTHING;

-- Development tips (consumed by the readiness IDP via the '[DEV TIP] ' prefix).
-- Re-seeded for idempotency.
DELETE FROM behavioral_indicators
  WHERE competency_id IN (
    'a0000001-0000-0000-0000-000000000039',
    'a0000001-0000-0000-0000-000000000040',
    'a0000001-0000-0000-0000-000000000041')
  AND indicator_type = 'positive'
  AND description LIKE '[DEV TIP]%';

INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000039', 'positive', '[DEV TIP] Schedule regular touchpoints with customers to surface needs early.', 1),
  ('a0000001-0000-0000-0000-000000000039', 'positive', '[DEV TIP] Close the loop - tell customers what changed because of their feedback.', 2),
  ('a0000001-0000-0000-0000-000000000039', 'positive', '[DEV TIP] Define service standards for your team and review them against customer outcomes.', 3),
  ('a0000001-0000-0000-0000-000000000040', 'positive', '[DEV TIP] Build a simple stakeholder map (influence vs interest) and refresh it each quarter.', 1),
  ('a0000001-0000-0000-0000-000000000040', 'positive', '[DEV TIP] Send a short, regular progress-and-risks update to key stakeholders.', 2),
  ('a0000001-0000-0000-0000-000000000040', 'positive', '[DEV TIP] Address tension early with a direct, solution-focused conversation.', 3),
  ('a0000001-0000-0000-0000-000000000041', 'positive', '[DEV TIP] Tie each major initiative to a measurable commercial or customer outcome.', 1),
  ('a0000001-0000-0000-0000-000000000041', 'positive', '[DEV TIP] Pressure-test ideas for long-term value, not just immediate wins.', 2),
  ('a0000001-0000-0000-0000-000000000041', 'positive', '[DEV TIP] Quantify and share the impact of your work in business terms.', 3);
