-- ============================================================
-- VIFM Assessment Center - Seed: Behavioral Indicators
-- Maps UCF behavioral indicators to VIFM 33 competencies
-- Source: Ahmad's Assessment Tool (UCF sheet)
-- ============================================================

-- Strategic Mindset (a0000001-...-000000000001)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000001', 'positive', 'Demonstrates an overall view of the internal business and its interrelationships with the external environment', 1),
('a0000001-0000-0000-0000-000000000001', 'positive', 'Demonstrates awareness of a very broad range of issues related to own work', 2),
('a0000001-0000-0000-0000-000000000001', 'positive', 'Shows consideration of the factors not intrinsically linked to the immediate work environment', 3),
('a0000001-0000-0000-0000-000000000001', 'positive', 'Demonstrates long-term thinking when setting goals', 4),
('a0000001-0000-0000-0000-000000000001', 'positive', 'Proactively anticipates future trends and opportunities', 5),
('a0000001-0000-0000-0000-000000000001', 'positive', 'Demonstrates a clear vision of long-term goals', 6),
('a0000001-0000-0000-0000-000000000001', 'negative', 'Fails to consider the broader impact of decisions on other departments', 7),
('a0000001-0000-0000-0000-000000000001', 'negative', 'Focuses only on short-term solutions without considering strategic implications', 8);

-- Business Insight (a0000001-...-000000000002)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000002', 'positive', 'Demonstrates awareness of revenue, cost, and risk factors that drive organizational performance', 1),
('a0000001-0000-0000-0000-000000000002', 'positive', 'Prioritizes financial considerations when making decisions', 2),
('a0000001-0000-0000-0000-000000000002', 'positive', 'Identifies new and promising business opportunities', 3),
('a0000001-0000-0000-0000-000000000002', 'positive', 'Pursues and secures new business to increase revenue', 4),
('a0000001-0000-0000-0000-000000000002', 'negative', 'Overlooks market trends or competitive threats', 5),
('a0000001-0000-0000-0000-000000000002', 'negative', 'Makes decisions without considering financial impact', 6);

-- Financial Acumen (a0000001-...-000000000003)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000003', 'positive', 'Demonstrates awareness of factors that could put the organization at risk', 1),
('a0000001-0000-0000-0000-000000000003', 'positive', 'Makes choices that help manage and mitigate risks', 2),
('a0000001-0000-0000-0000-000000000003', 'positive', 'Optimizes resources to deliver more with less', 3),
('a0000001-0000-0000-0000-000000000003', 'positive', 'Allocates resources to meet work requirements', 4),
('a0000001-0000-0000-0000-000000000003', 'negative', 'Ignores cost implications when allocating resources', 5),
('a0000001-0000-0000-0000-000000000003', 'negative', 'Fails to identify or mitigate financial risks', 6);

-- Analytical Reasoning (a0000001-...-000000000004)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000004', 'positive', 'Accurately judges the relevance and importance of different pieces of information', 1),
('a0000001-0000-0000-0000-000000000004', 'positive', 'Identifies underlying relationships, causes, and effects', 2),
('a0000001-0000-0000-0000-000000000004', 'positive', 'Quickly and accurately compares similarities and differences among data', 3),
('a0000001-0000-0000-0000-000000000004', 'positive', 'Identifies potential weaknesses in proposals or plans', 4),
('a0000001-0000-0000-0000-000000000004', 'positive', 'Identifies and uncovers problems', 5),
('a0000001-0000-0000-0000-000000000004', 'negative', 'Draws conclusions without sufficient evidence', 6),
('a0000001-0000-0000-0000-000000000004', 'negative', 'Fails to identify inconsistencies in data or arguments', 7);

-- Decision Quality (a0000001-...-000000000005)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000005', 'positive', 'Decides on a course of action without unnecessary delay', 1),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Takes confident, decisive action in pressured situations', 2),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Is not inhibited by risk when making decisions', 3),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Makes difficult or unpopular decisions when necessary', 4),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Makes well-informed decisions after considering the relevant information', 5),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Minimizes risk by considering the uncertainties involved in a decision', 6),
('a0000001-0000-0000-0000-000000000005', 'positive', 'Takes accountability for decisions made', 7),
('a0000001-0000-0000-0000-000000000005', 'negative', 'Avoids making decisions or defers unnecessarily', 8),
('a0000001-0000-0000-0000-000000000005', 'negative', 'Makes decisions without considering relevant information or alternatives', 9);

