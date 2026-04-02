-- ============================================================
-- VIFM Assessment Center — Seed: Development Tips
-- Original VIFM content — 3-4 actionable tips per competency
-- Tailored for GCC/MENA leadership development context
-- ============================================================

-- Delete any previously imported tips
DELETE FROM behavioral_indicators WHERE description LIKE '[DEV TIP]%';

-- THINKING DOMAIN

-- Strategic Mindset (001)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000001', 'positive', '[DEV TIP] Dedicate 30 minutes weekly to reading industry reports and geopolitical analyses relevant to your sector in the GCC region. Identify three implications for your organization and discuss them with your leadership team.', 101),
('a0000001-0000-0000-0000-000000000001', 'positive', '[DEV TIP] Before making any significant decision, write down the three-year impact. Challenge yourself to connect every tactical action to a strategic objective. Present this thinking to your manager for feedback.', 102),
('a0000001-0000-0000-0000-000000000001', 'positive', '[DEV TIP] Volunteer to participate in your organization''s strategic planning process. If none exists, propose a quarterly strategy review for your department that links team goals to the organization''s vision.', 103);

-- Business Insight (002)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000002', 'positive', '[DEV TIP] Request access to your organization''s financial statements and industry benchmarking reports. Schedule monthly meetings with the finance team to understand revenue drivers, cost structures, and margin trends.', 101),
('a0000001-0000-0000-0000-000000000002', 'positive', '[DEV TIP] Identify your top three competitors and create a comparison matrix of their market positioning, pricing strategies, and customer value propositions. Update it quarterly and share insights with your team.', 102),
('a0000001-0000-0000-0000-000000000002', 'positive', '[DEV TIP] Attend industry conferences and networking events in the GCC region. After each event, write a one-page summary of emerging trends and how they could create opportunities or threats for your organization.', 103);

-- Financial Acumen (003)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000003', 'positive', '[DEV TIP] Enroll in a financial literacy course focused on reading P&L statements, balance sheets, and cash flow analyses. Practice by analyzing your own department''s budget monthly and identifying optimization opportunities.', 101),
('a0000001-0000-0000-0000-000000000003', 'positive', '[DEV TIP] Before proposing any initiative, prepare a cost-benefit analysis that includes ROI projections, risk factors, and payback periods. Seek feedback from a finance colleague on your methodology.', 102),
('a0000001-0000-0000-0000-000000000003', 'positive', '[DEV TIP] Track key financial KPIs for your department weekly. Create a simple dashboard showing budget utilization, cost per output, and variance from plan. Use it to drive data-informed conversations with your team.', 103);

-- Analytical Reasoning (004)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000004', 'positive', '[DEV TIP] When faced with a complex problem, resist jumping to solutions. Instead, use a structured framework: define the problem, gather data from multiple sources, identify root causes, generate alternatives, and evaluate trade-offs before deciding.', 101),
('a0000001-0000-0000-0000-000000000004', 'positive', '[DEV TIP] Practice challenging assumptions by asking "What evidence supports this?" and "What would change our conclusion?" in every major discussion. Encourage your team to do the same.', 102),
('a0000001-0000-0000-0000-000000000004', 'positive', '[DEV TIP] After each significant decision, conduct a brief post-mortem: What data did we use? What did we miss? What would we do differently? Document lessons learned and share with the team.', 103);

-- Decision Quality (005)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000005', 'positive', '[DEV TIP] Set clear decision-making timeframes for yourself. For each pending decision, ask: "What information is essential versus nice-to-have?" Make the decision once you have the essentials — don''t wait for perfect information.', 101),
('a0000001-0000-0000-0000-000000000005', 'positive', '[DEV TIP] For high-stakes decisions, prepare a decision matrix that scores each option against weighted criteria. Share this with stakeholders to build transparency and alignment around your reasoning.', 102),
('a0000001-0000-0000-0000-000000000005', 'positive', '[DEV TIP] Once you make a decision, stand by it unless genuinely new information emerges. Practice communicating your rationale clearly so others understand not just what you decided but why.', 103);

