import type { AraPillarId } from "@/types/ara";

/**
 * Per-pillar recommendation library.
 *
 * Replaces the previous score-band-only generator (client review 2026-08-31):
 * that version produced the SAME three titles and the SAME "Expected outcome"
 * for every pillar sharing a band, with only the pillar name interpolated into
 * the body - so an eight-pillar report repeated itself. Actions here are
 * specific to each pillar's subject matter AND to where the organisation sits.
 *
 * Bands (canonical maturity thresholds):
 *   b1 = below 2.0 (Unaware)   b2 = 2.0-2.9 (Exploring)
 *   b3 = 3.0-3.9 (Developing)  b4 = 4.0+ (Advancing / Leading)
 */

export type RecommendationHorizon = "quick" | "build" | "transform";
export type RecommendationEffort = "Low" | "Medium" | "High";

export type Recommendation = {
  title: string;
  body: string;
  horizon: RecommendationHorizon;
  effort: RecommendationEffort;
  outcome: string;
};

type Band = "b1" | "b2" | "b3" | "b4";

const R = (
  title: string,
  body: string,
  horizon: RecommendationHorizon,
  effort: RecommendationEffort,
  outcome: string
): Recommendation => ({ title, body, horizon, effort, outcome });

const LIBRARY: Record<AraPillarId, Record<Band, Recommendation[]>> = {
  strategy: {
    b1: [
      R("Name an executive AI sponsor", "Appoint a named board-level owner for AI with a standing slot on the executive agenda. Without a sponsor, AI work stays departmental and unfunded.", "quick", "Low", "A named sponsor and a recurring executive agenda item."),
      R("Write a one-page AI position", "Draft a single page stating why AI matters to this organisation, which business outcomes it serves, and what is explicitly out of scope for now.", "quick", "Low", "An approved one-page AI position statement."),
      R("Set a first-year ambition", "Agree three measurable outcomes AI should deliver within twelve months, tied to existing corporate KPIs rather than technology milestones.", "build", "Medium", "Three board-agreed, KPI-linked AI outcomes."),
    ],
    b2: [
      R("Convert the position into a funded strategy", "Turn the stated ambition into a documented AI strategy with an owner, a budget line, and a delivery horizon per objective.", "quick", "Medium", "A board-approved AI strategy with an allocated budget."),
      R("Prioritise use cases against value and risk", "Score candidate use cases on business value and delivery risk, then commit to the top three. Publish what was deprioritised and why.", "build", "Medium", "A ranked, published use-case portfolio with three committed initiatives."),
      R("Align AI to the national agenda", "Map the strategy to the relevant national AI programme so public-sector stakeholders and regulators see the alignment explicitly.", "build", "Low", "Documented alignment to national AI priorities."),
    ],
    b3: [
      R("Put AI on the quarterly board agenda", "Move AI from ad-hoc updates to a standing quarterly board review with a consistent dashboard of adoption, value delivered, and risk.", "quick", "Low", "Four scheduled board reviews with a fixed reporting pack."),
      R("Fund a multi-year AI roadmap", "Extend planning beyond the current budget year: a two-to-three-year roadmap with staged investment gates tied to delivered value.", "build", "High", "An approved multi-year roadmap with staged funding gates."),
      R("Benchmark against regional peers", "Commission a structured comparison against comparable GCC organisations to set an evidence-based target rather than an internal one.", "build", "Medium", "A peer benchmark report with a revised target maturity."),
    ],
    b4: [
      R("Publish the AI value case externally", "Convert internal results into a public position: an annual AI statement covering outcomes delivered, governance posture, and forward commitments.", "quick", "Medium", "A published annual AI statement."),
      R("Tie AI objectives to executive scorecards", "Embed AI outcomes into executive performance objectives so ownership survives leadership change.", "build", "Medium", "AI outcomes on named executive scorecards."),
      R("Lead the sector conversation", "Take a convening role - host a peer forum or contribute to a regulator working group - to shape the standards you will be measured against.", "transform", "High", "A standing seat in a sector or regulatory forum."),
    ],
  },
  data: {
    b1: [
      R("Inventory the critical data sources", "List the systems holding the data any AI use case would need, with a named contact per system. You cannot govern what has never been catalogued.", "quick", "Medium", "A data inventory covering the critical systems."),
      R("Assign first data owners", "Name an accountable owner for the three most business-critical datasets, with a one-line remit each.", "quick", "Low", "Three named data owners with documented remits."),
      R("Classify sensitive data", "Run a first-pass classification separating personal, confidential, and open data so early AI work cannot touch what it should not.", "build", "Medium", "A classification applied to the critical inventory."),
    ],
    b2: [
      R("Stand up a data steward model", "Formalise ownership into a steward network with defined responsibilities, meeting cadence, and an escalation path.", "quick", "Medium", "An operating steward network with documented responsibilities."),
      R("Define data quality KPIs", "Agree measurable quality thresholds - completeness, accuracy, timeliness - for the datasets feeding priority use cases, and start reporting them.", "build", "Medium", "Published quality KPIs with a monthly reporting cycle."),
      R("Make DPIAs a gate, not a formality", "Require a data protection impact assessment before any AI system processes personal data, owned by a named reviewer.", "build", "Medium", "A DPIA gate embedded in the intake process."),
    ],
    b3: [
      R("Document lineage to model inputs", "Trace and record the path from source system to model input for production use cases, so an auditor can follow any figure back to its origin.", "quick", "Medium", "Documented lineage for every production model input."),
      R("Automate quality monitoring", "Replace periodic manual checks with automated quality monitoring and alerting on the critical pipelines.", "build", "High", "Automated quality alerts on the critical pipelines."),
      R("Close the shadow-data gap", "Find where teams keep private copies of core datasets and bring them under the governed estate.", "build", "Medium", "Shadow copies retired or brought under governance."),
    ],
    b4: [
      R("Treat data as a managed product", "Move governed datasets to a product model: named product owner, documented consumers, service levels, and a published roadmap.", "build", "High", "Two or more datasets running as managed data products."),
      R("Extend governance to unstructured data", "Bring documents, transcripts, and images into the same classification and quality regime as structured data.", "build", "High", "Unstructured sources covered by the governance model."),
      R("Enable governed data sharing", "Establish the controls that let you share data safely with partners or regulators - the differentiator at this maturity.", "transform", "High", "A governed external data-sharing capability."),
    ],
  },
  technology: {
    b1: [
      R("Confirm where AI workloads may run", "Establish which cloud or on-premise environments are approved for AI workloads, and the data-residency constraints on each.", "quick", "Low", "An approved-environment statement with residency rules."),
      R("Give teams a safe sandbox", "Provide one isolated environment where staff can experiment with AI on non-sensitive data without procurement delays.", "quick", "Medium", "A live sandbox with published access rules."),
      R("Inventory the AI tools already in use", "Survey what staff already use - approved or not - as the factual baseline for a tooling decision.", "build", "Low", "A current-state AI tool inventory."),
    ],
    b2: [
      R("Publish an AI tool approval route", "Define how a new AI tool gets assessed and approved, with a named reviewer and a target turnaround so the route is actually used.", "quick", "Medium", "A published approval route with a stated SLA."),
      R("Set the reference architecture", "Document the standard pattern for building an AI solution here - integration points, identity, logging, data access.", "build", "Medium", "An approved reference architecture."),
      R("Plan for capacity", "Establish how compute is requested and allocated so delivery is not gated by unplanned procurement.", "build", "Medium", "A capacity-management process with a named owner."),
    ],
    b3: [
      R("Introduce MLOps discipline", "Bring versioning, automated deployment, and environment parity to AI systems so releases are repeatable rather than hand-crafted.", "quick", "High", "A CI/CD pipeline covering production AI systems."),
      R("Instrument production monitoring", "Add operational monitoring - latency, error rates, cost - to deployed AI services, with alert routing.", "build", "Medium", "Live operational dashboards with alerting."),
      R("Prove sovereignty controls", "Evidence that AI workloads and their data remain within the required jurisdiction, with configuration to back the claim.", "build", "Medium", "Documented, evidenced data-residency controls."),
    ],
    b4: [
      R("Optimise cost per outcome", "Introduce cost attribution per use case and set efficiency targets, so scale does not simply mean spend.", "quick", "Medium", "Cost-per-use-case reporting with efficiency targets."),
      R("Build for portability", "Reduce single-vendor lock-in on the critical path so model and platform choices stay reversible.", "build", "High", "A documented exit path for each critical dependency."),
      R("Offer AI as an internal platform", "Package the environment so business units can self-serve within guardrails instead of queueing for central delivery.", "transform", "High", "A self-service internal AI platform in use by multiple units."),
    ],
  },
  talent: {
    b1: [
      R("Baseline current AI capability", "Assess the workforce's actual AI literacy rather than assuming it, so training is aimed where it is needed.", "quick", "Medium", "A capability baseline across the relevant population."),
      R("Brief the leadership team first", "Run a half-day executive session on AI vocabulary, realistic capability, and regional precedent - leaders cannot sponsor what they cannot discuss.", "quick", "Low", "Leadership briefed with a shared vocabulary."),
      R("Identify internal champions", "Find the staff already experimenting and give them a formal role rather than leaving the capability informal.", "build", "Low", "A named champion network."),
    ],
    b2: [
      R("Launch role-based AI training", "Move beyond generic awareness to training differentiated by role - analysts, managers, and technical staff need different things.", "quick", "Medium", "Role-based curricula delivered to priority groups."),
      R("Define the AI roles you need", "Specify the roles required to deliver the strategy and decide for each whether to hire, develop, or contract.", "build", "Medium", "A documented AI role plan with build-or-buy decisions."),
      R("Give people supervised practice", "Pair training with structured practice on real work under supervision - literacy without application decays within a quarter.", "build", "Medium", "Supervised application embedded after every course."),
    ],
    b3: [
      R("Build internal mobility into AI roles", "Create defined paths from existing roles into AI-adjacent ones so capability is grown, not only recruited.", "quick", "Medium", "Published internal pathways with first movers appointed."),
      R("Diversify how capability is sourced", "Combine hiring, internal development, university partnerships, and selective consultancy rather than depending on one channel.", "build", "Medium", "At least three active sourcing channels."),
      R("Measure capability, not attendance", "Replace completion rates with demonstrated-competence measures tied to real deliverables.", "build", "Medium", "Competence-based reporting replacing attendance metrics."),
    ],
    b4: [
      R("Institutionalise the academy", "Formalise AI capability building into a standing internal academy with owned curricula and a refresh cycle.", "build", "High", "An operating internal AI academy."),
      R("Plan succession for critical AI roles", "Identify single points of failure in AI capability and build named successors.", "build", "Medium", "Succession cover for every critical AI role."),
      R("Export capability to the sector", "Offer capability building to partners or the wider sector - a mark of leading maturity and a talent magnet.", "transform", "High", "An external capability-building offer in market."),
    ],
  },
  culture: {
    b1: [
      R("Communicate the AI intent openly", "State plainly what AI is for here - and what it is not for, particularly regarding jobs. Silence is filled by rumour.", "quick", "Low", "A published, plainly-worded AI intent message."),
      R("Create a safe question channel", "Give staff a named route to ask about AI without appearing resistant or uninformed.", "quick", "Low", "An open question channel with published answers."),
      R("Show one relevant example", "Demonstrate one AI application in this organisation's own context - abstract explanation does not move belief.", "build", "Medium", "A live demonstration delivered to staff."),
    ],
    b2: [
      R("Cascade the message through line managers", "Equip managers to hold the AI conversation with their teams; adoption is decided at that level, not in corporate communications.", "quick", "Medium", "Managers briefed with a conversation toolkit."),
      R("Recognise early adopters visibly", "Make experimentation visibly safe and rewarded, so willingness spreads beyond the initial enthusiasts.", "quick", "Low", "A recognition mechanism with named examples."),
      R("Surface and answer the objections", "Collect the real concerns - job security, quality, accountability - and respond to each in writing.", "build", "Medium", "A published response to the top staff concerns."),
    ],
    b3: [
      R("Run cross-functional AI workshops", "Bring business and technical staff together on real problems; the culture gap usually sits between functions, not within them.", "quick", "Medium", "Quarterly cross-functional workshops with documented outputs."),
      R("Make AI part of how work is reviewed", "Include AI-assisted working in normal performance and process reviews so it stops being a side activity.", "build", "Medium", "AI usage reflected in standard review practice."),
      R("Track adoption, not sentiment", "Measure who is actually using AI in their work, by team, and follow up where usage is flat.", "build", "Medium", "Adoption reporting by team with follow-up actions."),
    ],
    b4: [
      R("Devolve experimentation budgets", "Let teams fund their own small AI experiments within guardrails - the practical marker of an embedded culture.", "quick", "Medium", "Devolved experimentation budgets in use."),
      R("Institutionalise learning from failure", "Run structured reviews of AI initiatives that did not work and publish the lessons internally.", "build", "Low", "A published internal lessons library."),
      R("Make AI fluency a leadership expectation", "Write AI fluency into leadership competencies and promotion criteria.", "transform", "Medium", "AI fluency embedded in leadership criteria."),
    ],
  },
  governance: {
    b1: [
      R("Publish an acceptable-use policy", "Issue a short, readable policy covering what staff may and may not do with AI tools and organisational data. This is the single highest-value first control.", "quick", "Low", "A published, acknowledged acceptable-use policy."),
      R("Name an accountable owner", "Assign accountability for AI governance to a named individual, even before a committee exists.", "quick", "Low", "A named AI governance owner."),
      R("Log where AI is already used", "Create a register of AI systems and tools in use, however informal - governance starts with visibility.", "build", "Medium", "An AI use register covering known systems."),
    ],
    b2: [
      R("Charter an AI governance committee", "Formally constitute the committee: membership, decision rights, quorum, and meeting cadence, so decisions are traceable.", "quick", "Medium", "A chartered committee with minuted decisions."),
      R("Define the approval gates", "Set out which AI decisions need which approvals, and at what risk threshold, so teams know the route before they build.", "build", "Medium", "Published approval gates by risk tier."),
      R("Vet third-party AI tools", "Assess third-party AI tools against security, privacy, and ethics criteria before adoption.", "build", "Medium", "A vetting checklist applied to all new tools."),
    ],
    b3: [
      R("Write the AI incident playbook", "Define what happens when an AI system produces harmful, biased, or badly wrong output: who is called, what is paused, how it is communicated.", "quick", "Medium", "A tested AI incident response playbook."),
      R("Make the register the control point", "Turn the AI register into a live control: no system reaches production without an entry, an owner, and a risk rating.", "build", "Medium", "Registration enforced as a production gate."),
      R("Audit against the applicable frameworks", "Run a structured self-audit against the regulations that apply to you and record the evidence per requirement.", "build", "High", "A completed self-audit with an evidence file."),
    ],
    b4: [
      R("Commission independent assurance", "Have a third party review the AI governance framework - internal confidence is not external assurance.", "build", "High", "An independent assurance report with a response plan."),
      R("Report AI risk to the board", "Fold AI risk into the standing enterprise risk report rather than treating it as a separate technical topic.", "quick", "Medium", "AI risk in the standing board risk report."),
      R("Contribute to standards setting", "Engage with regulators and standards bodies to shape the requirements you will be held to.", "transform", "Medium", "Active participation in a standards or regulatory forum."),
    ],
  },
  operations: {
    b1: [
      R("Run a use-case discovery workshop", "Work with the business to surface candidate AI use cases grounded in actual operational pain, not technology interest.", "quick", "Medium", "A first candidate use-case list from the business."),
      R("Pick one narrow first use case", "Choose a single, well-bounded, low-risk process to prove delivery end to end.", "quick", "Medium", "One scoped use case with a named business owner."),
      R("Define what success looks like", "Agree the before-and-after measure for that use case before building anything.", "build", "Low", "A documented baseline and target measure."),
    ],
    b2: [
      R("Deliver the first pilot to a real measure", "Complete the pilot and report the actual outcome against the pre-agreed measure, including if it fell short.", "quick", "Medium", "One completed pilot with pre/post evidence."),
      R("Build a prioritised use-case portfolio", "Move from opportunistic single cases to a ranked portfolio scored on value, risk, and readiness.", "build", "Medium", "A ranked portfolio reviewed on a set cadence."),
      R("Assign business owners, not IT owners", "Make the process owner accountable for the outcome so value is pursued after go-live.", "build", "Low", "A named business owner on every active use case."),
    ],
    b3: [
      R("Productionise the strongest pilots", "Take the one or two best-performing pilots into business-as-usual with formal handover, support, and monitoring.", "quick", "Medium", "Pilots operating in production under BAU support."),
      R("Measure realised benefit, not projected", "Track the value actually delivered post-go-live against the original case, and publish the variance.", "build", "Medium", "Realised-benefit reporting on live use cases."),
      R("Retire what is not working", "Formally stop use cases that have not delivered, freeing capacity and building credibility.", "build", "Low", "A documented stop/continue decision per use case."),
    ],
    b4: [
      R("Scale the portfolio across functions", "Extend proven patterns into adjacent functions rather than starting each case from scratch.", "build", "High", "Proven patterns replicated in new functions."),
      R("Industrialise the delivery pipeline", "Standardise intake, build, and handover so new use cases move through a repeatable pipeline.", "build", "High", "A standardised delivery pipeline with cycle-time metrics."),
      R("Redesign processes around AI", "Move beyond automating current steps to redesigning the process itself - where the step-change value sits.", "transform", "High", "At least one process redesigned rather than automated."),
    ],
  },
  model_management: {
    b1: [
      R("List the models in use", "Record every model in use, including embedded vendor models, with a named owner. Nothing else here is possible without this.", "quick", "Medium", "A model inventory with named owners."),
      R("Record intended purpose per model", "Document what each model is for and what it must not be used for, to prevent silent scope creep.", "quick", "Low", "A documented purpose statement per model."),
      R("Establish a human review point", "Ensure a person reviews model output before it affects a customer or an employee decision.", "build", "Medium", "A defined human review step on consequential outputs."),
    ],
    b2: [
      R("Version and record every model", "Track model versions and the data they were trained or configured on, so behaviour changes can be explained.", "quick", "Medium", "Version records for all active models."),
      R("Set performance thresholds", "Define the minimum acceptable performance per model and what happens when it is breached.", "build", "Medium", "Documented thresholds and breach actions."),
      R("Test for bias before deployment", "Run a fairness check on models affecting people, and record the result whichever way it falls.", "build", "Medium", "A pre-deployment fairness test on record."),
    ],
    b3: [
      R("Monitor for drift in production", "Detect when live performance diverges from validation performance, with alerting rather than periodic review.", "quick", "High", "Automated drift monitoring on production models."),
      R("Schedule periodic revalidation", "Set a revalidation cadence per model based on its risk tier, not on convenience.", "build", "Medium", "A published revalidation calendar by risk tier."),
      R("Make outputs explainable to the affected", "Ensure a person affected by a model decision can be given a comprehensible reason.", "build", "High", "An explanation mechanism for consequential decisions."),
    ],
    b4: [
      R("Automate the model lifecycle", "Connect registration, testing, deployment, monitoring, and retirement into one governed lifecycle with audit evidence throughout.", "build", "High", "An automated, auditable model lifecycle."),
      R("Run adversarial and robustness testing", "Actively probe models for failure modes rather than waiting for production to find them.", "build", "High", "Documented adversarial testing per critical model."),
      R("Publish model documentation", "Maintain model cards covering purpose, data, performance, and limitations, available to reviewers and regulators.", "transform", "Medium", "Model cards published for all production models."),
    ],
  },
};

function bandFor(score: number | null): Band {
  if (score == null || score < 2.0) return "b1";
  if (score < 3.0) return "b2";
  if (score < 4.0) return "b3";
  return "b4";
}

/**
 * Three recommendations specific to BOTH the pillar and its current maturity.
 * Falls back to the pillar's own lowest band if a band is ever missing.
 */
export function recommendationsForPillar(
  pillarId: AraPillarId,
  score: number | null
): Recommendation[] {
  const perPillar = LIBRARY[pillarId];
  if (!perPillar) return [];
  return perPillar[bandFor(score)] ?? perPillar.b1;
}
