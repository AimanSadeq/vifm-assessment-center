// Shared content for the VIFM CBI pack. Definitions, indicators and scale
// anchors come from the live Caliber v2 behavioural framework (competencies,
// behavioral_indicators, competency_scale_anchors). Questions and probes are
// authored here for the pack in STAR-L form; the Caliber qa_questions seeds
// informed them but none is reused verbatim.

const ROLE = {
  title: "Senior Finance Manager",
  sector: "Financial services (illustrative)",
  level: "Senior manager, reports to the CFO",
  client: "Sample Client",
  duration: 120,
};

// The 21-competency framework, for the deck (first sentence of each definition).
const FRAMEWORK = [
  { domain: "THINKING", cluster: "Strategic & Commercial Reasoning", comps: [
    ["Critical Analysis & Judgement", "Breaks ambiguous, data-heavy problems into their parts, tests assumptions, and turns the reasoning into timely, balanced decisions."],
    ["Strategic & Commercial Insight", "Reads the competitive, economic and regulatory landscape and converts that insight into a clear, prioritised direction framed around long-term value."],
  ]},
  { domain: "THINKING", cluster: "Innovation & Complexity", comps: [
    ["Creative Problem-Solving", "Generates and tests original approaches that improve products, processes or outcomes instead of defaulting to precedent."],
    ["Navigating Complexity & Ambiguity", "Makes sense of high-volume, interdependent and conflicting information, and stays decisive when direction, data or conditions are unclear."],
  ]},
  { domain: "RESULTS", cluster: "Delivery & Execution", comps: [
    ["Proactive Initiative", "Moves on opportunities and tough challenges early and with energy, rather than waiting to be directed."],
    ["Delivery & Accountability", "Takes personal responsibility for measurable results and follows through from commitment to completion, owning mistakes openly."],
    ["Planning & Resourcing", "Sequences work so the most important commitments are met, and secures and deploys the people, budget and tools the work needs."],
    ["Process Optimisation", "Designs and improves workflows for efficiency and control, removing waste without sacrificing compliance or quality."],
  ]},
  { domain: "RESULTS", cluster: "Customer & Stakeholder Focus", comps: [
    ["Customer & Stakeholder Focus", "Understands and anticipates the needs of customers and stakeholders, internal and external, and delivers reliably against them."],
  ]},
  { domain: "PEOPLE", cluster: "Influence & Communication", comps: [
    ["Clear & Adaptive Communication", "Conveys complex content clearly, tailoring message, tone and medium to the audience, and listens to check understanding."],
    ["Influence & Agreement", "Builds well-reasoned, audience-aware cases that win genuine commitment, and resolves disagreement directly and calmly."],
    ["Networks & Collaboration", "Builds and sustains useful relationships inside and outside the organisation, investing in them before they are needed."],
  ]},
  { domain: "PEOPLE", cluster: "Leading & Developing Others", comps: [
    ["Coaching & Talent Growth", "Actively develops others toward both their own potential and the organisation's future needs."],
    ["Building Cohesive Teams", "Forms teams with a shared identity and purpose that combine diverse strengths to deliver together."],
    ["Mobilising Around Purpose", "Articulates a compelling sense of direction that connects people's work to a larger goal and motivates action."],
  ]},
  { domain: "SELF", cluster: "Growth & Personal Effectiveness", comps: [
    ["Resilience & Composure", "Stays calm, clear and constructive under pressure, scrutiny and setbacks, and recovers quickly from disappointment."],
    ["Learning Agility", "Learns rapidly from new and first-time situations and applies the lessons in unfamiliar conditions."],
  ]},
  { domain: "SELF", cluster: "Integrity & Character", comps: [
    ["Integrity & Principled Courage", "Acts honestly and fairly, within the spirit as well as the letter of professional standards, and challenges poor decisions."],
    ["Self-Insight", "Uses feedback and honest reflection to understand own strengths, limits, and impact on others."],
    ["Emotional Regulation & Empathy", "Recognises and manages own emotions and reads others' accurately, responding in ways that fit the situation."],
    ["Cultural & Inclusive Sensitivity", "Understands and respects diverse norms and perspectives, and works inclusively across them."],
  ]},
];

