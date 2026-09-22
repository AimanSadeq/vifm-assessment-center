/**
 * The roles a centre needs, and what each one has to be able to do.
 *
 * BPS 4.42 requires a role profile for each role adopted at a centre, naming
 * the Centre Designer, Centre Manager, Centre Administrator, Assessors,
 * Role-players, Fact-Find Administrator and Psychometric Test Administrators
 * and Users; 4.43 adds Feedback Generators and a Feedback Generation Meeting
 * Chair wherever the outcome includes qualitative feedback. 3.12 makes VIFM
 * responsible for the competence of everyone who contributes to a centre in
 * any capacity - including people employed by the client, for whom VIFM must
 * at least specify the competence required.
 *
 * The catalogue lives in code, like the technical framework, because it is
 * fixed by the standard rather than edited per client. What varies - who holds
 * a role, and whether they have shown they can do it - lives in the database
 * (migration 00213).
 */

export type CentreRoleKey =
  | "centre_designer"
  | "centre_manager"
  | "centre_administrator"
  | "assessor"
  | "role_player"
  | "fact_find_administrator"
  | "psychometric_test_administrator"
  | "psychometric_test_user"
  | "feedback_generator"
  | "feedback_meeting_chair";

export type CentreRole = {
  key: CentreRoleKey;
  name: string;
  /** One line: what this person is there to do. */
  purpose: string;
  /** The competences they must demonstrate before working a centre (4.44). */
  competences: string[];
  /** When this role is needed at all. */
  requiredWhen: "always" | "development_feedback" | "psychometrics" | "role_play" | "fact_find" | "design_time";
  clause: string;
};

export const CENTRE_ROLES: CentreRole[] = [
  {
    key: "centre_designer",
    name: "Centre Designer",
    purpose: "Designs the centre: the criteria, the exercises and the timetable.",
    competences: [
      "Job analysis: can establish what the role actually requires and turn it into assessment criteria",
      "Exercise selection and design: can choose or build exercises that elicit the behaviour being assessed",
      "Timetabling: can schedule participants, assessors and rooms so every criterion is observed as designed",
    ],
    requiredWhen: "design_time",
    clause: "4.44.1",
  },
  {
    key: "centre_manager",
    name: "Centre Manager",
    purpose: "Runs the centre on the day and is answerable for it being run as designed.",
    competences: [
      "Knows the design of this centre and the standard it is run to",
      "Can manage staff, timings and rooms, and handle events that disrupt them",
      "Can decide when an incident affects assessment, and record it",
      "Can confirm that everyone working the centre is competent to do so",
    ],
    requiredWhen: "always",
    clause: "5.16 / 6.1 / 6.2",
  },
  {
    key: "centre_administrator",
    name: "Centre Administrator",
    purpose: "Handles the logistics, materials and paperwork that keep the centre running.",
    competences: [
      "Can prepare, issue and account for assessment materials without exposing them",
      "Can administer joining instructions, timetables and participant records",
      "Knows the confidentiality and data-protection rules that apply to centre material",
    ],
    requiredWhen: "always",
    clause: "5.16",
  },
  {
    key: "assessor",
    name: "Assessor",
    purpose: "Observes, records and rates behaviour against the criteria.",
    competences: [
      "Can observe and record behaviour accurately, separating evidence from inference",
      "Can classify evidence against the competency framework and rate it on the scale in use",
      "Understands rating errors and how their own judgement can drift",
      "Can contribute evidence to the wash-up and hold a position against challenge",
    ],
    requiredWhen: "always",
    clause: "4.42",
  },
  {
    key: "role_player",
    name: "Role-player",
    purpose: "Plays the counterpart in a role-play so every participant meets the same situation.",
    competences: [
      "Can play the brief consistently across participants, including the prompts and the resistance",
      "Stays in role and does not assess, coach or lead the participant",
      "Can adapt to an unexpected approach without changing the difficulty of the exercise",
    ],
    requiredWhen: "role_play",
    clause: "4.42",
  },
  {
    key: "fact_find_administrator",
    name: "Fact-Find Administrator",
    purpose: "Answers participants' questions in a fact-find exercise, to a fixed script.",
    competences: [
      "Can answer only what the brief allows, identically for every participant",
      "Can record what was asked, so the assessor knows what the participant had to work with",
    ],
    requiredWhen: "fact_find",
    clause: "4.42",
  },
  {
    key: "psychometric_test_administrator",
    name: "Psychometric Test Administrator",
    purpose: "Administers tests under standard conditions.",
    competences: [
      "Can deliver the test to its standard instructions, timing and conditions",
      "Can handle test materials securely and deal with irregularities during administration",
    ],
    requiredWhen: "psychometrics",
    clause: "4.42",
  },
  {
    key: "psychometric_test_user",
    name: "Psychometric Test User",
    purpose: "Interprets test results and decides how they may be used.",
    competences: [
      "Qualified to use the instruments in question, to the level the publisher requires",
      "Can interpret scores with their error, norms and limits, and say what they do not show",
      "Can judge whether a result should influence an assessment decision at all",
    ],
    requiredWhen: "psychometrics",
    clause: "5.17",
  },
  {
    key: "feedback_generator",
    name: "Feedback Generator",
    purpose: "Writes or delivers the feedback a participant receives.",
    competences: [
      "Trained in giving feedback, and familiar with this centre's purpose and content",
      "Can give feedback sensitively, supportively and constructively",
      "Can ground every statement in recorded evidence rather than impression",
    ],
    requiredWhen: "development_feedback",
    clause: "8.17 / 8.18",
  },
  {
    key: "feedback_meeting_chair",
    name: "Feedback Generation Meeting Chair",
    purpose: "Chairs the meeting where qualitative feedback is agreed.",
    competences: [
      "Can chair an evidence-based discussion and keep it to the evidence",
      "Can ensure every assessor's evidence is heard before a conclusion is reached",
      "Can recognise and challenge unsupported or biased conclusions",
    ],
    requiredWhen: "development_feedback",
    clause: "4.43",
  },
];

export const CENTRE_ROLE_MAP: Record<string, CentreRole> = Object.fromEntries(
  CENTRE_ROLES.map((r) => [r.key, r])
);

export function centreRoleName(key: string | null | undefined): string {
  return CENTRE_ROLE_MAP[key ?? ""]?.name ?? (key ?? "Unknown role");
}

/**
 * Which roles this particular centre has to fill.
 *
 * The standard does not require every role at every centre: a role-player is
 * needed when there is a role-play, a Test User when psychometric tests are
 * used (5.17), and feedback roles where the outcome includes qualitative
 * feedback rather than an arithmetic rule (4.43) - which for us means a
 * development centre.
 */
export function requiredCentreRoles(ctx: {
  purpose?: string | null;
  usesPsychometrics?: boolean;
  usesRolePlay?: boolean;
  usesFactFind?: boolean;
}): CentreRole[] {
  return CENTRE_ROLES.filter((r) => {
    switch (r.requiredWhen) {
      case "always":
        return true;
      case "psychometrics":
        return Boolean(ctx.usesPsychometrics);
      case "role_play":
        return Boolean(ctx.usesRolePlay);
      case "fact_find":
        return Boolean(ctx.usesFactFind);
      case "development_feedback":
        // A selection centre's outcome is the arithmetic rule, so 4.43 does not
        // bite. Development and succession centres owe qualitative feedback.
        return ctx.purpose !== "selection";
      case "design_time":
        // The designer's competence matters when the centre is designed, not on
        // the day, so it is recorded but never blocks a centre from running.
        return false;
      default:
        return false;
    }
  });
}