-- Cultivates Innovation (a0000001-...-000000000006)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000006', 'positive', 'Readily experiments with new or unconventional ideas', 1),
('a0000001-0000-0000-0000-000000000006', 'positive', 'Demonstrates enthusiasm when presented with new ideas', 2),
('a0000001-0000-0000-0000-000000000006', 'positive', 'Generates new ideas easily', 3),
('a0000001-0000-0000-0000-000000000006', 'positive', 'Produces novel and original approaches', 4),
('a0000001-0000-0000-0000-000000000006', 'positive', 'Devises effective ways to implement change', 5),
('a0000001-0000-0000-0000-000000000006', 'positive', 'Constantly seeks opportunities for organizational improvement', 6),
('a0000001-0000-0000-0000-000000000006', 'negative', 'Dismisses new ideas without consideration', 7),
('a0000001-0000-0000-0000-000000000006', 'negative', 'Resists change and prefers established methods', 8);

-- Manages Complexity (a0000001-...-000000000007)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000007', 'positive', 'Uses a range of sources to collect all the relevant information', 1),
('a0000001-0000-0000-0000-000000000007', 'positive', 'Gathers a sufficient breadth of information to reach an informed conclusion', 2),
('a0000001-0000-0000-0000-000000000007', 'positive', 'Quickly identifies the key ideas behind a topic or technique', 3),
('a0000001-0000-0000-0000-000000000007', 'positive', 'Commits new information to memory easily', 4),
('a0000001-0000-0000-0000-000000000007', 'negative', 'Becomes overwhelmed by complex or contradictory information', 5),
('a0000001-0000-0000-0000-000000000007', 'negative', 'Oversimplifies complex problems', 6);

-- Global Perspective (a0000001-...-000000000008)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000008', 'positive', 'Communicates well with people of different cultures', 1),
('a0000001-0000-0000-0000-000000000008', 'positive', 'Shows interest in learning about the characteristics of other cultures', 2),
('a0000001-0000-0000-0000-000000000008', 'positive', 'Relates well to people of different levels of seniority', 3),
('a0000001-0000-0000-0000-000000000008', 'positive', 'Adapts own style to fit in with different people or situations', 4),
('a0000001-0000-0000-0000-000000000008', 'negative', 'Shows insensitivity to cultural differences', 5),
('a0000001-0000-0000-0000-000000000008', 'negative', 'Fails to adapt communication style for diverse audiences', 6);

-- Digital Fluency (a0000001-...-000000000009)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000009', 'positive', 'Uses messaging systems to effectively communicate with colleagues and clients', 1),
('a0000001-0000-0000-0000-000000000009', 'positive', 'Communicates and disseminates ideas using multimedia presentation platforms', 2),
('a0000001-0000-0000-0000-000000000009', 'positive', 'Demonstrates detailed knowledge of relevant technology and tools', 3),
('a0000001-0000-0000-0000-000000000009', 'positive', 'Applies specialist technical skills to job tasks', 4),
('a0000001-0000-0000-0000-000000000009', 'negative', 'Avoids or resists adopting new digital tools', 5),
('a0000001-0000-0000-0000-000000000009', 'negative', 'Relies on outdated methods when better technology exists', 6);

-- Action Oriented (a0000001-...-000000000010)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000010', 'positive', 'Seeks new tasks in order to keep busy', 1),
('a0000001-0000-0000-0000-000000000010', 'positive', 'Takes on new responsibilities proactively', 2),
('a0000001-0000-0000-0000-000000000010', 'positive', 'Seeks and tackles demanding goals', 3),
('a0000001-0000-0000-0000-000000000010', 'positive', 'Sees tasks through to completion', 4),
('a0000001-0000-0000-0000-000000000010', 'positive', 'Actively seeks and incorporates feedback for improvement', 5),
('a0000001-0000-0000-0000-000000000010', 'negative', 'Waits for instructions rather than taking initiative', 6),
('a0000001-0000-0000-0000-000000000010', 'negative', 'Leaves tasks incomplete or unfinished', 7);