const SCALE = [
  { point: 5, label: "Role model", meaning: "Consistently exceeds the role requirement; several strong, specific examples with clear personal ownership." },
  { point: 4, label: "Above requirement", meaning: "Above requirement in most situations; clear positive evidence with few gaps." },
  { point: 3, label: "Meets requirement", meaning: "Adequate; meets the role requirement, evidence may be uneven across the indicators." },
  { point: 2, label: "Development needed", meaning: "Below requirement; limited or mixed evidence, some negative indicators present." },
  { point: 1, label: "Significant gap", meaning: "Little or no positive evidence; negative indicators dominate the examples given." },
  { point: "NE", label: "No evidence", meaning: "The interview produced no usable evidence for this competency. Never rated as a 1." },
];

// The six interview competencies for the illustrative role.
const SIX = [
  {
    key: "caj", domain: "THINKING", name: "Critical Analysis & Judgement", target: 4, priority: "High",
    definition: "Breaks ambiguous, data-heavy problems into their parts, tests assumptions, and weighs competing explanations before reaching a view. Turns that reasoning into timely, balanced decisions, even when information is incomplete, weighing risk, stakeholders and second-order consequences. Stands behind decisions with reasoning that holds up to scrutiny.",
    whyRole: "A senior finance manager is the organisation's check on the numbers and the story behind them. Weak judgement here reaches the board.",
    positive: [
      "Judges the relevance and importance of different pieces of information accurately",
      "Identifies underlying relationships, causes and effects",
      "Identifies potential weaknesses in proposals or plans",
      "Makes well-informed decisions after considering the relevant information",
      "Decides on a course of action without unnecessary delay",
      "Takes accountability for decisions made",
    ],
    negative: [
      "Draws conclusions without sufficient evidence",
      "Fails to identify inconsistencies in data or arguments",
      "Avoids making decisions or defers unnecessarily",
      "Makes decisions without considering relevant information or alternatives",
    ],
    questions: [
      { q: "Tell me about a time the numbers you were given did not add up, and you had to get to the bottom of it.",
        probes: ["What first made you doubt the figures?", "How did you separate the cause from the symptoms?", "What did you decide, and what happened as a result?"] },
      { q: "Describe a significant decision you had to make with incomplete information.",
        probes: ["What did you know, and what did you have to assume?", "How did you weigh the risks and the people affected?", "Looking back, what would you do differently?"] },
      { q: "Give me an example of a proposal or business case you challenged because you saw a weakness others had missed.",
        probes: ["What was the weakness and how did you find it?", "How did the people behind the proposal respond?", "What was the outcome for the organisation?"] },
    ],
    anchors: {
      1: "Jumps to conclusions without examining available data or testing assumptions. Defers decisions repeatedly or avoids taking a position when asked to recommend a course of action, even when information is sufficient.",
      2: "Reviews some information but misses key inconsistencies or fails to distinguish relevant from irrelevant data. Reaches a decision eventually but overlooks important risks, stakeholder concerns, or alternative options in the reasoning presented.",
      3: "Systematically examines the main elements of the problem, identifies obvious inconsistencies, and tests key assumptions. Reaches a timely, balanced decision that considers the primary risks and stakeholder needs, and explains the rationale clearly when challenged.",
      4: "Quickly distinguishes critical from peripheral information, uncovers hidden problems, and weighs multiple competing explanations before deciding. Makes sound decisions under pressure, anticipates second-order consequences, and defends choices with well-structured reasoning that withstands scrutiny.",
      5: "Dissects highly ambiguous, data-heavy problems with precision, probes underlying causes, and surfaces weaknesses others miss. Makes difficult, well-justified decisions confidently despite incomplete information, articulates trade-offs clearly, and influences others' thinking through the quality and transparency of reasoning demonstrated.",
    },
    devTips: [
      "When faced with a complex problem, resist jumping to solutions. Use a structured frame: define the problem, gather data from more than one source, identify root causes, generate alternatives and evaluate trade-offs before deciding.",
      "For high-stakes decisions, prepare a decision matrix that scores each option against weighted criteria and share it with stakeholders to build transparency around your reasoning.",
      "After each significant decision, hold a brief review: what data did we use, what did we miss, what would we do differently.",
    ],
  },
  {
    key: "sci", domain: "THINKING", name: "Strategic & Commercial Insight", target: 3.5, priority: "Medium",
    definition: "Reads the competitive, economic and regulatory landscape and anticipates how markets and client needs will shift. Converts that insight into a clear, prioritised direction framed around long-term value, and links day-to-day work to the commercial outcomes it should produce. Sets direction others can understand, align to and act on.",
    whyRole: "The role turns financial data into direction for the business, not only a record of it.",
    positive: [
      "Shows an overall view of the business and its links to the external environment",
      "Shows awareness of the revenue, cost and risk factors that drive performance",
      "Anticipates future trends and opportunities before they arrive",
      "Demonstrates long-term thinking when setting goals",
      "Prioritises financial considerations when making decisions",
      "Identifies new and promising business opportunities",
    ],
    negative: [
      "Focuses only on short-term solutions without considering strategic implications",
      "Overlooks market trends or competitive threats",
      "Fails to consider the broader impact of decisions on other departments",
      "Makes decisions without considering financial impact",
    ],
    questions: [
      { q: "Tell me about a time you used financial analysis to change a commercial or strategic decision in your organisation.",
        probes: ["What did the analysis show that others had not seen?", "How did you connect it to the longer-term direction?", "What changed as a result, and how did you measure it?"] },
      { q: "Describe a time you saw a market, economic or regulatory shift coming and acted on it before it hit.",
        probes: ["What signals did you pick up, and where from?", "What did you do, and who did you need to convince?", "How did it play out?"] },
      { q: "Give me an example of a trade-off between short-term results and long-term value that you had to make.",
        probes: ["What were the options and their financial consequences?", "How did you reach your view?", "What was the result over the following year?"] },
    ],
    anchors: {
      1: "Focuses exclusively on immediate tasks without acknowledging broader market context or competitive factors. Makes recommendations that ignore financial implications or impact on other business areas, demonstrating no awareness of long-term consequences.",
      2: "References market conditions when prompted but offers limited analysis of competitive threats or opportunities. Proposes solutions focused primarily on short-term fixes with minimal consideration of cost implications or strategic alignment.",
      3: "Articulates how current market trends affect the business and connects proposed actions to revenue or cost drivers. Explains priorities with clear rationale that balances immediate needs with longer-term commercial objectives in an understandable way.",
      4: "Proactively identifies emerging market opportunities or regulatory shifts and explains how these create specific business value. Frames recommendations around long-term positioning while clearly linking daily activities to measurable commercial outcomes that resonate with stakeholders.",
      5: "Synthesises complex competitive, economic and regulatory intelligence to paint a compelling future scenario that shifts others' thinking. Translates this vision into prioritised strategic initiatives with explicit commercial logic that mobilises teams and drives alignment across organisational boundaries.",
    },
    devTips: [
      "Before any significant decision, write down the three-year impact and connect the action to a strategic objective.",
      "Set aside thirty minutes a week for industry and regional economic reports, and bring three implications for the organisation to the leadership team.",
      "Tie each major initiative to a measurable commercial or customer outcome, and report on it in business terms.",
    ],
  },
  {
    key: "da", domain: "RESULTS", name: "Delivery & Accountability", target: 4, priority: "High",
    definition: "Takes personal responsibility for measurable results and follows through from commitment to completion, sustaining standards when conditions are difficult. Holds self and others to what was promised, owns mistakes openly and fixes them rather than shifting blame. Builds a track record of reliability the organisation can plan around.",
    whyRole: "Close, reporting and audit deadlines do not move. The organisation plans around this person's reliability.",
    positive: [
      "Follows through on promises and commitments",
      "Works well under pressure and meets tight deadlines",
      "Attends to multiple tasks without losing focus",
      "Accepts appropriate responsibility when things go wrong",
      "Maintains standards when carrying out demanding tasks",
      "Adheres to the organisation's regulations and policies",
    ],
    negative: [
      "Fails to meet commitments or deadlines",
      "Blames others when things go wrong",
      "Loses focus when managing multiple priorities",
      "Fails to follow through on commitments",
    ],
    questions: [
      { q: "Tell me about the most demanding deadline you have delivered against, where the quality could not slip.",
        probes: ["What made it demanding?", "What did you personally do to protect both the date and the standard?", "What was the result?"] },
      { q: "Describe a time you or your team got something wrong that mattered, and what you did about it.",
        probes: ["How did you find out, and how quickly did you own it?", "What did you say to the people affected?", "What did you put in place so it would not recur?"] },
      { q: "Give me an example of a commitment you could not keep. What happened?",
        probes: ["When did you realise, and who did you tell?", "What did you offer instead?", "What did you learn about how you commit?"] },
    ],
    anchors: {
      1: "Misses deadlines without prior notice, blames external factors or colleagues when tasks are incomplete, and fails to follow through on multiple commitments made during discussions.",
      2: "Completes some tasks but misses agreed timelines on others, offers explanations that minimise personal responsibility, and loses track of commitments when handling multiple priorities simultaneously.",
      3: "Delivers agreed tasks on time consistently, acknowledges own role when discussing setbacks without deflecting blame, and maintains steady focus across concurrent responsibilities while adhering to established procedures.",
      4: "Proactively updates others on progress, meets demanding deadlines while maintaining quality standards, openly admits errors and immediately proposes corrective actions that address root causes effectively.",
      5: "Sets and meets demanding deadlines without letting quality slip, flags risks to delivery before they land, owns the team's shortfalls as well as their own, and puts in place a fix that stops the problem recurring.",
    },
    devTips: [
      "At the start of every project or meeting, state who owns what by when, write it down and follow up. Make accountability visible, not punitive.",
      "When things go wrong, model ownership: say what happened and what you are doing about it before anyone asks.",
      "Use an impact-effort view of your priorities each week, and protect the high-impact commitments first.",
    ],
  },
  {
    key: "ia", domain: "PEOPLE", name: "Influence & Agreement", target: 3.5, priority: "Medium",
    definition: "Builds well-reasoned, audience-aware cases that win genuine commitment, and addresses concerns rather than overriding them. Surfaces and resolves disagreement directly and calmly, keeping the focus on the issue. Reaches durable agreements through preparation and fair trade-offs, holding firm on what matters while staying flexible on how.",
    whyRole: "Budgets, controls and cost decisions are won through business heads, auditors and the board, not imposed.",
    positive: [
      "Develops logical arguments from facts and data",
      "Positions arguments with the viewpoints and concerns of others in mind",
      "Remains committed to a position when faced with opposition where it matters",
      "Manages conflict with a minimum of noise",
      "Negotiates to gain agreement and reach mutually beneficial outcomes",
      "Navigates political situations sensitively and diplomatically",
    ],
    negative: [
      "Relies on position or authority rather than evidence to persuade",
      "Avoids conflict situations rather than addressing them",
      "Concedes too easily without pursuing the best outcome",
      "Takes an inflexible position that prevents agreement",
    ],
    questions: [
      { q: "Tell me about a time you had to win support for a financial decision that a senior stakeholder opposed.",
        probes: ["How did you prepare, and what did you learn about their concerns?", "What did you hold firm on, and where did you flex?", "What agreement did you reach, and did it hold?"] },
      { q: "Describe a disagreement between you and a business unit over budget, cost or control, and how you resolved it.",
        probes: ["How did you keep it on the issue rather than the people?", "What trade-off made the agreement possible?", "How was the relationship afterwards?"] },
      { q: "Give me an example of a time you had to say no to a request from someone senior to you.",
        probes: ["How did you make the case?", "How did they react, and what did you do next?", "What was the outcome?"] },
    ],
    anchors: {
      1: "Presents weak or unsupported arguments that fail to persuade others. Avoids addressing objections directly, either conceding immediately or becoming defensive. Leaves disagreements unresolved or escalates minor issues unnecessarily.",
      2: "Offers arguments with some supporting facts but struggles to adapt message to audience concerns. Addresses disagreements hesitantly or inconsistently. Reaches agreements but misses opportunities for better outcomes through premature compromise.",
      3: "Builds logical cases using relevant facts and data tailored to the audience. Addresses objections calmly and directly, keeping discussions focused on issues rather than personalities. Reaches fair agreements through balanced trade-offs that meet core objectives.",
      4: "Delivers compelling, evidence-based arguments that demonstrate clear understanding of others' perspectives and concerns. Navigates disagreements diplomatically, surfacing underlying issues and finding creative solutions. Achieves outcomes that gain genuine commitment while holding firm on critical points.",
      5: "Presents persuasive cases that connect facts to emotional viewpoints, visibly shifting others' thinking and earning credibility. Transforms conflicts into productive dialogue through skilled questioning and reframing. Negotiates durable agreements that optimise outcomes for all parties and build lasting consensus.",
    },
    devTips: [
      "Before any proposal, map each stakeholder's priorities and concerns and frame the case in terms of what matters to them.",
      "When you meet resistance, ask questions rather than push harder. \"Help me understand your concern\" opens doors.",
      "Prepare each negotiation by naming your walk-away point and the interests behind the other side's position.",
    ],
  },
  {
    key: "ctg", domain: "PEOPLE", name: "Coaching & Talent Growth", target: 3.5, priority: "Medium",
    definition: "Actively develops others toward both their own potential and the organisation's future needs. Combines honest, specific feedback with stretching opportunities and the support to succeed in them, adapting to each person's readiness and aspirations. Builds capability and confidence that outlast any single task and strengthen the wider talent pipeline.",
    whyRole: "The finance team's bench strength is this manager's responsibility, and the CFO's succession depends on it.",
    positive: [
      "Provides objective and timely feedback to others",
      "Identifies the strengths and limitations of others accurately",
      "Encourages others to consider and pursue development opportunities",
      "Clearly defines roles, responsibilities and objectives for others",
      "Monitors the performance of others and follows up",
      "Judges the future potential of others accurately",
    ],
    negative: [
      "Does not provide feedback or development guidance",
      "Fails to recognise or nurture potential in team members",
      "Delegates for convenience rather than for growth",
      "Lets performance problems drift rather than addressing them",
    ],
    questions: [
      { q: "Tell me about someone you developed who went on to take a bigger role.",
        probes: ["What potential did you see, and how?", "What specifically did you do, and how did you adapt it to them?", "Where are they now, and what part did you play?"] },
      { q: "Describe a time you had to give difficult feedback to a team member about their performance.",
        probes: ["How did you prepare, and what did you actually say?", "How did they respond?", "What changed over the following months?"] },
      { q: "Give me an example of a stretch assignment you gave someone that carried a real risk of failure.",
        probes: ["Why that person and that task?", "How did you support them without taking it back?", "What was the result for them and for the work?"] },
    ],
    anchors: {
      1: "Avoids giving feedback to others or offers only vague, unhelpful comments. Misses obvious development needs and shows no interest in discussing growth opportunities or future potential with team members.",
      2: "Gives feedback occasionally but lacks specificity or timeliness. Recognises some development needs when prompted but provides limited guidance on how to address them or pursue growth opportunities.",
      3: "Provides clear, objective feedback on performance and defines roles and responsibilities adequately. Identifies strengths and development areas, discusses relevant growth opportunities, and monitors progress in a structured manner.",
      4: "Delivers timely, specific feedback tailored to individual readiness and actively encourages pursuit of stretching development opportunities. Accurately assesses potential and adapts support to build confidence and capability beyond immediate tasks.",
      5: "Gives candid, specific feedback the other person can act on, links it to a stretching opportunity that fits both their aspirations and the organisation's needs, and agrees concrete next steps and how progress will be checked.",
    },
    devTips: [
      "Hold a monthly development conversation with each direct report, separate from performance reviews: what do you want to learn, where do you want to be in two years, how can I help.",
      "Delegate for development, not only for efficiency. Assign stretch tasks that build capability and accept that they take longer at first.",
      "Give feedback within a day of the observed behaviour: what you observed, the impact it had, and what to consider next time.",
    ],
  },
  {
    key: "rc", domain: "SELF", name: "Resilience & Composure", target: 3.5, priority: "Medium",
    definition: "Stays calm, clear and constructive under pressure, scrutiny and setbacks, keeping emotion in check so thinking stays sharp. Recovers quickly from disappointment and learns from it. Manages energy and the competing demands of work and life so performance holds up over time, not just in the moment.",
    whyRole: "Year-end, audits, regulator queries and board scrutiny arrive together. Composure under that load sets the tone for the team.",
    positive: [
      "Remains calm and objective under pressure",
      "Retains focus and concentration when under pressure at work",
      "Keeps difficulties in perspective and displays optimism in negative situations",
      "Does not openly show frustration or dissatisfaction",
      "Manages energy and workload sustainably",
      "Models sustainable work practices for others",
    ],
    negative: [
      "Loses composure or focus under pressure",
      "Shows visible frustration when things go wrong",
      "Loses concentration or makes errors under pressure",
      "Consistently overworks to the detriment of wellbeing, or expects the team to do the same",
    ],
    questions: [
      { q: "Tell me about the most pressured period you have worked through, when several demands landed at once.",
        probes: ["What was the pressure, and how did it show up in you?", "What did you do to keep your thinking clear and the team steady?", "What was the outcome, and what did it cost you?"] },
      { q: "Describe a setback at work that genuinely knocked you back.",
        probes: ["What happened, and how did you react in the first days?", "What helped you recover?", "What did you take from it?"] },
      { q: "Give me an example of being challenged hard in public, by a board member, auditor or regulator, for instance.",
        probes: ["What was said, and what did you feel?", "How did you respond in the moment?", "What happened afterwards?"] },
    ],
    anchors: {
      1: "Becomes visibly flustered when challenged or when time runs short, loses focus and makes avoidable errors, and lets a setback early in the exercise affect the rest of the task.",
      2: "Maintains composure in routine situations but shows signs of stress when pressure increases. Occasionally displays frustration or loses concentration during challenges, though attempts to regain control and continues working through difficulties.",
      3: "Stays calm and focused as pressure rises, keeping emotions in check and thinking clearly. Recovers from a setback without dwelling on it and keeps performance steady to the end.",
      4: "Stays composed under significant pressure, with sharp focus and constructive responses. Rebounds quickly from a setback, names what can be learned from it and reorganises the remaining work to recover lost ground.",
      5: "Remains clear-headed in the most pressured moments and helps others stay focused. Treats setbacks as information, adjusts quickly and keeps the group's confidence up without playing down the difficulty.",
    },
    devTips: [
      "Build a personal reset for high-pressure moments, such as a breathing routine or stepping away briefly, and practise it in low-stakes settings so it is automatic when it counts.",
      "When facing a setback, separate the event from the emotion: what happened, what can I learn, what will I do next.",
      "Schedule recovery as deliberately as meetings, and set boundaries around non-work time that the team can see you keep.",
    ],
  },
];

