"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Activity, Download, Link2, Copy, MessageSquareText, PhoneCall, History, FlaskConical, Search,
  CalendarClock, Save, Loader2, AlertTriangle, Mail, X, Send, FileText, FolderArchive, ClipboardList, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PERSON_STATUS_LABEL, FOLLOW_UP_LABEL, SECTION_LABEL, reminderMessage, firstWord,
  type PersonProgress, type PersonStatus, type SectionState,
} from "@/lib/bespoke/progress-shared";
import { CONTACT_CHANNELS, CONTACT_CHANNEL_LABEL, type ContactHistoryRow } from "@/lib/bespoke/contact-log-shared";
import {
  saveScheduleAction, setVoucherExpiryAction, setTesterAction, logChaseAction, contactHistoryAction, sendBundleEmailsAction,
} from "./progress-actions";

export type ProgressVoucher = { id: string; code: string; max_uses: number; uses: number; expires_at: string | null };

type Filter = "all" | PersonStatus | "follow_up";

const STATUS_TONE: Record<PersonStatus, string> = {
  not_started: "bg-slate-100 text-slate-700",
  signed_in: "bg-sky-50 text-sky-700",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  scored: "bg-indigo-100 text-indigo-800",
};
const SECTION_TONE: Record<SectionState, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-sky-700",
  done: "text-emerald-700",
};

const DAY = 86_400_000;
function ago(iso: string | null, now: number): string {
  if (!iso) return "-";
  const d = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (d <= 0) {
    const h = Math.floor((now - new Date(iso).getTime()) / 3_600_000);
    return h <= 0 ? "just now" : `${h} h ago`;
  }
  return d === 1 ? "yesterday" : `${d} days ago`;
}
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Riyadh" }) : "-";
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Copy failed. Your browser blocked the clipboard.");
  }
}