-- Cultivates Innovation (006)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000006', 'positive', '[DEV TIP] Establish a monthly "innovation hour" with your team where the sole agenda is generating new ideas — no criticism allowed. Capture all ideas and commit to piloting at least one per quarter.', 101),
('a0000001-0000-0000-0000-000000000006', 'positive', '[DEV TIP] When someone proposes a new idea, respond with "Yes, and..." rather than "Yes, but..." Build on ideas before evaluating them. Create psychological safety for creative thinking.', 102),
('a0000001-0000-0000-0000-000000000006', 'positive', '[DEV TIP] Study how organizations outside your industry solve similar problems. Cross-industry benchmarking often produces the most innovative solutions. Visit or research two organizations per quarter.', 103);

-- Manages Complexity (007)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000007', 'positive', '[DEV TIP] When facing a complex situation, create a visual map of all the moving parts — stakeholders, dependencies, risks, and timelines. Use this to identify which elements you can control and which require influence.', 101),
('a0000001-0000-0000-0000-000000000007', 'positive', '[DEV TIP] Practice summarizing complex topics in three bullet points. If you cannot explain it simply, you don''t understand it deeply enough. Use the "So what? Now what?" framework to distill meaning from complexity.', 102),
('a0000001-0000-0000-0000-000000000007', 'positive', '[DEV TIP] Seek out assignments that involve ambiguity and multiple stakeholders. These are the best opportunities to develop your ability to navigate complexity. Reflect on what worked after each one.', 103);

-- Global Perspective (008)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000008', 'positive', '[DEV TIP] Actively learn about the cultural business norms of at least two countries in the GCC/MENA region beyond your own. Understand how decision-making, relationship-building, and hierarchy differ across cultures.', 101),
('a0000001-0000-0000-0000-000000000008', 'positive', '[DEV TIP] Before any cross-cultural meeting, research the cultural context of the participants. Adapt your communication style — pace, directness, formality — to the expectations of your audience.', 102),
('a0000001-0000-0000-0000-000000000008', 'positive', '[DEV TIP] Subscribe to international business publications and follow economic developments in markets relevant to your organization. Share a weekly global insight with your team to build collective awareness.', 103);

-- Digital Fluency (009)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000009', 'positive', '[DEV TIP] Identify one digital tool or platform per quarter that could improve your team''s productivity. Learn it yourself first, then champion its adoption. Lead by example in embracing technology.', 101),
('a0000001-0000-0000-0000-000000000009', 'positive', '[DEV TIP] When making decisions, ask: "What data do we have that could inform this?" Build the habit of requesting dashboards and analytics rather than relying solely on intuition or anecdote.', 102),
('a0000001-0000-0000-0000-000000000009', 'positive', '[DEV TIP] Attend a digital transformation workshop or online course relevant to your industry. Apply one concept from the course to a real business challenge within 30 days of completing it.', 103);

-- RESULTS DOMAIN

-- Action Oriented (010)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000010', 'positive', '[DEV TIP] At the start of each week, identify your three most impactful tasks. Do the hardest one first each day. Track your completion rate and celebrate progress to build momentum.', 101),
('a0000001-0000-0000-0000-000000000010', 'positive', '[DEV TIP] When you spot a problem, propose a solution within 24 hours — even if it''s imperfect. Bias toward action: a good plan executed today beats a perfect plan next month.', 102),
('a0000001-0000-0000-0000-000000000010', 'positive', '[DEV TIP] Volunteer for stretch assignments that push you outside your comfort zone. Each quarter, take on one task that you''ve never done before. Document what you learn from each experience.', 103);