-- Drives Results (a0000001-...-000000000011)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000011', 'positive', 'Attends to multiple tasks without losing focus', 1),
('a0000001-0000-0000-0000-000000000011', 'positive', 'Seeks to understand customer needs', 2),
('a0000001-0000-0000-0000-000000000011', 'positive', 'Advocates for the customer interests inside the organization', 3),
('a0000001-0000-0000-0000-000000000011', 'positive', 'Works well under pressure and meets tight deadlines', 4),
('a0000001-0000-0000-0000-000000000011', 'positive', 'Maintains concentration when carrying out demanding tasks', 5),
('a0000001-0000-0000-0000-000000000011', 'negative', 'Loses focus when managing multiple priorities', 6),
('a0000001-0000-0000-0000-000000000011', 'negative', 'Fails to meet commitments or deadlines', 7);

-- Ensures Accountability (a0000001-...-000000000012)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000012', 'positive', 'Co-operates with instructions willingly', 1),
('a0000001-0000-0000-0000-000000000012', 'positive', 'Adheres to the organization regulations and policies', 2),
('a0000001-0000-0000-0000-000000000012', 'positive', 'Arrives to work and meetings on time', 3),
('a0000001-0000-0000-0000-000000000012', 'positive', 'Follows through on promises and commitments', 4),
('a0000001-0000-0000-0000-000000000012', 'positive', 'Accepts appropriate responsibility when things go wrong', 5),
('a0000001-0000-0000-0000-000000000012', 'negative', 'Blames others when things go wrong', 6),
('a0000001-0000-0000-0000-000000000012', 'negative', 'Fails to follow through on commitments', 7);

-- Plans and Aligns (a0000001-...-000000000013)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000013', 'positive', 'Develops detailed plans before beginning a piece of work', 1),
('a0000001-0000-0000-0000-000000000013', 'positive', 'Determines the order in which tasks should be completed', 2),
('a0000001-0000-0000-0000-000000000013', 'positive', 'Allocates resources to meet work requirements', 3),
('a0000001-0000-0000-0000-000000000013', 'positive', 'Anticipates future resourcing needs and potential conflicts', 4),
('a0000001-0000-0000-0000-000000000013', 'positive', 'Maintains accurate and up-to-date documentation of own work', 5),
('a0000001-0000-0000-0000-000000000013', 'negative', 'Begins tasks without adequate planning', 6),
('a0000001-0000-0000-0000-000000000013', 'negative', 'Fails to anticipate resource needs or scheduling conflicts', 7);

-- Optimizes Processes (a0000001-...-000000000014)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000014', 'positive', 'Improves work performance and systems by introducing new ideas', 1),
('a0000001-0000-0000-0000-000000000014', 'positive', 'Encourages others to change inefficient work practices', 2),
('a0000001-0000-0000-0000-000000000014', 'positive', 'Recognizes opportunities for change', 3),
('a0000001-0000-0000-0000-000000000014', 'positive', 'Uses appropriate systems for documenting and storing information', 4),
('a0000001-0000-0000-0000-000000000014', 'negative', 'Continues using inefficient processes without seeking improvement', 5),
('a0000001-0000-0000-0000-000000000014', 'negative', 'Resists adopting new systems or workflows', 6);

-- Manages Ambiguity (a0000001-...-000000000015)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000015', 'positive', 'Remains productive in changing environments', 1),
('a0000001-0000-0000-0000-000000000015', 'positive', 'Adjusts to changes effectively', 2),
('a0000001-0000-0000-0000-000000000015', 'positive', 'Works comfortably with loosely defined tasks and roles', 3),
('a0000001-0000-0000-0000-000000000015', 'positive', 'Works productively in an environment where direction is not available', 4),
('a0000001-0000-0000-0000-000000000015', 'positive', 'Takes advantage of opportunities offered by ambiguous situations', 5),
('a0000001-0000-0000-0000-000000000015', 'negative', 'Becomes paralyzed when direction or structure is absent', 6),
('a0000001-0000-0000-0000-000000000015', 'negative', 'Struggles to adapt when plans change unexpectedly', 7);

-- Nimble Learning (a0000001-...-000000000016)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000016', 'positive', 'Quickly identifies the key ideas behind a topic or technique', 1),
('a0000001-0000-0000-0000-000000000016', 'positive', 'Commits new information to memory easily', 2),
('a0000001-0000-0000-0000-000000000016', 'positive', 'Uses a range of sources to collect all the relevant information', 3),
('a0000001-0000-0000-0000-000000000016', 'positive', 'Identifies personal development needs and takes action to improve', 4),
('a0000001-0000-0000-0000-000000000016', 'negative', 'Takes excessive time to grasp new concepts', 5),
('a0000001-0000-0000-0000-000000000016', 'negative', 'Repeats mistakes without learning from experience', 6);

