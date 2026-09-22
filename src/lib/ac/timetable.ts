/**
 * The centre timetable, and whether it is survivable.
 *
 * BPS 5.35 asks for four documents - the sequence of events, the
 * participant-to-assessor matrix, a master timetable with rooms, and an
 * individual timetable for every person. All four are views of the same slots,
 * so they are derived here rather than maintained separately: four documents
 * kept by hand disagree with each other by the second edit.
 *
 * 5.35.5 is the clause worth the code. "Timetables shall not compromise the
 * performance of anyone involved" is the only scheduling clause that protects
 * people rather than paperwork, and it is checkable: a person cannot be in two
 * rooms at once, a room cannot hold two things at once, and nobody performs
 * well five hours in with no break. Those are the three things a hand-built
 * timetable gets wrong.
 */

export type Slot = {
  id: string;
  kind: "exercise" | "briefing" | "break" | "lunch" | "washup" | "feedback" | "other";
  exerciseId?: string | null;
  exerciseName?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  assessorId?: string | null;
  assessorName?: string | null;
  startsAt: string;
  endsAt: string;
  room?: string | null;
  note?: string | null;
};

export type TimetableProblem = {
  severity: "blocking" | "caution";
  message: string;
  slotIds: string[];
};

export type PersonTimetable = {
  personId: string;
  name: string;
  role: "participant" | "assessor";
  slots: Slot[];
};

export type TimetableReview = {
  problems: TimetableProblem[];
  blocking: TimetableProblem[];
  /** 5.35.4: one per participant and per assessor. */
  individual: PersonTimetable[];
  /** Exercises in the design with nothing scheduled. */
  unscheduledExercises: { exerciseId: string; name: string }[];
  rooms: string[];
  firstStart: string | null;
  lastEnd: string | null;
};

/**
 * Practice, not clause values. A participant working longer than this without a
 * scheduled break, or a day longer than this, is flagged - not refused, because
 * a legitimate intensive day exists and the clause says "shall not compromise",
 * which is a judgement.
 */
export const MAX_STRETCH_MINUTES = 180;
export const LONG_DAY_MINUTES = 540;