-- Drives Results (011)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000011', 'positive', '[DEV TIP] Set SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound) for every project. Review progress weekly and adjust your approach — not your standards — when obstacles arise.', 101),
('a0000001-0000-0000-0000-000000000011', 'positive', '[DEV TIP] Identify who your internal and external customers are and what "excellent" looks like from their perspective. Regularly ask them for feedback and use it to raise your quality bar.', 102),
('a0000001-0000-0000-0000-000000000011', 'positive', '[DEV TIP] When managing multiple priorities, use an impact-effort matrix: focus energy on high-impact activities first. Delegate or defer low-impact tasks to maintain productivity on what matters most.', 103);

-- Ensures Accountability (012)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000012', 'positive', '[DEV TIP] At the start of every meeting or project, clarify who owns what by when. Write it down, share it, and follow up. Make accountability visible — not punitive — through transparent tracking.', 101),
('a0000001-0000-0000-0000-000000000012', 'positive', '[DEV TIP] When things go wrong, model ownership: say "Here''s what happened, here''s what I''m doing about it" before anyone asks. Your team will mirror the accountability standard you set.', 102),
('a0000001-0000-0000-0000-000000000012', 'positive', '[DEV TIP] Create a simple weekly check-in ritual with your direct reports: What did you commit to? What did you deliver? What needs to shift? Keep it brief, positive, and forward-looking.', 103);

-- Plans and Aligns (013)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000013', 'positive', '[DEV TIP] Before starting any project, create a one-page plan: objective, milestones, dependencies, risks, and resources. Share it with stakeholders for alignment before execution begins.', 101),
('a0000001-0000-0000-0000-000000000013', 'positive', '[DEV TIP] Use time-blocking to protect your most productive hours for deep work. Schedule planning time at the start of each week — the 30 minutes you invest will save hours of reactive firefighting.', 102),
('a0000001-0000-0000-0000-000000000013', 'positive', '[DEV TIP] When priorities shift (and they will), explicitly re-sequence your commitments. Communicate changes to affected stakeholders immediately — surprises erode trust faster than delays.', 103);

-- Optimizes Processes (014)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000014', 'positive', '[DEV TIP] Each quarter, select one recurring process in your team and challenge every step: "Why do we do it this way? What would happen if we stopped?" Eliminate steps that don''t add value.', 101),
('a0000001-0000-0000-0000-000000000014', 'positive', '[DEV TIP] Benchmark your team''s key processes against industry best practices. Identify one area where you can achieve a 20% improvement and create a 90-day action plan to get there.', 102),
('a0000001-0000-0000-0000-000000000014', 'positive', '[DEV TIP] Document your most critical processes so they''re not dependent on any single person. This builds resilience and creates a foundation for continuous improvement.', 103);

-- Manages Ambiguity (015)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000015', 'positive', '[DEV TIP] When direction is unclear, focus on what you CAN control. Make the best decision possible with available information and adjust as you learn more. Progress beats perfection in ambiguous situations.', 101),
('a0000001-0000-0000-0000-000000000015', 'positive', '[DEV TIP] Practice scenario planning: for any major uncertainty, outline best-case, worst-case, and most-likely scenarios with response plans for each. This builds comfort with ambiguity.', 102),
('a0000001-0000-0000-0000-000000000015', 'positive', '[DEV TIP] Reframe ambiguity as opportunity. When others see chaos, train yourself to see possibility. Ask: "What advantage does this uncertainty give us that our competitors don''t have?"', 103);

-- Nimble Learning (016)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000016', 'positive', '[DEV TIP] After every significant experience — success or failure — write three lessons learned. Keep a learning journal and review it monthly. Patterns will emerge that accelerate your growth.', 101),
('a0000001-0000-0000-0000-000000000016', 'positive', '[DEV TIP] Deliberately seek feedback from people who will be honest with you, not just supportive. Ask specific questions: "What''s one thing I should do differently?" Act on it visibly.', 102),
('a0000001-0000-0000-0000-000000000016', 'positive', '[DEV TIP] When tackling something new, give yourself permission to be a beginner. Set a "learning sprint" — 2 weeks of intensive focus — and measure progress against a specific skill milestone.', 103);