-- Being Resilient (a0000001-...-000000000017)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000017', 'positive', 'Keeps emotions under control during challenging situations', 1),
('a0000001-0000-0000-0000-000000000017', 'positive', 'Displays optimism in the face of negative situations', 2),
('a0000001-0000-0000-0000-000000000017', 'positive', 'Keeps difficulties in perspective', 3),
('a0000001-0000-0000-0000-000000000017', 'positive', 'Remains calm and objective under pressure', 4),
('a0000001-0000-0000-0000-000000000017', 'positive', 'Retains focus and concentration when under pressure at work', 5),
('a0000001-0000-0000-0000-000000000017', 'negative', 'Shows visible frustration or dissatisfaction when things go wrong', 6),
('a0000001-0000-0000-0000-000000000017', 'negative', 'Loses composure or focus under pressure', 7);

-- Drives Vision and Purpose (a0000001-...-000000000018)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000018', 'positive', 'Inspires enthusiasm and a positive attitude from others about their work', 1),
('a0000001-0000-0000-0000-000000000018', 'positive', 'Takes steps to keep people focused and motivated to achieve goals', 2),
('a0000001-0000-0000-0000-000000000018', 'positive', 'Provides others with the authority, resources, and freedom to independently accomplish tasks', 3),
('a0000001-0000-0000-0000-000000000018', 'positive', 'Demonstrates a clear vision of long-term goals', 4),
('a0000001-0000-0000-0000-000000000018', 'negative', 'Fails to communicate a compelling vision', 5),
('a0000001-0000-0000-0000-000000000018', 'negative', 'Does not motivate or inspire others toward shared goals', 6);

-- Communicates Effectively (a0000001-...-000000000019)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000019', 'positive', 'Communicates information and ideas by speaking in a way that others will understand', 1),
('a0000001-0000-0000-0000-000000000019', 'positive', 'Speaks clearly and fluently at an appropriate pace', 2),
('a0000001-0000-0000-0000-000000000019', 'positive', 'Projects confidence when speaking', 3),
('a0000001-0000-0000-0000-000000000019', 'positive', 'Engages the audience when presenting', 4),
('a0000001-0000-0000-0000-000000000019', 'positive', 'Tailors style and level of complexity to the audience', 5),
('a0000001-0000-0000-0000-000000000019', 'positive', 'Learns the characteristics of the intended audience prior to speaking', 6),
('a0000001-0000-0000-0000-000000000019', 'negative', 'Communicates in a way that is unclear or difficult to follow', 7),
('a0000001-0000-0000-0000-000000000019', 'negative', 'Fails to adapt communication style for different audiences', 8);

-- Persuades (a0000001-...-000000000020)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000020', 'positive', 'Speaks with authority and conviction', 1),
('a0000001-0000-0000-0000-000000000020', 'positive', 'Demonstrates personal credibility and expertise', 2),
('a0000001-0000-0000-0000-000000000020', 'positive', 'Uses relevant insights to support own position', 3),
('a0000001-0000-0000-0000-000000000020', 'positive', 'Develops logical arguments from facts and data', 4),
('a0000001-0000-0000-0000-000000000020', 'positive', 'Positions arguments with the emotional viewpoints of others in mind', 5),
('a0000001-0000-0000-0000-000000000020', 'negative', 'Relies on position or authority rather than evidence to persuade', 6),
('a0000001-0000-0000-0000-000000000020', 'negative', 'Fails to build a compelling case for proposals', 7);

-- Manages Conflict (a0000001-...-000000000021)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000021', 'positive', 'Navigates political situations sensitively and diplomatically', 1),
('a0000001-0000-0000-0000-000000000021', 'positive', 'Negotiates to gain agreement from others and achieve desired outcomes', 2),
('a0000001-0000-0000-0000-000000000021', 'positive', 'Effectively manages conflict with a minimum of noise', 3),
('a0000001-0000-0000-0000-000000000021', 'positive', 'Remains appropriately committed to a position even when faced with opposition', 4),
('a0000001-0000-0000-0000-000000000021', 'negative', 'Avoids conflict situations rather than addressing them', 5),
('a0000001-0000-0000-0000-000000000021', 'negative', 'Escalates disagreements unnecessarily', 6);

