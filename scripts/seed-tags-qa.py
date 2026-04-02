import json, requests

url = "https://dyzuoygeimixodxqwjza.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5enVveWdlaW1peG9keHF3anphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NTE1NSwiZXhwIjoyMDkwNTMxMTU1fQ.7nn_mhnAK3AW-V5D2lgzlaoOtAdR8muo-pf_pPqv8Dk"
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"}

data = {
    "a0000001-0000-0000-0000-000000000001": {
        "tags": ["Strategic vision", "Long-term thinking", "Big picture", "Future trends", "Breakthrough strategies"],
        "qa_questions": ["Describe a time you had to balance short-term pressures with long-term strategic goals.", "How do you stay informed about industry trends that affect your organization?", "Give an example of a strategy you developed that addressed a future opportunity or threat."]
    },
    "a0000001-0000-0000-0000-000000000002": {
        "tags": ["Market awareness", "Business model", "Competitive landscape", "Value creation", "Industry trends"],
        "qa_questions": ["How do you keep up with changes in your industry and competitive environment?", "Describe a decision where your understanding of the business model led to a better outcome.", "What market trends do you see affecting your organization in the next 2-3 years?"]
    },
    "a0000001-0000-0000-0000-000000000003": {
        "tags": ["Financial analysis", "ROI", "Cost-benefit", "Budget management", "Risk assessment"],
        "qa_questions": ["Describe how you used financial data to make a business decision.", "How do you evaluate whether an investment or initiative is worth pursuing?", "Give an example of a time you identified a cost-saving opportunity."]
    },
    "a0000001-0000-0000-0000-000000000004": {
        "tags": ["Data analysis", "Root cause", "Problem solving", "Critical evaluation", "Logical reasoning"],
        "qa_questions": ["Describe a complex problem you had to analyze. How did you approach it?", "How do you distinguish between symptoms and root causes?", "Give an example where your analysis led to a different conclusion than what was initially assumed."]
    },
    "a0000001-0000-0000-0000-000000000005": {
        "tags": ["Decisive", "Quick decisions", "Calculated risks", "Takes responsibility", "Judgment"],
        "qa_questions": ["Describe a time you had to make a difficult decision with incomplete information.", "How do you balance speed of decision-making with thoroughness?", "Tell me about a decision that did not work out. What did you learn?"]
    },
    "a0000001-0000-0000-0000-000000000006": {
        "tags": ["New ideas", "Experimentation", "Creative thinking", "Change agent", "Continuous improvement"],
        "qa_questions": ["Describe a time you introduced a new idea or approach at work.", "How do you encourage creative thinking in your team?", "Give an example of an innovation that improved a process or outcome."]
    },
    "a0000001-0000-0000-0000-000000000007": {
        "tags": ["Complex problems", "Multiple variables", "Ambiguous information", "Synthesis", "Pattern recognition"],
        "qa_questions": ["Describe a situation with multiple conflicting priorities. How did you navigate it?", "How do you make sense of large amounts of contradictory information?", "Give an example of a complex issue you simplified for your team."]
    },
    "a0000001-0000-0000-0000-000000000008": {
        "tags": ["Cross-cultural", "International", "Diverse markets", "Geopolitical awareness", "Global trends"],
        "qa_questions": ["Describe your experience working with people from different cultural backgrounds.", "How do you adapt your approach when working across different markets or regions?", "What global trends do you monitor that affect your work?"]
    },
    "a0000001-0000-0000-0000-000000000009": {
        "tags": ["Technology adoption", "Data-driven", "Digital tools", "Automation", "Digital transformation"],
        "qa_questions": ["Describe a time you used technology to improve a business process.", "How do you stay current with digital tools relevant to your role?", "Give an example of a data-driven decision you made."]
    },
    "a0000001-0000-0000-0000-000000000010": {
        "tags": ["Initiative", "Urgency", "Proactive", "Energy", "Bias for action"],
        "qa_questions": ["Describe a situation where you took the initiative without being asked.", "How do you maintain momentum when facing obstacles?", "Tell me about a time you tackled a challenge with enthusiasm despite the difficulty."]
    },
    "a0000001-0000-0000-0000-000000000011": {
        "tags": ["Achievement", "Performance standards", "Persistence", "Goal-oriented", "Accountability"],
        "qa_questions": ["Describe a time you achieved a result that others thought was impossible.", "How do you maintain high standards when under pressure?", "Give an example of pushing through obstacles to deliver a critical outcome."]
    },
    "a0000001-0000-0000-0000-000000000012": {
        "tags": ["Ownership", "Follow-through", "Commitments", "Performance tracking", "Responsibility"],
        "qa_questions": ["How do you ensure your team members follow through on their commitments?", "Describe a time you held someone accountable for underperformance.", "Tell me about a situation where you took ownership of a mistake."]
    },
    "a0000001-0000-0000-0000-000000000013": {
        "tags": ["Planning", "Prioritization", "Time management", "Resource allocation", "Milestones"],
        "qa_questions": ["How do you prioritize when everything seems urgent?", "Describe your approach to planning a complex project.", "Give an example of a time you had to reallocate resources to meet a deadline."]
    },
    "a0000001-0000-0000-0000-000000000014": {
        "tags": ["Efficiency", "Continuous improvement", "Process design", "Lean thinking", "Automation"],
        "qa_questions": ["Describe a process you improved. What was the impact?", "How do you identify inefficiencies in your team workflows?", "Give an example of eliminating unnecessary steps in a process."]
    },
    "a0000001-0000-0000-0000-000000000015": {
        "tags": ["Uncertainty", "Adaptability", "Comfortable with change", "Flexibility", "Ambiguity tolerance"],
        "qa_questions": ["Describe a time you had to operate without clear direction.", "How do you stay productive when priorities keep shifting?", "Tell me about a situation where you turned ambiguity into an opportunity."]
    },
    "a0000001-0000-0000-0000-000000000016": {
        "tags": ["Fast learner", "Experimentation", "Learning from failure", "Curiosity", "Knowledge transfer"],
        "qa_questions": ["Describe a time you had to learn something quickly to solve a problem.", "How do you approach unfamiliar challenges?", "Give an example of learning from a failure and applying that lesson."]
    },
    "a0000001-0000-0000-0000-000000000017": {
        "tags": ["Pressure tolerance", "Recovery", "Optimism", "Persistence", "Stress management"],
        "qa_questions": ["Describe a significant setback you experienced at work. How did you recover?", "How do you maintain your effectiveness during prolonged periods of pressure?", "Tell me about a time you had to keep going despite repeated obstacles."]
    },
    "a0000001-0000-0000-0000-000000000018": {
        "tags": ["Inspiring", "Motivating", "Vision communication", "Purpose-driven", "Empowerment"],
        "qa_questions": ["How do you motivate your team toward a shared goal?", "Describe a time you had to rally people around a new direction.", "How do you connect daily work to a larger purpose for your team?"]
    },
    "a0000001-0000-0000-0000-000000000019": {
        "tags": ["Clarity", "Presentation", "Active listening", "Audience awareness", "Verbal fluency"],
        "qa_questions": ["Describe a time you had to communicate a complex idea to a non-expert audience.", "How do you adapt your communication style for different stakeholders?", "Give an example of a presentation that achieved its intended outcome."]
    },
    "a0000001-0000-0000-0000-000000000020": {
        "tags": ["Influence", "Stakeholder management", "Compelling arguments", "Credibility", "Gaining buy-in"],
        "qa_questions": ["Describe a time you persuaded someone who initially disagreed with you.", "How do you build a compelling case for a new initiative?", "Tell me about a situation where you had to influence without authority."]
    },
    "a0000001-0000-0000-0000-000000000021": {
        "tags": ["Conflict resolution", "De-escalation", "Mediation", "Difficult conversations", "Diplomacy"],
        "qa_questions": ["Describe a conflict you resolved between team members.", "How do you approach a conversation you know will be difficult?", "Give an example of turning a conflict into a productive outcome."]
    },
    "a0000001-0000-0000-0000-000000000022": {
        "tags": ["Negotiation", "Win-win", "Compromise", "Stakeholder interests", "BATNA"],
        "qa_questions": ["Describe a negotiation where you achieved a mutually beneficial outcome.", "How do you prepare for an important negotiation?", "Tell me about a time you had to make concessions to reach an agreement."]
    },
    "a0000001-0000-0000-0000-000000000023": {
        "tags": ["Networking", "Relationship building", "Rapport", "External contacts", "Social capital"],
        "qa_questions": ["How do you build and maintain your professional network?", "Describe a time your network helped you solve a business challenge.", "How do you approach building rapport with someone new?"]
    },
    "a0000001-0000-0000-0000-000000000024": {
        "tags": ["Coaching", "Feedback", "Mentoring", "Delegation for growth", "Talent identification"],
        "qa_questions": ["Describe how you develop the people who report to you.", "Give an example of feedback you gave that led to someone growth.", "How do you identify and nurture high-potential individuals?"]
    },
    "a0000001-0000-0000-0000-000000000025": {
        "tags": ["Team coordination", "Workload distribution", "Team norms", "Recognition", "Team identity"],
        "qa_questions": ["How do you build cohesion in a new or diverse team?", "Describe a time you had to restructure or realign a team.", "How do you handle uneven workload distribution in your team?"]
    },
    "a0000001-0000-0000-0000-000000000026": {
        "tags": ["Teamwork", "Cooperation", "Inclusiveness", "Shared goals", "Cross-functional"],
        "qa_questions": ["Describe a successful cross-functional collaboration you led or participated in.", "How do you ensure all voices are heard in team discussions?", "Give an example of putting the team needs above your own."]
    },
    "a0000001-0000-0000-0000-000000000027": {
        "tags": ["Trust", "Reliability", "Honesty", "Transparency", "Follow-through"],
        "qa_questions": ["How do you build trust with a new team or stakeholder?", "Describe a time you had to deliver bad news. How did you handle it?", "Give an example of a situation where your honesty strengthened a relationship."]
    },
    "a0000001-0000-0000-0000-000000000028": {
        "tags": ["Flexibility", "Style switching", "Reading the room", "Context awareness", "Versatile"],
        "qa_questions": ["Describe a time you had to significantly change your approach mid-situation.", "How do you adapt your leadership style for different individuals?", "Give an example of reading a situation and adjusting your behavior accordingly."]
    },
    "a0000001-0000-0000-0000-000000000029": {
        "tags": ["Self-reflection", "Blind spots", "Feedback seeking", "Strengths and weaknesses", "Self-insight"],
        "qa_questions": ["What are your greatest strengths and development areas?", "How do you seek and process feedback about yourself?", "Describe a time self-awareness helped you handle a situation better."]
    },
    "a0000001-0000-0000-0000-000000000030": {
        "tags": ["Empathy", "Emotional awareness", "Self-regulation", "Social skills", "Emotional management"],
        "qa_questions": ["Describe a time you had to manage your emotions in a professional setting.", "How do you recognize when a colleague is struggling emotionally?", "Give an example of using empathy to resolve a workplace issue."]
    },
    "a0000001-0000-0000-0000-000000000031": {
        "tags": ["Speaks up", "Bold decisions", "Stands firm", "Candor", "Risk-taking"],
        "qa_questions": ["Describe a time you spoke up about something unpopular.", "How do you decide when it is worth taking a stand on an issue?", "Tell me about a bold decision you made and what happened."]
    },
    "a0000001-0000-0000-0000-000000000032": {
        "tags": ["Ethics", "Honesty", "Fairness", "Moral compass", "Values-driven"],
        "qa_questions": ["Describe a situation where you faced an ethical dilemma at work.", "How do you ensure your team operates with integrity?", "Tell me about a time you chose the right thing over the easy thing."]
    },
    "a0000001-0000-0000-0000-000000000033": {
        "tags": ["Cultural awareness", "Respect", "Diversity", "Inclusion", "Cross-cultural communication"],
        "qa_questions": ["How do you ensure your team is inclusive of diverse perspectives?", "Describe a time you had to navigate a cultural difference at work.", "What steps do you take to build cultural awareness in your organization?"]
    },
    "a0000001-0000-0000-0000-000000000034": {
        "tags": ["Quick learner", "Knowledge absorption", "Information synthesis", "Continuous learning", "Adaptable"],
        "qa_questions": ["Describe a time you had to learn a new skill or domain quickly.", "How do you stay current in your field?", "Give an example of applying learning from one context to a completely different one."]
    },
    "a0000001-0000-0000-0000-000000000035": {
        "tags": ["Growth mindset", "Self-improvement", "Feedback action", "Development planning", "Lifelong learning"],
        "qa_questions": ["What is your current development focus and why?", "How do you invest in your own professional growth?", "Describe a time feedback changed how you approach your work."]
    },
    "a0000001-0000-0000-0000-000000000036": {
        "tags": ["Calm under pressure", "Emotional control", "Steady", "Poise", "Stress tolerance"],
        "qa_questions": ["Describe the most pressured situation you have faced at work. How did you handle it?", "How do you maintain composure when things go wrong?", "Give an example of staying calm when others around you were stressed."]
    },
    "a0000001-0000-0000-0000-000000000037": {
        "tags": ["Boundaries", "Sustainable performance", "Recovery", "Energy management", "Wellbeing"],
        "qa_questions": ["How do you manage your energy across demanding periods?", "Describe how you model healthy work habits for your team.", "What do you do to recharge after an intense work period?"]
    },
    "a0000001-0000-0000-0000-000000000038": {
        "tags": ["Creative problem-solving", "Doing more with less", "Asset optimization", "Contingency planning", "Scrappy"],
        "qa_questions": ["Describe a time you achieved a goal with fewer resources than expected.", "How do you optimize existing resources before asking for more?", "Give an example of a creative solution to a resource constraint."]
    }
}

count = 0
for comp_id, fields in data.items():
    r = requests.patch(
        f"{url}/rest/v1/competencies?id=eq.{comp_id}",
        headers=headers,
        json={"tags": fields["tags"], "qa_questions": fields["qa_questions"]}
    )
    if r.status_code < 300:
        count += 1
    else:
        print(f"Error for {comp_id}: {r.text[:100]}")

print(f"Updated {count}/{len(data)} competencies with tags and Q&A questions")