-- Being Resilient (017)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000017', 'positive', '[DEV TIP] Develop a personal recovery routine for high-pressure periods: physical exercise, mindfulness, or time with people who recharge you. Resilience is not about endurance — it''s about recovery.', 101),
('a0000001-0000-0000-0000-000000000017', 'positive', '[DEV TIP] When facing a setback, separate the event from the emotion. Ask: "What happened? What can I learn? What will I do next?" This reframes failure as data, not defeat.', 102),
('a0000001-0000-0000-0000-000000000017', 'positive', '[DEV TIP] Build a support network of trusted colleagues or mentors you can confide in during difficult times. Resilient leaders don''t go it alone — they lean on relationships strategically.', 103);

-- Drives Vision and Purpose (018)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000018', 'positive', '[DEV TIP] Craft a compelling narrative for your team''s purpose: why does your work matter? Connect daily tasks to a bigger mission. People don''t follow plans — they follow meaning.', 101),
('a0000001-0000-0000-0000-000000000018', 'positive', '[DEV TIP] Share your vision consistently and in multiple formats — town halls, one-on-ones, written updates. Repetition is not redundancy; it''s reinforcement. A vision heard once is a vision forgotten.', 102),
('a0000001-0000-0000-0000-000000000018', 'positive', '[DEV TIP] Involve your team in shaping the vision, not just executing it. When people co-create the destination, they''re far more committed to the journey. Ask: "What does success look like to you?"', 103);

-- PEOPLE DOMAIN

-- Communicates Effectively (019)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000019', 'positive', '[DEV TIP] Before any important communication, ask yourself three questions: Who is my audience? What do they need to hear? What do I want them to do? Tailor your message accordingly.', 101),
('a0000001-0000-0000-0000-000000000019', 'positive', '[DEV TIP] Practice the "pyramid principle" — lead with your conclusion, then provide supporting evidence. Busy executives want the answer first and the reasoning second.', 102),
('a0000001-0000-0000-0000-000000000019', 'positive', '[DEV TIP] Record yourself during a presentation and review it critically. Pay attention to pace, filler words, eye contact, and whether your body language matches your message. Improve one element at a time.', 103);

-- Persuades (020)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000020', 'positive', '[DEV TIP] Before making a proposal, map each stakeholder''s priorities and concerns. Frame your argument in terms of what matters to THEM, not what matters to you. Persuasion starts with empathy.', 101),
('a0000001-0000-0000-0000-000000000020', 'positive', '[DEV TIP] Build your case with data and evidence, but deliver it with stories and examples. Facts convince the mind; stories move people to action. Prepare both for every important pitch.', 102),
('a0000001-0000-0000-0000-000000000020', 'positive', '[DEV TIP] When you encounter resistance, don''t push harder — ask questions. "Help me understand your concern" opens doors that "Let me explain why you''re wrong" slams shut.', 103);

-- Manages Conflict (021)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000021', 'positive', '[DEV TIP] Address conflict early — don''t let tensions simmer. Have the conversation within 48 hours. Start with "I''ve noticed..." not "You always..." Focus on behavior, not personality.', 101),
('a0000001-0000-0000-0000-000000000021', 'positive', '[DEV TIP] In heated discussions, listen before responding. Paraphrase the other person''s position to their satisfaction before presenting yours. People can''t hear your point until they feel heard.', 102),
('a0000001-0000-0000-0000-000000000021', 'positive', '[DEV TIP] Separate the person from the problem. In the GCC business context, preserving relationships is paramount. Find solutions that allow all parties to maintain dignity and save face.', 103);

-- Negotiation (022)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000022', 'positive', '[DEV TIP] Prepare for every negotiation by identifying your BATNA (Best Alternative to a Negotiated Agreement). Knowing your walk-away point gives you confidence and prevents bad deals.', 101),
('a0000001-0000-0000-0000-000000000022', 'positive', '[DEV TIP] In negotiations, focus on interests rather than positions. Ask "Why is this important to you?" instead of debating demands. Creative solutions emerge when underlying needs are understood.', 102),
('a0000001-0000-0000-0000-000000000022', 'positive', '[DEV TIP] Practice the art of strategic silence. After making a proposal, stop talking. Let the other party respond. Many negotiators concede unnecessarily because they fill silence with more concessions.', 103);