-- Negotiation (a0000001-...-000000000022)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000022', 'positive', 'Navigates political situations and negotiates to gain agreement from others', 1),
('a0000001-0000-0000-0000-000000000022', 'positive', 'Shares insights that create tension and lead others to question their thinking', 2),
('a0000001-0000-0000-0000-000000000022', 'positive', 'Achieves desired outcomes through dialogue and compromise', 3),
('a0000001-0000-0000-0000-000000000022', 'positive', 'Reaches mutually beneficial agreements', 4),
('a0000001-0000-0000-0000-000000000022', 'negative', 'Concedes too easily without pursuing optimal outcomes', 5),
('a0000001-0000-0000-0000-000000000022', 'negative', 'Takes an inflexible position that prevents reaching agreement', 6);

-- Builds Networks (a0000001-...-000000000023)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000023', 'positive', 'Establishes and nurtures a wide network of relationships', 1),
('a0000001-0000-0000-0000-000000000023', 'positive', 'Quickly recognizes how to make use of new contacts to achieve goals', 2),
('a0000001-0000-0000-0000-000000000023', 'positive', 'Makes personal connections with others quickly', 3),
('a0000001-0000-0000-0000-000000000023', 'positive', 'Appears confident and comfortable speaking to strangers', 4),
('a0000001-0000-0000-0000-000000000023', 'positive', 'Creates a positive impression and builds rapport', 5),
('a0000001-0000-0000-0000-000000000023', 'negative', 'Fails to build or maintain professional relationships', 6),
('a0000001-0000-0000-0000-000000000023', 'negative', 'Does not leverage networks to achieve objectives', 7);

-- Develops Talent (a0000001-...-000000000024)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000024', 'positive', 'Clearly defines the roles, responsibilities, and objectives of others', 1),
('a0000001-0000-0000-0000-000000000024', 'positive', 'Monitors the performance of others', 2),
('a0000001-0000-0000-0000-000000000024', 'positive', 'Provides objective and timely feedback to others', 3),
('a0000001-0000-0000-0000-000000000024', 'positive', 'Encourages others to consider and pursue development opportunities', 4),
('a0000001-0000-0000-0000-000000000024', 'positive', 'Identifies the strengths and limitations of others', 5),
('a0000001-0000-0000-0000-000000000024', 'positive', 'Accurately judges the future potential of others', 6),
('a0000001-0000-0000-0000-000000000024', 'negative', 'Does not provide feedback or development guidance', 7),
('a0000001-0000-0000-0000-000000000024', 'negative', 'Fails to recognize or nurture potential in team members', 8);

-- Builds Effective Teams (a0000001-...-000000000025)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000025', 'positive', 'Takes the lead in organizing work tasks', 1),
('a0000001-0000-0000-0000-000000000025', 'positive', 'Coordinates others activities effectively', 2),
('a0000001-0000-0000-0000-000000000025', 'positive', 'Distributes workload appropriately', 3),
('a0000001-0000-0000-0000-000000000025', 'positive', 'Uses rewards fairly to recognize performance', 4),
('a0000001-0000-0000-0000-000000000025', 'negative', 'Creates an inequitable distribution of work', 5),
('a0000001-0000-0000-0000-000000000025', 'negative', 'Fails to coordinate team efforts effectively', 6);

-- Collaboration (a0000001-...-000000000026)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000026', 'positive', 'Respects and values different viewpoints', 1),
('a0000001-0000-0000-0000-000000000026', 'positive', 'Approaches others in a non-judgmental way', 2),
('a0000001-0000-0000-0000-000000000026', 'positive', 'Seeks input from others before making a decision', 3),
('a0000001-0000-0000-0000-000000000026', 'positive', 'Encourages others to express their views', 4),
('a0000001-0000-0000-0000-000000000026', 'positive', 'Demonstrates an awareness of the emotional needs of others', 5),
('a0000001-0000-0000-0000-000000000026', 'positive', 'Shows concern and compassion for others', 6),
('a0000001-0000-0000-0000-000000000026', 'negative', 'Dismisses or ignores input from team members', 7),
('a0000001-0000-0000-0000-000000000026', 'negative', 'Works in isolation without consulting stakeholders', 8);

