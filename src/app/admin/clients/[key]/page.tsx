import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  Building2,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Settings2,
  Ticket,
  Users,
} from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadClient360, type ReportRow } from "@/lib/clients/client-360";
import { portalService } from "@/lib/clients/portal-services";
import { araRegionLabel } from "@/lib/constants/ara-regions";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * One client, everything it holds on Caliber (Ahmad, 3 Nov 2026): every
 * service the client subscribes to, the activity in each, the people who
 * completed, their reports, and one download-all per service where the
 * platform can produce it. Read-only; each section links to the page where
 * the service is actually run. Admin only.
 */

const SECTOR_LABEL: Record<string, string> = { government: "Government", banking: "Banking", general: "General" };
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  live: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  open: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  completed: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  closed: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  report_released: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  draft: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  suspended: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  archived: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function humanize(s: string | null | undefined): string {
  if (!s) return "-";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_TONE[status] ?? "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{humanize(status)}</Badge>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 min-w-[88px]">
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function DownloadAll({ href, count }: { href: string | null; count: number }) {
  if (!href || count === 0) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
      title="Every completed report in one ZIP"
    >
      <Archive className="h-4 w-4" /> Download all ({count})
    </a>
  );
}

function ManageLink({ href, label = "Open" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}

function Section({
  title,
  accent,
  icon,
  stats,
  actions,
  children,
}: {
  title: string;
  accent: string;
  icon: React.ReactNode;
  stats?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="border-l-4 px-5 py-4" style={{ borderLeftColor: accent }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md p-1.5 text-white" style={{ backgroundColor: accent }}>
              {icon}
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        {stats ? <div className="mt-3 flex flex-wrap gap-2">{stats}</div> : null}
      </div>
      <div className="border-t px-5 py-4">{children}</div>
    </section>
  );
}

function PeopleTable({ rows, emptyText, limit = 100 }: { rows: ReportRow[]; emptyText: string; limit?: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const shown = rows.slice(0, limit);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="w-28 text-right">Report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(r.date)}</TableCell>
              <TableCell className="text-muted-foreground">{r.summary || "-"}</TableCell>
              <TableCell className="text-right">
                {r.reportPath ? (
                  <a href={r.reportPath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" title="Download PDF">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > shown.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {shown.length} of {rows.length}. Use the download-all for the full set.
        </p>
      ) : null}
    </>
  );
}

export default async function ClientPage({ params }: { params: { key: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  let key = params.key;
  try {
    key = decodeURIComponent(params.key);
  } catch {
    key = params.key;
  }
  const data = await loadClient360(key.trim().toLowerCase());
  if (!data) notFound();

  const { client, allocations, voucherServices, arc, reflect, prehire, bundles, activeServices } = data;
  const arcMeta = portalService("arc");
  const reflectMeta = portalService("reflect");
  const prehireMeta = portalService("prehire");

  const descriptors = [
    client.region ? araRegionLabel(client.region) : null,
    client.sector ? SECTOR_LABEL[client.sector] ?? humanize(client.sector) : null,
    client.industry,
    client.country,
  ].filter((x): x is string => !!x);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/clients" label="All clients" history />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{client.name}</h1>
          </div>
          {descriptors.length > 0 ? <p className="mt-1 text-muted-foreground">{descriptors.join(" · ")}</p> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeServices.length === 0 ? (
              <Badge variant="outline" className="border-dashed text-muted-foreground">No activity on any service yet</Badge>
            ) : (
              activeServices.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {client.acId ? (
            <Link
              href={`/portal?org=${client.acId}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <Layers className="h-4 w-4" /> Client portal (admin view)
            </Link>
          ) : null}
          <Link
            href="/admin/clients/allocations"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" /> Allocations
          </Link>
        </div>
      </header>

      {allocations.length > 0 ? (
        <div className="rounded-xl border bg-muted/20 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subscribed services</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allocations.map((a) => {
              const meta = portalService(a.service);
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta?.accent ?? "#64748b" }} />
                    <span className="font-medium">{meta?.label ?? a.service}</span>
                    {a.status !== "active" ? <StatusBadge status={a.status} /> : null}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>
                      {a.seats_used} of {a.seats_total} used
                    </div>
                    {a.expires_at ? <div>until {fmtDate(a.expires_at)}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {voucherServices.map((s) => (
        <Section
          key={s.service}
          title={s.label}
          accent={s.accent}
          icon={<Ticket className="h-4 w-4" />}
          stats={
            <>
              <Stat label="Issued" value={s.issued} />
              <Stat label="Redeemed" value={s.redeemed} />
              <Stat label="Completed" value={s.completed} />
            </>
          }
          actions={
            <>
              <DownloadAll href={s.zipPath} count={s.rows.length} />
              <ManageLink href={s.managePath} label="Manage in portal" />
            </>
          }
        >
          <PeopleTable rows={s.rows} emptyText="No one has completed this assessment yet." />
        </Section>
      ))}

      {arc && (arc.assessments.length > 0 || arc.cohorts.length > 0) ? (
        <Section
          title="AI Readiness Compass"
          accent={arcMeta?.accent ?? "#7c3aed"}
          icon={<FileText className="h-4 w-4" />}
          stats={
            <>
              <Stat label="Sittings" value={arc.assessments.length} />
              <Stat label="Respondents" value={arc.assessments.reduce((n, a) => n + a.respondents, 0)} />
              <Stat label="Completed" value={arc.assessments.reduce((n, a) => n + a.completed, 0)} />
              <Stat label="Personal reports" value={arc.delegates.length} />
            </>
          }
          actions={
            <>
              <DownloadAll href={arc.zipPath} count={arc.delegates.length} />
              <ManageLink href="/ara/consultant" label="All assessments" />
            </>
          }
        >
          <div className="space-y-5">
            {arc.assessments.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Sittings</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="w-44 text-right">Reports</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arc.assessments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          <Link href={a.managePath} className="hover:underline">{a.label}</Link>
                          {a.isPractice ? <Badge variant="outline" className="ml-2 border-dashed text-muted-foreground">Practice</Badge> : null}
                        </TableCell>
                        <TableCell>{humanize(a.stage)}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(a.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {a.completed} / {a.respondents}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.orgReportPath && a.completed > 0 ? (
                            <a href={a.orgReportPath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                              <Download className="h-3.5 w-3.5" /> Organizational PDF
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {arc.cohorts.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Voucher cohorts</h3>
                <div className="flex flex-wrap gap-2">
                  {arc.cohorts.map((c) => (
                    <Link
                      key={c.label}
                      href={c.insightsPath}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground">{c.redeemed} redeemed</span>
                    </Link>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Each cohort opens its insights page, with the cohort dashboard PDF and the ZIP of delegate reports.</p>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Delegates with a personal report</h3>
              <PeopleTable rows={arc.delegates} emptyText="No delegate has completed a personal sitting yet." />
            </div>
          </div>
        </Section>
      ) : null}

      {reflect && reflect.engagements.length > 0 ? (
        <Section
          title="Reflect 360"
          accent={reflectMeta?.accent ?? "#0d9488"}
          icon={<Users className="h-4 w-4" />}
          stats={
            <>
              <Stat label="Engagements" value={reflect.engagements.length} />
              <Stat label="Participants" value={reflect.engagements.reduce((n, e) => n + e.participants, 0)} />
              <Stat label="Reports ready" value={reflect.participants.length} />
            </>
          }
          actions={<ManageLink href="/reflect/consultant" label="All engagements" />}
        >
          <div className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Reports ready</TableHead>
                  <TableHead className="w-40 text-right">Cohort report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reflect.engagements.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link href={e.managePath} className="hover:underline">{e.name}</Link>
                    </TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(e.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {e.released} / {e.participants}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.released > 0 ? (
                        <a href={e.cohortReportPath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          <Download className="h-3.5 w-3.5" /> Cohort PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Participants with a report</h3>
              <PeopleTable rows={reflect.participants} emptyText="No participant's feedback has closed yet." />
            </div>
          </div>
        </Section>
      ) : null}

      {prehire && prehire.engagements.length > 0 ? (
        <Section
          title="Pre-Hire / Assessment Center"
          accent={prehireMeta?.accent ?? "#e11d48"}
          icon={<Layers className="h-4 w-4" />}
          stats={
            <>
              <Stat label="Engagements" value={prehire.engagements.length} />
              <Stat label="Candidates" value={prehire.engagements.reduce((n, e) => n + e.candidates, 0)} />
              <Stat label="Completed" value={prehire.candidates.length} />
            </>
          }
          actions={<ManageLink href="/admin/engagements" label="All engagements" />}
        >
          <div className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prehire.engagements.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link href={e.managePath} className="hover:underline">{e.name}</Link>
                    </TableCell>
                    <TableCell>{humanize(e.type)}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(e.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {e.completed} / {e.candidates}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Candidates with a report</h3>
              <PeopleTable rows={prehire.candidates} emptyText="No candidate has completed yet." />
            </div>
          </div>
        </Section>
      ) : null}

      {bundles && bundles.length > 0 ? (
        <Section
          title="Bespoke bundles"
          accent="#334155"
          icon={<Layers className="h-4 w-4" />}
          stats={
            <>
              <Stat label="Bundles" value={bundles.length} />
              <Stat label="Completed" value={bundles.reduce((n, b) => n + b.completed, 0)} />
              <Stat label="Scored" value={bundles.reduce((n, b) => n + b.scored, 0)} />
              <Stat label="Filed reports" value={bundles.reduce((n, b) => n + b.filedReports, 0)} />
            </>
          }
          actions={<ManageLink href="/admin/bespoke" label="All bundles" />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bundle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Invited</TableHead>
                <TableHead className="text-right">In progress</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Scored</TableHead>
                <TableHead className="w-44 text-right">Reports</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link href={b.managePath} className="hover:underline">{b.name}</Link>
                    <span className="ml-2 text-xs text-muted-foreground">{humanize(b.kind)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(b.createdAt)}</TableCell>
                  <TableCell className="text-right">{b.invited}</TableCell>
                  <TableCell className="text-right">{b.inProgress}</TableCell>
                  <TableCell className="text-right">{b.completed}</TableCell>
                  <TableCell className="text-right">{b.scored}</TableCell>
                  <TableCell className="text-right">
                    {b.zipPath ? (
                      <a href={b.zipPath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Archive className="h-3.5 w-3.5" /> ZIP ({b.filedReports})
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not filed yet</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      {activeServices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">This client has no activity on any service yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Allocate seats or issue vouchers and the activity will appear here as people complete.
          </p>
        </div>
      ) : null}
    </div>
  );
}