-- Builds Networks (023)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000023', 'positive', '[DEV TIP] Invest 15 minutes daily in relationship maintenance: a brief check-in message, a shared article, or a coffee invitation. Relationships compound like interest — small, consistent investments yield large returns.', 101),
('a0000001-0000-0000-0000-000000000023', 'positive', '[DEV TIP] Map your network across three categories: operational (people you need to get work done), personal (trusted advisors), and strategic (people who connect you to future opportunities). Fill the gaps deliberately.', 102),
('a0000001-0000-0000-0000-000000000023', 'positive', '[DEV TIP] Be a connector: when you meet someone, think about who else in your network would benefit from knowing them. The most powerful networkers create value for others first.', 103);

-- Develops Talent (024)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000024', 'positive', '[DEV TIP] Hold monthly one-on-one development conversations with each direct report — separate from performance reviews. Ask: "What do you want to learn? Where do you want to be in two years? How can I help?"', 101),
('a0000001-0000-0000-0000-000000000024', 'positive', '[DEV TIP] Delegate for development, not just efficiency. Assign stretch tasks that build capability. Accept that they''ll take longer initially — you''re investing in your team''s future capacity.', 102),
('a0000001-0000-0000-0000-000000000024', 'positive', '[DEV TIP] Give feedback within 24 hours of the observed behavior — specific, balanced, and forward-looking. The formula: "I observed [behavior], the impact was [result], next time consider [suggestion]."', 103);

-- Builds Effective Teams (025)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000025', 'positive', '[DEV TIP] Define clear team norms: how do we make decisions? How do we handle disagreements? How do we communicate urgency? Teams with explicit agreements outperform those with implicit assumptions.', 101),
('a0000001-0000-0000-0000-000000000025', 'positive', '[DEV TIP] Celebrate team wins publicly and handle individual performance issues privately. Recognition builds cohesion; public criticism destroys it. Create rituals that reinforce "we" over "I."', 102),
('a0000001-0000-0000-0000-000000000025', 'positive', '[DEV TIP] Ensure every team member understands how their role contributes to the team''s mission. When people see meaning in their work, engagement and collaboration naturally increase.', 103);

-- Collaboration (026)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000026', 'positive', '[DEV TIP] In meetings, make it a habit to ask quieter team members for their input directly. Diverse perspectives improve decision quality. Say: "I''d like to hear your view on this" — and mean it.', 101),
('a0000001-0000-0000-0000-000000000026', 'positive', '[DEV TIP] When working across departments, invest time understanding their priorities and constraints before asking for their support. Collaboration starts with curiosity about the other side''s reality.', 102),
('a0000001-0000-0000-0000-000000000026', 'positive', '[DEV TIP] Share credit generously and visibly. When presenting a success, name the contributors. Teams that feel recognized collaborate more willingly on the next challenge.', 103);

-- Instills Trust (027)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000027', 'positive', '[DEV TIP] Make only commitments you can keep. If circumstances change, communicate immediately and renegotiate. Your reliability is your reputation — protect it above all else.', 101),
('a0000001-0000-0000-0000-000000000027', 'positive', '[DEV TIP] Be transparent about your reasoning, even when the decision is unpopular. People trust leaders who explain "why" — even when they disagree with the "what."', 102),
('a0000001-0000-0000-0000-000000000027', 'positive', '[DEV TIP] Admit mistakes promptly and without excuses. Vulnerability builds trust faster than perfection. Say: "I got that wrong. Here''s what I''m doing to fix it."', 103);

