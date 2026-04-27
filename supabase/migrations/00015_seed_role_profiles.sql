-- ============================================================
-- Seed: 6 ready-to-use Role Profiles for GCC banking + government
-- All entries use organization_id = NULL → visible globally to all
-- VIFM admins. Clients can clone or create org-scoped profiles.
-- ============================================================

-- Stable UUIDs so client code can reference them across environments.
INSERT INTO role_profiles (id, organization_id, name_en, name_ar, target_role, industry, region, default_target_proficiency, description) VALUES
  ('00000001-aaaa-0000-0000-000000000001', NULL, 'Branch Manager',          'مدير فرع',                  'Branch Manager',           'Banking',    'gcc', 4, 'Customer-facing branch leader running retail operations, sales targets, and a frontline team in GCC commercial banking.'),
  ('00000001-aaaa-0000-0000-000000000002', NULL, 'Compliance Officer',      'مسؤول الامتثال',            'Compliance Officer',       'Banking',    'gcc', 4, 'Second-line risk role monitoring AML/CFT, Basel III, and central bank rules. Investigates breaches and trains the first line.'),
  ('00000001-aaaa-0000-0000-000000000003', NULL, 'Credit Risk Analyst',     'محلل مخاطر ائتمانية',       'Credit Risk Analyst',      'Banking',    'gcc', 4, 'Quantitative analyst rating corporate and SME credit, building risk models, and recommending limits to credit committee.'),
  ('00000001-aaaa-0000-0000-000000000004', NULL, 'Treasury Dealer',         'تاجر خزينة',                'Treasury Dealer',          'Banking',    'gcc', 4, 'Front-office FX / money-market dealer executing under tight time pressure, managing risk limits, and protecting the bank''s reputation.'),
  ('00000001-aaaa-0000-0000-000000000005', NULL, 'Senior Government Manager', 'مدير حكومي أول',          'Senior Government Manager','Government', 'gcc', 4, 'Director-level public-sector leader translating strategy into department delivery, cultivating talent, and engaging stakeholders.'),
  ('00000001-aaaa-0000-0000-000000000006', NULL, 'Internal Audit Lead',     'رئيس التدقيق الداخلي',      'Internal Audit Lead',       'Banking',    'gcc', 4, 'Third-line audit lead delivering risk-based engagements, challenging management, and presenting findings to the audit committee.');


-- ────────────────────────────────────────────────────────────
-- Branch Manager - 8 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000011', 8, 'high',   'Hitting branch revenue, cross-sell, and NPS targets every quarter is the core deliverable.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000024', 7, 'high',   'Branch teams turn over fast — the manager develops talent for both retention and the bank''s succession pipeline.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000019', 7, 'high',   'Communicates targets, regulatory changes, and customer escalations clearly to a multi-language frontline.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000023', 7, 'high',   'Builds local-market networks (corporate clients, community, regulators) that drive referrals and reputation.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000013', 6, 'medium', 'Plans and aligns daily branch operations with the regional sales calendar and audit schedule.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000012', 6, 'medium', 'Holds tellers and relationship managers accountable for KPIs and compliance hygiene.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000025', 5, 'medium', 'Builds an effective team across tellers, RMs, and back-office.'),
  ('00000001-aaaa-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', 5, 'medium', 'Makes daily call decisions on credit exceptions, fraud flags, and customer disputes.');


-- ────────────────────────────────────────────────────────────
-- Compliance Officer - 8 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000032', 9, 'high',   'Integrity is the role — compliance officers are the bank''s ethical line of defence.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000004', 8, 'high',   'Analytical reasoning to interpret regulations, transaction patterns, and AML alerts.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000031', 7, 'high',   'Courage to escalate findings against senior business stakeholders when it matters.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000019', 7, 'high',   'Translates dense regulation into clear guidance for the front line and the board.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000005', 7, 'high',   'Decides on STR filings, breach severity, and remediation paths under regulator scrutiny.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000007', 6, 'medium', 'Manages complexity across overlapping UAE/Saudi/global regimes with conflicting requirements.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000012', 6, 'medium', 'Holds business lines accountable to remediation deadlines.'),
  ('00000001-aaaa-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000029', 5, 'medium', 'Self-aware enough to know when an investigation is hitting personal or political bias.');