// Illustrative sample candidate for the report. Fictional throughout.
const SAMPLE = {
  candidate: "Candidate A (anonymised)",
  interviewDate: "28 September 2026",
  interviewers: ["Lead interviewer: VIFM consultant", "Second interviewer: client HR business partner"],
  calibrated: "Ratings agreed in a calibration discussion immediately after the interview.",
  ratings: {
    caj: { rating: 4, summary: "Two strong examples of getting beneath reported figures. In the first, a working-capital variance of around 12% that the business had attributed to timing was traced to a change in supplier payment terms that had not been approved; the candidate rebuilt the cash forecast and took a corrected position to the CFO within the week. In the second, a business case for a new system was challenged on an unrealistic benefits ramp, which the candidate reworked with the sponsor rather than rejecting outright. Decisions were timely and the candidate stood behind them under probing. Evidence of weighing second-order consequences was present but less developed in the second example.",
      observed: ["Identified underlying causes behind reported figures", "Identified weaknesses in a proposal others had accepted", "Decided without unnecessary delay"], gaps: ["Second-order consequences considered mainly when prompted"] },
    sci: { rating: 3, summary: "The candidate reads the business well and links finance work to revenue and cost drivers, with a clear example of reframing a pricing discussion around margin rather than volume. Examples of anticipating external shifts were thinner: the regulatory change example was reactive, with the candidate responding well once it landed rather than ahead of it. Long-term framing was present but the candidate tended to return to the next budget cycle as the horizon.",
      observed: ["Connected proposed actions to revenue and cost drivers", "Prioritised financial considerations when deciding"], gaps: ["Anticipating market or regulatory shifts before they land", "Framing beyond the annual cycle"] },
    da: { rating: 4, summary: "Consistent evidence of delivering under fixed deadlines without letting standards slip, including a year-end close completed on time after the loss of two team members, with the candidate personally covering reconciliations and flagging the risk to the CFO ten days ahead. When an intercompany error reached the audit committee, the candidate owned it in the meeting, explained the fix and the control change, and did not deflect to the team. The example of a missed commitment was candid and showed early communication.",
      observed: ["Met demanding deadlines while maintaining quality", "Flagged delivery risk before it landed", "Owned an error openly and fixed the root cause"], gaps: [] },
    ia: { rating: 3, summary: "The candidate builds a logical, data-led case and gave a good example of winning a cost-control decision with a reluctant operations head by reframing it around the head's own service targets. In the disagreement example, however, the candidate conceded on a control point to preserve the relationship and later had to revisit it. Saying no to a senior stakeholder was handled respectfully but the case leaned on policy rather than on the stakeholder's interests.",
      observed: ["Developed logical arguments from facts and data", "Addressed disagreement calmly, kept it on the issue"], gaps: ["Holding firm on what matters under senior pressure", "Framing the case around the other party's interests rather than policy"] },
    ctg: { rating: 2, summary: "Development evidence was limited. The candidate described a strong analyst who was promoted, but the candidate's own contribution was mainly to recommend the promotion; structured feedback, stretch assignments or development conversations were not described. The difficult-feedback example was deferred for several months until an appraisal, and the stretch-assignment example was a task delegated for capacity reasons with no follow-up. The candidate was open about this being an area they have not prioritised.",
      observed: ["Identified strength in a team member accurately"], gaps: ["Timely, specific feedback", "Delegation for growth with support and follow-up", "Regular development conversations"] },
    rc: { rating: 4, summary: "Clear, specific evidence of composure under combined pressure: a year-end that coincided with a regulator information request and a system outage. The candidate described re-sequencing the work, protecting the team's hours and keeping the CFO informed daily, and could name what it cost them personally. The public-challenge example from an audit committee member was handled calmly in the moment, with a follow-up the next day. Energy management was described in practical terms, including boundaries the team could see.",
      observed: ["Remained calm and objective under pressure", "Kept the team steady and sequenced the work", "Modelled sustainable practice for the team"], gaps: [] },
  },
};

module.exports = { ROLE, FRAMEWORK, SCALE, SIX, SAMPLE };