-- Situational Adaptability (028)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000028', 'positive', '[DEV TIP] Observe how effective leaders adjust their style in different situations — formal board meetings versus informal team huddles. Note what they change: tone, pace, vocabulary, level of detail.', 101),
('a0000001-0000-0000-0000-000000000028', 'positive', '[DEV TIP] Before entering any interaction, pause and ask: "What does this situation require — direction, collaboration, support, or challenge?" Choose your approach deliberately rather than defaulting to one style.', 102),
('a0000001-0000-0000-0000-000000000028', 'positive', '[DEV TIP] Seek feedback specifically on your adaptability: "Do I adjust my approach enough for different people and situations?" The gap between your intention and others'' experience is your development opportunity.', 103);

-- SELF DOMAIN

-- Self-Awareness (029)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000029', 'positive', '[DEV TIP] Seek 360-degree feedback annually from your manager, peers, and direct reports. Focus on patterns, not outliers. Create a development plan that addresses your two biggest blind spots.', 101),
('a0000001-0000-0000-0000-000000000029', 'positive', '[DEV TIP] Keep a weekly reflection journal: What went well? What triggered a strong reaction in me? What would I do differently? Self-awareness grows through deliberate reflection, not just experience.', 102),
('a0000001-0000-0000-0000-000000000029', 'positive', '[DEV TIP] Pay attention to your emotional triggers in the workplace. When you feel a strong reaction, pause before responding. Understanding your triggers is the foundation of emotional self-management.', 103);

-- Emotional Intelligence (030)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000030', 'positive', '[DEV TIP] In every important conversation, listen for the emotion behind the words. Ask yourself: "What is this person feeling?" Acknowledging emotions — "I can see this is frustrating" — builds connection faster than logic.', 101),
('a0000001-0000-0000-0000-000000000030', 'positive', '[DEV TIP] Before reacting to a stressful situation, practice the "pause and name" technique: pause, identify the emotion you''re feeling, then choose your response. The space between stimulus and response is where leadership lives.', 102),
('a0000001-0000-0000-0000-000000000030', 'positive', '[DEV TIP] Study the communication preferences of your key stakeholders. Some need detailed data; others need the big picture. Some want time to process; others decide in the moment. Adapt to their emotional style.', 103);

-- Courage (031)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000031', 'positive', '[DEV TIP] Practice speaking up in low-stakes situations first — offering a dissenting view in a team meeting, sharing constructive feedback with a peer. Build your courage muscle gradually.', 101),
('a0000001-0000-0000-0000-000000000031', 'positive', '[DEV TIP] When facing a difficult conversation, prepare your opening statement in advance. Write it down. Rehearse it. The first 30 seconds set the tone — make them count.', 102),
('a0000001-0000-0000-0000-000000000031', 'positive', '[DEV TIP] Reframe courage not as fearlessness but as acting despite fear. Ask yourself: "What''s the cost of NOT speaking up?" Often, silence is riskier than candor.', 103);

-- Integrity (032)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000032', 'positive', '[DEV TIP] Define your non-negotiable values — the lines you will not cross regardless of pressure. Write them down and review them when facing ethical dilemmas. Clarity prevents compromise.', 101),
('a0000001-0000-0000-0000-000000000032', 'positive', '[DEV TIP] When you observe unethical behavior, address it — even when it''s uncomfortable. In the GCC business culture, respectful private conversation is more effective than public confrontation.', 102),
('a0000001-0000-0000-0000-000000000032', 'positive', '[DEV TIP] Ensure your actions match your words consistently. People judge integrity not by what you say in speeches but by what you do when no one is watching and when doing the right thing is costly.', 103);

-- Cultural Sensitivity (033)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000033', 'positive', '[DEV TIP] Learn the business customs, communication norms, and social protocols of the cultures you work with most frequently. Understanding the role of hierarchy, consensus, and relationship in GCC business culture is essential.', 101),
('a0000001-0000-0000-0000-000000000033', 'positive', '[DEV TIP] When working with diverse teams, ask questions rather than making assumptions. "How is this typically handled in your context?" shows respect and prevents cultural missteps.', 102),
('a0000001-0000-0000-0000-000000000033', 'positive', '[DEV TIP] Celebrate cultural diversity in your team: acknowledge religious holidays, respect dietary requirements, and create space for different working styles. Inclusion is not a policy — it''s a daily practice.', 103);