-- Instills Trust (a0000001-...-000000000027)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000027', 'positive', 'Acts consistently in accordance with ethical standards', 1),
('a0000001-0000-0000-0000-000000000027', 'positive', 'Upholds ethical standards despite external pressure or inconvenience', 2),
('a0000001-0000-0000-0000-000000000027', 'positive', 'Follows through on promises and commitments', 3),
('a0000001-0000-0000-0000-000000000027', 'positive', 'Maintains confidentiality when appropriate', 4),
('a0000001-0000-0000-0000-000000000027', 'negative', 'Makes promises that are not kept', 5),
('a0000001-0000-0000-0000-000000000027', 'negative', 'Acts inconsistently with stated values', 6);

-- Situational Adaptability (a0000001-...-000000000028)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000028', 'positive', 'Relates well to people of different levels of seniority', 1),
('a0000001-0000-0000-0000-000000000028', 'positive', 'Adapts own style to fit in with different people or situations', 2),
('a0000001-0000-0000-0000-000000000028', 'positive', 'Remains productive in changing environments', 3),
('a0000001-0000-0000-0000-000000000028', 'positive', 'Adjusts to changes effectively', 4),
('a0000001-0000-0000-0000-000000000028', 'negative', 'Applies the same approach regardless of the situation', 5),
('a0000001-0000-0000-0000-000000000028', 'negative', 'Fails to read and respond to social or organizational cues', 6);

-- Self-Awareness (a0000001-...-000000000029)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000029', 'positive', 'Actively seeks and incorporates feedback and suggestions for improvement', 1),
('a0000001-0000-0000-0000-000000000029', 'positive', 'Identifies personal development needs and takes action to improve', 2),
('a0000001-0000-0000-0000-000000000029', 'positive', 'Recognizes own strengths and weaknesses accurately', 3),
('a0000001-0000-0000-0000-000000000029', 'negative', 'Unaware of own impact on others', 4),
('a0000001-0000-0000-0000-000000000029', 'negative', 'Defensive when receiving feedback', 5);

-- Emotional Intelligence (a0000001-...-000000000030)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000030', 'positive', 'Demonstrates an awareness of the emotional needs of others', 1),
('a0000001-0000-0000-0000-000000000030', 'positive', 'Shows concern and compassion for others', 2),
('a0000001-0000-0000-0000-000000000030', 'positive', 'Keeps emotions under control during challenging situations', 3),
('a0000001-0000-0000-0000-000000000030', 'positive', 'Does not openly show frustration or dissatisfaction inappropriately', 4),
('a0000001-0000-0000-0000-000000000030', 'negative', 'Ignores or dismisses the emotional reactions of others', 5),
('a0000001-0000-0000-0000-000000000030', 'negative', 'Allows personal emotions to negatively impact professional interactions', 6);

-- Courage (a0000001-...-000000000031)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000031', 'positive', 'Makes difficult or unpopular decisions when necessary', 1),
('a0000001-0000-0000-0000-000000000031', 'positive', 'Speaks up on important issues even when it is uncomfortable', 2),
('a0000001-0000-0000-0000-000000000031', 'positive', 'Remains appropriately committed to a decision even when faced with opposition', 3),
('a0000001-0000-0000-0000-000000000031', 'positive', 'Takes confident, decisive action in pressured situations', 4),
('a0000001-0000-0000-0000-000000000031', 'negative', 'Avoids difficult conversations or confrontation', 5),
('a0000001-0000-0000-0000-000000000031', 'negative', 'Backs down from positions too easily under pressure', 6);

-- Integrity (a0000001-...-000000000032)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000032', 'positive', 'Acts consistently in accordance with ethical standards', 1),
('a0000001-0000-0000-0000-000000000032', 'positive', 'Upholds ethical standards despite external pressure or inconvenience', 2),
('a0000001-0000-0000-0000-000000000032', 'positive', 'Follows through on promises and commitments', 3),
('a0000001-0000-0000-0000-000000000032', 'positive', 'Maintains confidentiality when appropriate', 4),
('a0000001-0000-0000-0000-000000000032', 'positive', 'Evaluates environmental and ethical considerations when making business decisions', 5),
('a0000001-0000-0000-0000-000000000032', 'negative', 'Compromises ethical standards for personal gain', 6),
('a0000001-0000-0000-0000-000000000032', 'negative', 'Fails to maintain confidentiality', 7);