const ms = (iso: string) => new Date(iso).getTime();
const mins = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 60000);
const overlaps = (a: Slot, b: Slot) => ms(a.startsAt) < ms(b.endsAt) && ms(b.startsAt) < ms(a.endsAt);
const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function reviewTimetable(input: {
  slots: Slot[];
  participants: { id: string; name: string }[];
  assessors: { id: string; name: string }[];
  designExercises?: { id: string; name: string }[];
}): TimetableReview {
  const slots = [...input.slots].sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
  const problems: TimetableProblem[] = [];

  // A person in two places at once. Checked per person rather than per slot so
  // the message can name them.
  const byPerson = new Map<string, { name: string; slots: Slot[] }>();
  const add = (id: string | null | undefined, name: string, s: Slot) => {
    if (!id) return;
    const entry = byPerson.get(id) ?? { name, slots: [] };
    entry.slots.push(s);
    byPerson.set(id, entry);
  };
  for (const s of slots) {
    add(s.candidateId, s.candidateName ?? "A participant", s);
    add(s.assessorId, s.assessorName ?? "An assessor", s);
  }
  for (const [, entry] of Array.from(byPerson.entries())) {
    for (let i = 0; i < entry.slots.length; i++) {
      for (let j = i + 1; j < entry.slots.length; j++) {
        if (overlaps(entry.slots[i], entry.slots[j])) {
          problems.push({
            severity: "blocking",
            message: `${entry.name} is booked twice at ${fmt(entry.slots[i].startsAt)}: ${entry.slots[i].exerciseName ?? entry.slots[i].kind} and ${entry.slots[j].exerciseName ?? entry.slots[j].kind}.`,
            slotIds: [entry.slots[i].id, entry.slots[j].id],
          });
        }
      }
    }
  }

  // A room holding two things at once.
  const byRoom = new Map<string, Slot[]>();
  for (const s of slots) {
    if (!s.room) continue;
    const arr = byRoom.get(s.room) ?? [];
    arr.push(s);
    byRoom.set(s.room, arr);
  }
  for (const [room, arr] of Array.from(byRoom.entries())) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (overlaps(arr[i], arr[j])) {
          problems.push({
            severity: "blocking",
            message: `${room} is double-booked at ${fmt(arr[i].startsAt)}.`,
            slotIds: [arr[i].id, arr[j].id],
          });
        }
      }
    }
  }

  // 5.35.5: nobody performs well with no break. Measured per participant across
  // their own slots, treating a break or lunch as the thing that resets it.
  for (const p of input.participants) {
    const own = slots.filter((s) => s.candidateId === p.id || (!s.candidateId && s.kind !== "exercise"));
    if (own.length === 0) continue;
    let stretchStart: string | null = null;
    let lastEnd: string | null = null;
    for (const s of own) {
      if (s.kind === "break" || s.kind === "lunch") {
        stretchStart = null;
        lastEnd = null;
        continue;
      }
      if (!stretchStart) stretchStart = s.startsAt;
      lastEnd = s.endsAt;
      if (mins(stretchStart, lastEnd) > MAX_STRETCH_MINUTES) {
        problems.push({
          severity: "caution",
          message: `${p.name} runs ${mins(stretchStart, lastEnd)} minutes from ${fmt(stretchStart)} with no break scheduled. Beyond about ${MAX_STRETCH_MINUTES} minutes people are being assessed on their stamina (5.35.5; the number is practice, not the clause).`,
          slotIds: [s.id],
        });
        stretchStart = null;
        lastEnd = null;
      }
    }
    const first = own[0];
    const last = own[own.length - 1];
    if (first && last && mins(first.startsAt, last.endsAt) > LONG_DAY_MINUTES) {
      problems.push({
        severity: "caution",
        message: `${p.name} is at the centre for ${Math.round(mins(first.startsAt, last.endsAt) / 60)} hours. A day that long affects what the later exercises measure (5.35.5).`,
        slotIds: [last.id],
      });
    }
  }

  // An exercise slot with nobody to observe it.
  for (const s of slots) {
    if (s.kind === "exercise" && s.candidateId && !s.assessorId) {
      problems.push({
        severity: "caution",
        message: `${s.exerciseName ?? "An exercise"} at ${fmt(s.startsAt)} for ${s.candidateName ?? "a participant"} has no assessor scheduled.`,
        slotIds: [s.id],
      });
    }
    if (!s.room) {
      problems.push({
        severity: "caution",
        message: `${s.exerciseName ?? s.kind} at ${fmt(s.startsAt)} has no room (5.35.3).`,
        slotIds: [s.id],
      });
    }
  }

  const scheduledExerciseIds = new Set(slots.map((s) => s.exerciseId).filter(Boolean) as string[]);
  const unscheduledExercises = (input.designExercises ?? [])
    .filter((x) => !scheduledExerciseIds.has(x.id))
    .map((x) => ({ exerciseId: x.id, name: x.name }));

  const individual: PersonTimetable[] = [
    ...input.participants.map((p) => ({
      personId: p.id,
      name: p.name,
      role: "participant" as const,
      // Cohort-wide slots (briefings, lunch) belong on everyone's timetable.
      slots: slots.filter((s) => s.candidateId === p.id || (!s.candidateId && s.kind !== "exercise")),
    })),
    ...input.assessors.map((a) => ({
      personId: a.id,
      name: a.name,
      role: "assessor" as const,
      slots: slots.filter((s) => s.assessorId === a.id || (!s.candidateId && !s.assessorId && s.kind !== "exercise")),
    })),
  ];

  return {
    problems,
    blocking: problems.filter((p) => p.severity === "blocking"),
    individual,
    unscheduledExercises,
    rooms: Array.from(byRoom.keys()).sort(),
    firstStart: slots[0]?.startsAt ?? null,
    lastEnd: slots.length ? slots.reduce((a, b) => (ms(a.endsAt) > ms(b.endsAt) ? a : b)).endsAt : null,
  };
}