-- Learning Agility (034)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000034', 'positive', '[DEV TIP] Set a "learning goal" alongside every performance goal. For each project, identify one new skill you want to develop through the experience. Learning agility is intentional, not accidental.', 101),
('a0000001-0000-0000-0000-000000000034', 'positive', '[DEV TIP] Teach what you learn. Explaining a new concept to others deepens your own understanding. Offer to run a 15-minute knowledge-sharing session for your team each month.', 102),
('a0000001-0000-0000-0000-000000000034', 'positive', '[DEV TIP] When you encounter failure, conduct a personal "after-action review" within 48 hours: What did I expect? What actually happened? What will I do differently? The fastest learners are the fastest failers.', 103);

-- Self-Development (035)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000035', 'positive', '[DEV TIP] Create a personal development plan with specific goals, actions, and timelines. Review it quarterly with a mentor or coach. Development without structure is just wishful thinking.', 101),
('a0000001-0000-0000-0000-000000000035', 'positive', '[DEV TIP] Invest in your development using the 70-20-10 model: 70% from challenging experiences, 20% from relationships and feedback, 10% from formal learning. Don''t over-rely on courses alone.', 102),
('a0000001-0000-0000-0000-000000000035', 'positive', '[DEV TIP] Find a mentor who excels in your weakest area — not someone who shares your strengths. The most valuable development relationships are complementary, not comfortable.', 103);

-- Composure (036)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000036', 'positive', '[DEV TIP] Develop a personal "reset" technique for high-pressure moments: deep breathing, stepping away briefly, or reframing the situation. Practice it in low-stakes settings so it becomes automatic when stakes are high.', 101),
('a0000001-0000-0000-0000-000000000036', 'positive', '[DEV TIP] When under pressure, slow down your speech and lower your voice. This projects calm confidence and gives your brain time to think clearly. Others take their emotional cues from you.', 102),
('a0000001-0000-0000-0000-000000000036', 'positive', '[DEV TIP] After a stressful event, debrief with a trusted colleague. Processing pressure out loud prevents it from accumulating. Leaders who appear most composed often have the strongest support systems.', 103);

-- Work-Life Balance (037)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000037', 'positive', '[DEV TIP] Set clear boundaries around your non-work time and communicate them to your team. Model the behavior you want: if you email at midnight, your team will feel they must too.', 101),
('a0000001-0000-0000-0000-000000000037', 'positive', '[DEV TIP] Schedule recovery time as deliberately as you schedule meetings. Block time for exercise, family, and rest. Sustainable high performance requires intentional renewal — not just effort.', 102),
('a0000001-0000-0000-0000-000000000037', 'positive', '[DEV TIP] Regularly audit where your time goes versus where it should go. If your calendar doesn''t reflect your priorities, redesign it. Time is the most honest indicator of what you truly value.', 103);

-- Resourcefulness (038)
INSERT INTO behavioral_indicators (competency_id, indicator_type, description, sort_order) VALUES
('a0000001-0000-0000-0000-000000000038', 'positive', '[DEV TIP] Before requesting additional resources, challenge yourself: "Can we achieve this with what we already have?" Constraints often produce the most creative solutions. Resourcefulness is a mindset, not a budget.', 101),
('a0000001-0000-0000-0000-000000000038', 'positive', '[DEV TIP] Build relationships with colleagues across the organization who have complementary resources and skills. The most resourceful leaders know who to call — not just what to do.', 102),
('a0000001-0000-0000-0000-000000000038', 'positive', '[DEV TIP] When facing a resource constraint, reframe the question: instead of "How do I get more?" ask "How do I get more from what I have?" Audit existing assets, tools, and capabilities for untapped potential.', 103);
