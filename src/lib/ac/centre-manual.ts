/**
 * The centre manual, and the per-role manuals cut from it.
 *
 * BPS 4.39 requires a manual containing all documentation relating to the
 * centre; 4.40 says operational manuals for each role should be compiled from
 * its relevant contents; 5.33 requires briefing documentation for every role
 * with security measures where it is confidential; 5.25 requires a materials
 * checklist.
 *
 * The important word in 4.40 is "compiled from". A role manual is not a
 * different document, it is the same document with the sections that role has
 * no business reading removed - so one builder produces every variant and the
 * audience is a property of each section. Written any other way, the assessor
 * pack and the role-player pack drift apart from the centre and from each
 * other, and the participant brief ends up next to the answer it is testing.
 *
 * Confidentiality is the point, not a nicety: exercise briefs, role-player
 * prompts and assessor guidance keep their value only while participants have
 * not seen them, and a centre reuses its exercises.
 */

import type { CentreRoleKey } from "./centre-roles";

export type ManualVariant = "full" | CentreRoleKey;

export type ManualSection = {
  id: string;
  heading: string;
  clause: string;
  /** Roles that may read it. "full" always sees everything. */
  audience: ManualVariant[];
  /** Content the exercises or the design supply. Empty means the gap is real. */
  body: string;
  /** Exposure would compromise the exercise for future participants. */
  confidential: boolean;
};

export type ManualExercise = {
  name: string;
  exerciseType?: string | null;
  durationMinutes?: number | null;
  prepMinutes?: number | null;
  meetingMinutes?: number | null;
  instructionsMinutes?: number | null;
  participantBrief?: string | null;
  scenarioContext?: string | null;
  assessorNotes?: string | null;
  /**
   * The role-player's brief. These live in role_player_prompts, one row per
   * prompt per exercise - NOT as character fields on the exercise, which is
   * what the project notes claim and the database does not have.
   */
  rolePlayerPrompts?: { prompt: string; triggerBehaviours?: string | null }[];
  competencies: string[];
};

export type ManualInput = {
  engagement: Record<string, unknown>;
  organisationName: string | null;
  exercises: ManualExercise[];
  roles: { roleKey: string; name: string; isExternal: boolean }[];
  participants: { name: string; adjustment: string | null; extraMinutes: number | null }[];
  competencies: { name: string; weight: number | null }[];
};

export type MaterialsChecklist = {
  group: string;
  clause: string;
  items: { label: string; detail?: string; fromDesign: boolean }[];
}[];

const ALL_ROLES: ManualVariant[] = [
  "full",
  "centre_manager",
  "centre_administrator",
  "assessor",
  "role_player",
  "fact_find_administrator",
  "psychometric_test_administrator",
  "psychometric_test_user",
  "feedback_generator",
  "feedback_meeting_chair",
];

const text = (v: unknown): string => String(v ?? "").trim();

/**
 * Which variants may read a section. "full" is added to every audience, so a
 * section can never be written that the complete manual omits - that would
 * break 4.39, which is the one clause here that says ALL documentation.
 */
const audience = (...roles: ManualVariant[]): ManualVariant[] => ["full", ...roles];