export function ProgressPanel({
  bundleId,
  assessmentName,
  people,
  stages,
  held,
  completeBy,
  completeByLabel,
  followupDays,
  emailsEnabled,
  sharedLink,
  vouchers,
  now,
  sdcReports = false,
}: {
  bundleId: string;
  assessmentName: string;
  people: PersonProgress[];
  stages: { sjt: boolean; logica: boolean; persona: boolean };
  held: boolean;
  completeBy: string | null;
  completeByLabel: string | null;
  followupDays: number;
  emailsEnabled: boolean;
  sharedLink: string | null;
  vouchers: ProgressVoucher[];
  now: number;
  /** SDC competency framework: per-person executive summary and IDP links, plus the group report. */
  sdcReports?: boolean;
}) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [showTesters, setShowTesters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chase, setChase] = useState<{ keys: string[]; channel: string; note: string } | null>(null);
  const [history, setHistory] = useState<{ key: string; rows: ContactHistoryRow[] | null } | null>(null);
  // Schedule form
  const [dueDay, setDueDay] = useState(dateInput(completeBy));
  const [fuDays, setFuDays] = useState(String(followupDays));
  const [emails, setEmails] = useState(emailsEnabled);
  const [closeDays, setCloseDays] = useState<Record<string, string>>(
    Object.fromEntries(vouchers.map((v) => [v.id, dateInput(v.expires_at)])),
  );

  const visiblePeople = useMemo(() => people.filter((p) => showTesters || !p.isTester), [people, showTesters]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, not_started: 0, signed_in: 0, in_progress: 0, completed: 0, scored: 0, follow_up: 0 };
    for (const p of visiblePeople) {
      c.all += 1;
      c[p.status] += 1;
      if (p.followUp) c.follow_up += 1;
    }
    return c;
  }, [visiblePeople]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visiblePeople.filter((p) => {
      if (filter === "follow_up" ? !p.followUp : filter !== "all" && p.status !== filter) return false;
      if (!needle) return true;
      return [p.name, p.email, p.businessUnit, p.position, p.employeeId].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [visiblePeople, filter, q]);

  const byKey = useMemo(() => new Map(people.map((p) => [p.key, p])), [people]);
  const chosen = rows.filter((p) => selected.has(p.key));
  const allChosen = rows.length > 0 && chosen.length === rows.length;
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const reminderFor = (p: PersonProgress | null) =>
    reminderMessage({
      firstName: p ? firstWord(p.name) : "",
      assessmentName,
      link: sharedLink ?? "",
      completeBy: completeByLabel,
      started: !!p && p.status !== "not_started",
    });

  const run = (fn: () => Promise<{ ok: true } | { ok: true; count: number } | { error: string }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(okMsg);
        after?.();
      }
    });

  const emailPeople = (kind: "invite" | "reminder") => {
    const list = chosen.filter((p) => p.status !== "completed" && p.status !== "scored");
    if (list.length === 0) return toast.error("Everyone selected has already finished.");
    if (!window.confirm(`Send ${kind === "invite" ? "an invitation" : "a reminder"} email to ${list.length} ${list.length === 1 ? "person" : "people"} from Caliber?`)) return;
    start(async () => {
      const res = await sendBundleEmailsAction(
        bundleId,
        list.map((p) => ({ rosterId: p.rosterId, candidateId: p.candidateId, email: p.email, name: p.name, started: p.status !== "not_started" })),
        kind,
      );
      if ("error" in res) toast.error(res.error);
      else {
        if (res.failed > 0) toast.error(`${res.sent} sent, ${res.failed} failed. Failed sends are marked in each person's history.`);
        else toast.success(`${res.sent} email${res.sent === 1 ? "" : "s"} sent.`);
        setSelected(new Set());
      }
    });
  };

  const openHistory = (p: PersonProgress) => {
    if (history?.key === p.key) return setHistory(null);
    setHistory({ key: p.key, rows: null });
    start(async () => {
      const res = await contactHistoryAction(bundleId, p.email);
      setHistory({ key: p.key, rows: "error" in res ? [] : res.rows });
    });
  };

  const chips: Array<{ key: Filter; label: string; tone: string }> = [
    { key: "all", label: "Everyone", tone: "border-slate-300" },
    { key: "not_started", label: PERSON_STATUS_LABEL.not_started, tone: "border-slate-300" },
    { key: "signed_in", label: PERSON_STATUS_LABEL.signed_in, tone: "border-sky-200" },
    { key: "in_progress", label: PERSON_STATUS_LABEL.in_progress, tone: "border-sky-300" },
    { key: "completed", label: PERSON_STATUS_LABEL.completed, tone: "border-emerald-300" },
    { key: "scored", label: PERSON_STATUS_LABEL.scored, tone: "border-indigo-300" },
    { key: "follow_up", label: "Needs follow-up", tone: "border-amber-400" },
  ];

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-[#5391D5]" /> Progress and follow-up
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Everyone on this assessment, how far they are, and who needs a reminder.
            {held ? " The assessment is on hold, so nobody is flagged for follow-up yet." : ` People are flagged after ${followupDays} day${followupDays === 1 ? "" : "s"} without progress.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sharedLink && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(sharedLink, "Link copied. People sign in with their work email and resume where they stopped.")}>
              <Link2 className="h-4 w-4" /> Copy link
            </Button>
          )}
          {sdcReports && (
            <a href={`/api/admin/bundle-progress/${bundleId}/sdc-group`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5"><Users className="h-4 w-4" /> Group report</Button>
            </a>
          )}
          <a href={`/admin/bespoke/reports/filed`}>
            <Button size="sm" variant="outline" className="gap-1.5"><FolderArchive className="h-4 w-4" /> Filed reports</Button>
          </a>
          <a href={`/api/admin/bundle-progress/${bundleId}`}>
            <Button size="sm" className="gap-1.5"><Download className="h-4 w-4" /> Download Excel</Button>
          </a>
        </div>
      </div>

      {/* Status chips double as filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => { setFilter(c.key); setSelected(new Set()); }}
            className={`rounded-lg border px-3 py-1.5 text-left transition-colors ${c.tone} ${filter === c.key ? "bg-[#010131] text-white" : "bg-background hover:bg-muted"}`}
          >
            <div className="text-lg font-semibold leading-none">{counts[c.key]}</div>
            <div className={`mt-0.5 text-[11px] ${filter === c.key ? "text-white/80" : "text-muted-foreground"}`}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* Schedule: deadline, follow-up threshold, closing date, emails */}
      <details className="mt-4 rounded-lg border bg-muted/30 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          <CalendarClock className="mr-1.5 inline h-4 w-4 text-[#5391D5]" />
          Deadline and reminders
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {completeByLabel ? `Complete by ${completeByLabel}` : "No complete-by date"}
            {" · "}
            {vouchers.some((v) => v.expires_at) ? `Link closes ${shortDate(vouchers.find((v) => v.expires_at)!.expires_at)}` : "Link has no closing date"}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Complete by</span>
              <Input type="date" className="mt-1 w-48" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              <span className="mt-1 block text-xs text-muted-foreground">Shown to candidates on the welcome screen and in reminder messages. Leave empty for none.</span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Flag for follow-up after</span>
              <span className="mt-1 flex items-center gap-2">
                <Input className="w-20" inputMode="numeric" value={fuDays} onChange={(e) => setFuDays(e.target.value.replace(/[^0-9]/g, ""))} />
                <span className="text-xs text-muted-foreground">days without progress</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={emails} onChange={(e) => setEmails(e.target.checked)} />
              <span>
                <span className="font-medium">Send invitation and reminder emails from Caliber</span>
                <span className="block text-xs text-muted-foreground">
                  Off by default. Switch on only when the client&apos;s IT has approved mail from the platform; otherwise copy the reminder and send it yourself.
                </span>
              </span>
            </label>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => saveScheduleAction(bundleId, { completeBy: dueDay, followupDays: Number(fuDays || 0), emailsEnabled: emails }), "Saved.")}
            >
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Link closing date</div>
            <p className="text-xs text-muted-foreground">
              After the end of this day nobody new can sign in. People who already started can still return and finish. To close completely, put the assessment on hold.
            </p>
            {vouchers.length === 0 && <p className="text-xs text-muted-foreground">No link has been created for this assessment yet.</p>}
            {vouchers.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
                <span className="font-mono">{v.code}</span>
                <span className="text-muted-foreground">{v.uses} of {v.max_uses} seats</span>
                <Input type="date" className="h-8 w-40" value={closeDays[v.id] ?? ""} onChange={(e) => setCloseDays((s) => ({ ...s, [v.id]: e.target.value }))} />
                <Button size="sm" variant="outline" className="h-8" disabled={pending}
                  onClick={() => run(() => setVoucherExpiryAction(bundleId, v.id, closeDays[v.id] ?? ""), closeDays[v.id] ? "Closing date set." : "Closing date removed.")}>
                  Set
                </Button>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Search and bulk actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search name, email, unit" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showTesters} onChange={(e) => setShowTesters(e.target.checked)} /> Show testers
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{chosen.length > 0 ? `${chosen.length} selected` : `${rows.length} shown`}</span>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={(chosen.length || rows.length) === 0}
            onClick={() => {
              const list = (chosen.length ? chosen : rows).map((p) => p.email).filter(Boolean);
              copy(list.join("; "), `${list.length} email address${list.length === 1 ? "" : "es"} copied. Paste into Bcc.`);
            }}>
            <Mail className="h-4 w-4" /> Copy emails
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={!sharedLink}
            onClick={() => copy(reminderFor(chosen.length === 1 ? chosen[0] : null), "Reminder message copied.")}>
            <MessageSquareText className="h-4 w-4" /> Copy reminder
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={chosen.length === 0}
            onClick={() => setChase({ keys: chosen.map((p) => p.key), channel: "email", note: "" })}>
            <PhoneCall className="h-4 w-4" /> Mark as contacted
          </Button>
          {emailsEnabled && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={pending || chosen.length === 0} onClick={() => emailPeople("invite")}>
                <Send className="h-4 w-4" /> Email invitation
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={pending || chosen.length === 0} onClick={() => emailPeople("reminder")}>
                <Send className="h-4 w-4" /> Email reminder
              </Button>
            </>
          )}
        </div>
      </div>

      {chase && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-medium">Record a reminder for {chase.keys.length} {chase.keys.length === 1 ? "person" : "people"}</div>
          <label className="text-xs">
            <span className="block text-muted-foreground">How</span>
            <select className="mt-1 h-9 rounded-md border bg-background px-2 text-sm" value={chase.channel} onChange={(e) => setChase({ ...chase, channel: e.target.value })}>
              {CONTACT_CHANNELS.map((c) => <option key={c} value={c}>{CONTACT_CHANNEL_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="flex-1 text-xs">
            <span className="block text-muted-foreground">Note (optional)</span>
            <Input className="mt-1" maxLength={500} value={chase.note} onChange={(e) => setChase({ ...chase, note: e.target.value })} placeholder="e.g. Said they will finish on Thursday" />
          </label>
          <Button size="sm" disabled={pending}
            onClick={() => {
              const list = chase.keys.map((k) => byKey.get(k)).filter((p): p is PersonProgress => !!p);
              run(
                () => logChaseAction(bundleId, list.map((p) => ({ rosterId: p.rosterId, candidateId: p.candidateId, email: p.email })), chase.channel, chase.note),
                "Recorded.",
                () => { setChase(null); setSelected(new Set()); },
              );
            }}>
            Save
          </Button>
          <button type="button" className="p-2 text-muted-foreground hover:text-foreground" title="Cancel" onClick={() => setChase(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-3 max-h-[640px] overflow-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-left">
            <tr>
              <th className="w-8 px-2 py-2">
                <input type="checkbox" aria-label="Select all shown" checked={allChosen}
                  onChange={() => setSelected(allChosen ? new Set() : new Set(rows.map((p) => p.key)))} />
              </th>
              <th className="px-2 py-2">Person</th>
              <th className="px-2 py-2">Status</th>
              {stages.sjt && <th className="px-2 py-2">Scenarios</th>}
              {stages.logica && <th className="px-2 py-2">Reasoning</th>}
              {stages.persona && <th className="px-2 py-2">Persona</th>}
              <th className="px-2 py-2">Last activity</th>
              <th className="px-2 py-2">Follow-up</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Nobody matches this view.</td></tr>
            )}
            {rows.map((p) => (
              <FragmentRow key={p.key}>
                <tr className={`border-t align-top ${selected.has(p.key) ? "bg-[#5391D5]/5" : ""}`}>
                  <td className="px-2 py-2">
                    <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-foreground">
                      {p.name}
                      {p.isTester && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-800">tester</span>}
                      {!p.onRoster && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">not on list</span>}
                    </div>
                    <div className="text-muted-foreground">{p.email}</div>
                    {(p.businessUnit || p.grade != null) && (
                      <div className="text-muted-foreground">{[p.businessUnit, p.grade != null ? `Grade ${p.grade}` : null].filter(Boolean).join(" · ")}</div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[p.status]}`}>{PERSON_STATUS_LABEL[p.status]}</span>
                    {p.status === "scored" && p.scoredAt && <div className="mt-0.5 text-[10px] text-muted-foreground">{shortDate(p.scoredAt)}</div>}
                    {p.status === "completed" && p.completedAt && <div className="mt-0.5 text-[10px] text-muted-foreground">{shortDate(p.completedAt)}</div>}
                  </td>
                  {stages.sjt && (
                    <td className="px-2 py-2">
                      {p.sjt?.state === "done" ? (
                        <span className={SECTION_TONE.done}>Done</span>
                      ) : p.sjt && p.sjt.total > 0 ? (
                        <div className="w-24">
                          <div className="text-[11px]">{p.sjt.answered} of {p.sjt.total}</div>
                          <div className="mt-0.5 h-1.5 rounded bg-muted">
                            <div className="h-full rounded bg-[#5391D5]" style={{ width: `${Math.round((p.sjt.answered / p.sjt.total) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className={SECTION_TONE.not_started}>Not started</span>
                      )}
                    </td>
                  )}
                  {stages.logica && <td className={`px-2 py-2 ${SECTION_TONE[p.logica ?? "not_started"]}`}>{SECTION_LABEL[p.logica ?? "not_started"]}</td>}
                  {stages.persona && <td className={`px-2 py-2 ${SECTION_TONE[p.persona ?? "not_started"]}`}>{SECTION_LABEL[p.persona ?? "not_started"]}</td>}
                  <td className="whitespace-nowrap px-2 py-2">{ago(p.lastActivityAt, now)}</td>
                  <td className="px-2 py-2">
                    {p.followUp && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> {FOLLOW_UP_LABEL[p.followUp]}
                      </span>
                    )}
                    {p.contacts > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">Contacted {p.contacts}x, last {shortDate(p.lastContactAt)}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {sdcReports && p.candidateId && (p.status === "completed" || p.status === "scored") && (
                      <>
                        <ReportLink
                          href={`/api/admin/bundle/${p.candidateId}/sdc-report?kind=summary`}
                          label="Executive summary"
                          title={p.status === "completed" ? "Executive summary (files it and marks Scored)" : "Executive summary"}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </ReportLink>
                        <ReportLink
                          href={`/api/admin/bundle/${p.candidateId}/sdc-report?kind=idp`}
                          label="IDP"
                          title={p.status === "completed" ? "Individual development plan (files it and marks Scored)" : "Individual development plan"}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </ReportLink>
                      </>
                    )}
                    {!sdcReports && p.candidateId && (p.status === "completed" || p.status === "scored") && (
                      <a
                        href={`/api/admin/bundle/${p.candidateId}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.status === "completed" ? "Generate report (files it and marks Scored)" : "Open report"}
                        aria-label="Report"
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5391D5] transition-colors hover:border-border hover:bg-muted"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <IconButton title="Copy reminder for this person" disabled={!sharedLink} onClick={() => copy(reminderFor(p), `Reminder for ${firstWord(p.name) || p.name} copied.`)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton title="Mark as contacted" onClick={() => setChase({ keys: [p.key], channel: "phone", note: "" })}>
                      <PhoneCall className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton title="Contact history" onClick={() => openHistory(p)}>
                      <History className="h-3.5 w-3.5" />
                    </IconButton>
                    {p.rosterId && (
                      <IconButton
                        title={p.isTester ? "Unmark as tester" : "Mark as tester (can sit while on hold)"}
                        active={p.isTester}
                        disabled={pending}
                        onClick={() => run(() => setTesterAction(bundleId, p.rosterId!, !p.isTester), p.isTester ? "No longer a tester." : "Marked as tester.")}
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </td>
                </tr>
                {history?.key === p.key && (
                  <tr className="border-t bg-muted/30">
                    <td />
                    <td colSpan={8} className="px-2 py-2">
                      {history.rows == null ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading</span>
                      ) : history.rows.length === 0 ? (
                        <span className="text-muted-foreground">No contact recorded yet.</span>
                      ) : (
                        <ul className="space-y-1">
                          {history.rows.map((h) => (
                            <li key={h.id}>
                              <span className="font-medium">{shortDate(h.created_at)}</span>{" · "}
                              {h.kind === "manual" ? CONTACT_CHANNEL_LABEL[h.channel ?? "other"] : h.kind === "email_invite" ? "Invitation email" : "Reminder email"}
                              {!h.ok && <span className="ml-1 text-rose-700">(failed)</span>}
                              {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
                              {h.by && <span className="text-muted-foreground"> · by {h.by}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </FragmentRow>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ReportLink({ href, label, title, children }: { href: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={label}
      className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5391D5] transition-colors hover:border-border hover:bg-muted"
    >
      {children}
    </a>
  );
}

function IconButton({ title, onClick, disabled, active, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${active ? "border-sky-300 bg-sky-50 text-sky-700" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