-- ────────────────────────────────────────────────────────────
-- Credit Risk Analyst - 7 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000004', 9, 'high',   'Core technical skill — interpreting financials, ratios, and qualitative risks to land a credit grade.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 9, 'high',   'Financial acumen is the bedrock of credit analysis.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', 8, 'high',   'Manages complexity in multi-entity groups, cross-border exposures, and stressed scenarios.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000005', 7, 'medium', 'Recommends approve/decline/conditional with clear reasoning to credit committee.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000019', 6, 'medium', 'Writes credit memos that read clearly to non-quantitative committee members.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000012', 6, 'medium', 'Owns the assigned portfolio''s monitoring deadlines and early-warning triggers.'),
  ('00000001-aaaa-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000013', 4, 'low',    'Plans and prioritises the case pipeline against deal-team SLAs.');


-- ────────────────────────────────────────────────────────────
-- Treasury Dealer - 8 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', 9, 'high',   'Pricing FX/MM products and reading rate moves demands deep financial acumen.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000010', 8, 'high',   'Markets reward urgency — the dealer who hesitates loses spread and liquidity.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000011', 8, 'high',   'P&L is the visible scoreboard; the dealer must drive results inside their book.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', 8, 'high',   'Decisions are taken in seconds with incomplete information and real consequences.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000032', 7, 'high',   'Integrity prevents front-running, mispricing customers, and breaching dealing-room conduct rules.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000007', 7, 'medium', 'Reads contradictory signals from rates, headlines, and order flow.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000017', 6, 'medium', 'Recovers cleanly from losing days without revenge-trading.'),
  ('00000001-aaaa-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000019', 5, 'medium', 'Communicates positions and rationales clearly to risk and sales counterparts.');


-- ────────────────────────────────────────────────────────────
-- Senior Government Manager - 9 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 8, 'high',   'Translates national/emirate-level vision into a department''s 3-year strategy.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000018', 7, 'high',   'Mobilises a public-sector team around a long-horizon mission, not just a quarterly target.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000019', 7, 'high',   'Communicates with ministers, citizens, and frontline staff — three very different audiences.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000032', 8, 'high',   'Public trust is the currency; integrity matters more here than in any private-sector role.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000024', 6, 'medium', 'Develops Emirati / Saudi national talent in line with workforce-localisation policy.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000033', 6, 'medium', 'Cultural sensitivity across federal, emirate, tribal, and expatriate stakeholders.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000020', 6, 'medium', 'Persuades ministry counterparts on cross-departmental initiatives without budget authority.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000021', 5, 'medium', 'Manages conflict between competing departmental priorities or political mandates.'),
  ('00000001-aaaa-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000005', 6, 'medium', 'Decides under public scrutiny with audit-trail expectations.');


-- ────────────────────────────────────────────────────────────
-- Internal Audit Lead - 8 competencies
-- ────────────────────────────────────────────────────────────
INSERT INTO role_profile_competencies (role_profile_id, competency_id, weight, priority, reasoning) VALUES
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000032', 9, 'high',   'Independence and integrity are the brand of the internal audit function.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000004', 8, 'high',   'Tests controls, traces transactions, and forms a defensible opinion on each engagement.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000031', 8, 'high',   'Courage to land hard findings against senior management and stand by them at the audit committee.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000019', 7, 'high',   'Audit reports must read crisply for non-experts and survive challenge.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000007', 6, 'medium', 'Manages complexity across IT general controls, treasury, credit, and operational processes in one engagement.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000012', 7, 'high',   'Drives remediation accountability across the three lines of defence.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000029', 5, 'medium', 'Self-aware about scope creep, anchoring bias, and stakeholder capture.'),
  ('00000001-aaaa-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000020', 4, 'low',    'Persuades auditees on action ownership without needing line authority.');