export function buildCentreManual(input: ManualInput): {
  sections: ManualSection[];
  checklist: MaterialsChecklist;
  version: number;
} {
  const e = input.engagement as Record<string, string | number | null>;
  const sections: ManualSection[] = [];

  sections.push({
    id: "purpose",
    heading: "What this centre is for",
    clause: "3.7 / 4.39",
    audience: ALL_ROLES,
    confidential: false,
    body: [
      text(e.pack_purpose_statement),
      e.target_role ? `Target role: ${text(e.target_role)}.` : "",
      e.purpose === "selection"
        ? "This is a selection centre. The overall rating is calculated from the agreed competency ratings using the weights fixed at design time; it is not agreed in the room."
        : "This is a development centre. The overall rating is agreed by the assessors in discussion, and every participant is owed feedback.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  sections.push({
    id: "criteria",
    heading: "What is being assessed",
    clause: "4.4 / 4.39",
    audience: ALL_ROLES,
    confidential: false,
    body: input.competencies.length
      ? input.competencies.map((c) => `- ${c.name}${c.weight != null ? ` (weight ${c.weight})` : ""}`).join("\n")
      : "",
  });

  // Exercise material, split by who needs which part of it.
  for (const [i, x] of input.exercises.entries()) {
    const timing = [
      x.instructionsMinutes ? `${x.instructionsMinutes} min instructions` : "",
      x.prepMinutes ? `${x.prepMinutes} min preparation` : "",
      x.meetingMinutes ? `${x.meetingMinutes} min meeting` : "",
      x.durationMinutes ? `${x.durationMinutes} min in total` : "",
    ]
      .filter(Boolean)
      .join(", ");

    sections.push({
      id: `exercise-${i}-overview`,
      heading: `${x.name}: what happens`,
      clause: "4.39 / 6.5",
      audience: ALL_ROLES,
      confidential: false,
      body: [
        timing ? `Timing: ${timing}.` : "",
        x.competencies.length ? `Criteria observed: ${x.competencies.join(", ")}.` : "No criteria are mapped to this exercise.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    sections.push({
      id: `exercise-${i}-brief`,
      heading: `${x.name}: participant brief`,
      clause: "5.33",
      // Administrators hand it out, assessors and the manager need to know what
      // the participant was told. Nobody else, and never before the day.
      audience: audience("centre_manager", "centre_administrator", "assessor"),
      confidential: true,
      body: [text(x.participantBrief), text(x.scenarioContext)].filter(Boolean).join("\n\n"),
    });

    if (text(x.assessorNotes)) {
      sections.push({
        id: `exercise-${i}-assessor`,
        heading: `${x.name}: assessor guidance`,
        clause: "5.33 / 6.9",
        audience: audience("centre_manager", "assessor"),
        confidential: true,
        body: text(x.assessorNotes),
      });
    }

    const rolePlayer = (x.rolePlayerPrompts ?? [])
      .map((p) =>
        p.triggerBehaviours
          ? `- ${text(p.prompt)}\n  Use when: ${text(p.triggerBehaviours)}`
          : `- ${text(p.prompt)}`
      )
      .join("\n");
    if (rolePlayer) {
      sections.push({
        id: `exercise-${i}-roleplayer`,
        heading: `${x.name}: role-player brief`,
        clause: "5.33",
        // Deliberately NOT the assessor's: an assessor who has read the
        // character's objectives rates the participant against a script rather
        // than against the behaviour in front of them.
        audience: audience("centre_manager", "role_player"),
        confidential: true,
        body: rolePlayer,
      });
    }
  }

  sections.push({
    id: "rules",
    heading: "How ratings are reached",
    clause: "7.3 / 7.4 / 4.32 / 7.14",
    audience: audience("centre_manager", "assessor", "feedback_meeting_chair", "feedback_generator"),
    confidential: false,
    body: [
      e.integration_method === "weighted_average"
        ? "The overall rating is the weighted average of the agreed competency ratings. It is calculated, not entered by hand. The panel may record disagreement; the calculation stands as the centre's outcome."
        : "The overall rating is agreed by the assessors in discussion at the wash-up.",
      e.other_methods_rule === "context_only"
        ? "Results from tests, questionnaires, interviews and 360s may inform the discussion but never move a competency rating."
        : e.other_methods_rule === "documented_conversion"
          ? `Results from other methods convert to the rating scale by this rule: ${text(e.other_methods_note)}`
          : "No rule has been recorded for results from methods other than exercises, so they may not move a rating.",
      e.external_evidence_rule === "permitted"
        ? `Evidence from outside the centre may be used under this framework: ${text(e.external_evidence_framework)}`
        : "Evidence from outside the centre does not count towards a rating.",
      "Every assessor's evidence is heard before a rating is set, and the chair of the discussion is recorded with it.",
    ].join("\n\n"),
  });

  sections.push({
    id: "participants",
    heading: "Participants, and adjustments agreed for them",
    clause: "5.47 / 6.9",
    // The list of who is being assessed, with health-adjacent information
    // behind the adjustments, goes to the people running the day - not to a
    // psychometric test user or a feedback generator who has no need for it.
    audience: audience("centre_manager", "centre_administrator", "assessor", "role_player"),
    confidential: true,
    body: input.participants.length
      ? input.participants
          .map((p) =>
            p.adjustment
              ? `- ${p.name} - adjustment agreed: ${p.adjustment}${p.extraMinutes ? ` (+${p.extraMinutes} min per timed activity)` : ""}`
              : `- ${p.name}`
          )
          .join("\n")
      : "",
  });

  sections.push({
    id: "staff",
    heading: "Who is running the centre",
    clause: "4.42 / 5.16 / 6.1",
    audience: ALL_ROLES,
    confidential: false,
    body: input.roles.length ? input.roles.map((r) => `- ${r.name}${r.isExternal ? " (from the client)" : ""}`).join("\n") : "",
  });

  sections.push({
    id: "procedures",
    heading: "On the day: what to do when something happens",
    clause: "6.7 / 6.8 / 6.10 / 5.44 / 5.50",
    audience: ALL_ROLES,
    confidential: false,
    body: [
      "Anything that could affect how a result should be read - an interruption, illness, a technology failure, a departure from the timetable - is recorded in the delivery log on the engagement, with what was done about it. Record it on the day; memory is not a record.",
      "A participant disturbed or taken ill is entitled to be re-assessed. Raise it with the centre manager, who arranges it.",
      "A participant may raise a concern before, during or after the centre, from their own portal or through the named contact. Raising one does not affect their results.",
      text(e.participant_contact_name)
        ? `The named contact for participants is ${text(e.participant_contact_name)}${text(e.participant_contact_email) ? ` (${text(e.participant_contact_email)})` : ""}.`
        : "No named contact has been recorded for participants yet.",
    ].join("\n\n"),
  });

  sections.push({
    id: "security",
    heading: "Keeping the material secure",
    clause: "4.41 / 6.9 / 4.33.1",
    audience: ALL_ROLES,
    confidential: false,
    body: [
      "This manual contains exercise material. Its value depends on participants not having seen it, and these exercises are used again.",
      "Do not copy, forward or store it outside the systems VIFM provides. Do not leave printed copies in the assessment rooms at the end of the day.",
      "Every copy issued is recorded against the person it went to. Confirm with the centre administrator when you have returned or destroyed yours.",
      `Participant records are held for ${text(e.retention_months) || 24} months from the assessment date and then deleted.`,
    ].join("\n\n"),
  });

  // ─────────────────────────── Materials checklist (5.25) ──────────────────────
  const adjustments = input.participants.filter((p) => p.adjustment);
  const checklist: MaterialsChecklist = [
    {
      group: "Manuals",
      clause: "5.25.1",
      items: [
        { label: "Centre manual (full)", detail: "Centre manager", fromDesign: true },
        ...Array.from(new Set(input.roles.map((r) => r.roleKey))).map((k) => ({
          label: `Role manual: ${k.replace(/_/g, " ")}`,
          detail: input.roles.filter((r) => r.roleKey === k).map((r) => r.name).join(", "),
          fromDesign: true,
        })),
      ],
    },
    {
      group: "Participant materials",
      clause: "5.25.2",
      items: [
        { label: "Personal timetables", detail: `${input.participants.length} participants`, fromDesign: true },
        ...input.exercises.map((x) => ({
          label: `${x.name}: participant brief`,
          detail: `${input.participants.length} copies`,
          fromDesign: true,
        })),
      ],
    },
    {
      group: "Assessor materials",
      clause: "5.25.3",
      items: [
        { label: "Observation and rating forms", detail: "In the platform; paper backup if the venue has no reliable network", fromDesign: true },
        { label: "Competency definitions and behavioural indicators", fromDesign: true },
      ],
    },
    {
      group: "Role-player materials",
      clause: "5.25.4",
      items: input.exercises.filter((x) => (x.rolePlayerPrompts ?? []).length > 0).length
        ? input.exercises
            .filter((x) => (x.rolePlayerPrompts ?? []).length > 0)
            .map((x) => ({
              label: `${x.name}: role-player brief`,
              detail: `${(x.rolePlayerPrompts ?? []).length} prompts`,
              fromDesign: true,
            }))
        : [
            {
              label:
                input.exercises.some((x) => x.exerciseType === "role_play")
                  ? "A role play is scheduled but no role-player prompts have been written for it"
                  : "None - no exercise in this design uses a role-player",
              fromDesign: true,
            },
          ],
    },
    {
      group: "Stationery",
      clause: "5.25.5",
      items: [
        { label: "Pens, pencils, highlighters", fromDesign: false },
        { label: "Paper, folders, paperclips, stapler", fromDesign: false },
        { label: "Name tags", detail: `${input.participants.length + input.roles.length} needed`, fromDesign: true },
      ],
    },
    {
      group: "Technology",
      clause: "5.25.6",
      items: [
        { label: "Laptops or tablets for assessors", detail: `${input.roles.filter((r) => r.roleKey === "assessor").length || "?"} needed`, fromDesign: true },
        { label: "Network access, power and cabling", fromDesign: false },
        { label: "Printer", fromDesign: false },
        { label: "Timer or visible clock per room", fromDesign: false },
      ],
    },
    {
      group: "Adjustments",
      clause: "5.25.7",
      items: adjustments.length
        ? adjustments.map((p) => ({
            label: p.adjustment as string,
            detail: `For ${p.name}${p.extraMinutes ? ` (+${p.extraMinutes} min per timed activity)` : ""}`,
            fromDesign: true,
          }))
        : [{ label: "None agreed. Check that every participant was asked.", fromDesign: true }],
    },
  ];

  return {
    sections,
    checklist,
    version: Number(e.manual_version ?? 1),
  };
}

/** The sections a given variant may read (BPS 4.40). */
export function sectionsFor(sections: ManualSection[], variant: ManualVariant): ManualSection[] {
  if (variant === "full") return sections;
  return sections.filter((s) => s.audience.includes(variant));
}

/** Does this variant carry material whose exposure would compromise reuse? */
export function isConfidential(sections: ManualSection[], variant: ManualVariant): boolean {
  return sectionsFor(sections, variant).some((s) => s.confidential && s.body.trim().length > 0);
}