-- Cultural Sensitivity (a0000001-...-000000000033)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000033', 'positive', 'Communicates well with people of different cultures', 1),
('a0000001-0000-0000-0000-000000000033', 'positive', 'Shows interest in learning about the characteristics of other cultures', 2),
('a0000001-0000-0000-0000-000000000033', 'positive', 'Adapts own style to fit in with different cultural contexts', 3),
('a0000001-0000-0000-0000-000000000033', 'positive', 'Demonstrates respect for diverse cultural norms and practices', 4),
('a0000001-0000-0000-0000-000000000033', 'negative', 'Shows insensitivity to cultural differences', 5),
('a0000001-0000-0000-0000-000000000033', 'negative', 'Makes assumptions based on cultural stereotypes', 6);

-- Learning Agility (a0000001-...-000000000034)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000034', 'positive', 'Quickly identifies the key ideas behind a topic or technique', 1),
('a0000001-0000-0000-0000-000000000034', 'positive', 'Commits new information to memory easily', 2),
('a0000001-0000-0000-0000-000000000034', 'positive', 'Uses a range of sources to collect all the relevant information', 3),
('a0000001-0000-0000-0000-000000000034', 'positive', 'Gathers a sufficient breadth of information to reach an informed conclusion', 4),
('a0000001-0000-0000-0000-000000000034', 'negative', 'Struggles to apply learning from one context to another', 5),
('a0000001-0000-0000-0000-000000000034', 'negative', 'Takes excessive time to learn new skills or concepts', 6);

-- Self-Development (a0000001-...-000000000035)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000035', 'positive', 'Actively seeks and incorporates feedback and suggestions for improvement', 1),
('a0000001-0000-0000-0000-000000000035', 'positive', 'Identifies personal development needs and takes action to improve', 2),
('a0000001-0000-0000-0000-000000000035', 'positive', 'Seeks new tasks and challenges to grow capabilities', 3),
('a0000001-0000-0000-0000-000000000035', 'positive', 'Pursues both formal and informal development opportunities', 4),
('a0000001-0000-0000-0000-000000000035', 'negative', 'Does not seek or act on feedback', 5),
('a0000001-0000-0000-0000-000000000035', 'negative', 'Shows no interest in personal or professional growth', 6);

-- Composure (a0000001-...-000000000036)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000036', 'positive', 'Remains calm and objective under pressure', 1),
('a0000001-0000-0000-0000-000000000036', 'positive', 'Retains focus and concentration when under pressure at work', 2),
('a0000001-0000-0000-0000-000000000036', 'positive', 'Keeps emotions under control during challenging situations', 3),
('a0000001-0000-0000-0000-000000000036', 'positive', 'Does not openly show frustration or dissatisfaction', 4),
('a0000001-0000-0000-0000-000000000036', 'negative', 'Visibly stressed or flustered in pressured situations', 5),
('a0000001-0000-0000-0000-000000000036', 'negative', 'Loses concentration or makes errors under pressure', 6);

-- Work-Life Balance (a0000001-...-000000000037)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000037', 'positive', 'Maintains healthy boundaries between work demands and personal life', 1),
('a0000001-0000-0000-0000-000000000037', 'positive', 'Manages energy and workload sustainably', 2),
('a0000001-0000-0000-0000-000000000037', 'positive', 'Models sustainable work practices for others', 3),
('a0000001-0000-0000-0000-000000000037', 'negative', 'Consistently overworks to the detriment of personal wellbeing', 4),
('a0000001-0000-0000-0000-000000000037', 'negative', 'Creates unrealistic expectations for team work hours', 5);

-- Resourcefulness (a0000001-...-000000000038)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000038', 'positive', 'Allocates resources to meet work requirements effectively', 1),
('a0000001-0000-0000-0000-000000000038', 'positive', 'Anticipates future resourcing needs and potential conflicts', 2),
('a0000001-0000-0000-0000-000000000038', 'positive', 'Optimizes resources to deliver more with less', 3),
('a0000001-0000-0000-0000-000000000038', 'positive', 'Finds creative solutions when resources are limited', 4),
('a0000001-0000-0000-0000-000000000038', 'negative', 'Wastes resources or fails to optimize their use', 5),
('a0000001-0000-0000-0000-000000000038', 'negative', 'Does not plan ahead for resource needs', 6);
