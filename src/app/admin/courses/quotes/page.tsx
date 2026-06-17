import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Inbox, Mail, Building2, Calendar } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getServerT } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type {
  VifmCourseQuoteRequest, VifmCourseQuoteRequestStatus,
} from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quote requests · VIFM",
};

const STATUS_TONE: Record<VifmCourseQuoteRequestStatus, string> = {
  new:       "bg-amber-100 text-amber-900 border-amber-200",
  contacted: "bg-sky-100 text-sky-900 border-sky-200",
  quoted:    "bg-violet-100 text-violet-900 border-violet-200",
  won:       "bg-emerald-100 text-emerald-900 border-emerald-200",
  lost:      "bg-rose-100 text-rose-900 border-rose-200",
};

const STATUS_ORDER: VifmCourseQuoteRequestStatus[] = ["new", "contacted", "quoted", "won", "lost"];

type QuoteRow = Pick<
  VifmCourseQuoteRequest,
  | "id" | "status" | "created_at" | "updated_at"
  | "requester_name" | "requester_email" | "requester_company"
  | "course_id" | "course_code_snapshot" | "course_title_snapshot"
  | "estimated_group_size" | "preferred_start_date"
> & {
  engagement_type?: string;
  reflect_engagement_id?: string | null;
};

const ENGAGEMENT_TONE: Record<string, string> = {
  direct: "bg-muted text-muted-foreground border-border",
  ac: "bg-sky-50 text-sky-700 border-sky-200",
  ara: "bg-violet-50 text-violet-700 border-violet-200",
  reflect: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function QuoteRequestsListPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  // Admin-only: the page reads lead-capture PII via the service-role client,
  // and the admin shell has no role gate of its own, so guard here.
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") notFound();
  const sb = createServiceClient();
  const t = await getServerT();
  const filter = (searchParams?.status ?? "").toLowerCase();

  let query = sb
    .from("vifm_course_quote_requests")
    .select(
      "id, status, created_at, updated_at, requester_name, requester_email, requester_company, course_id, course_code_snapshot, course_title_snapshot, estimated_group_size, preferred_start_date, engagement_type, reflect_engagement_id"
    )
    .order("created_at", { ascending: false });

  if (filter && STATUS_ORDER.includes(filter as VifmCourseQuoteRequestStatus)) {
    query = query.eq("status", filter);
  }

  const { data, error } = await query.returns<QuoteRow[]>();

  // Per-status counts for the filter chip row
  const counts: Record<VifmCourseQuoteRequestStatus, number> = {
    new: 0, contacted: 0, quoted: 0, won: 0, lost: 0,
  };
  if (!filter) {
    for (const r of data ?? []) counts[r.status] += 1;
  } else {
    // Need a separate count query per status if the main query is filtered.
    const { data: allCounts } = await sb
      .from("vifm_course_quote_requests")
      .select("status");
    for (const r of (allCounts ?? []) as Array<{ status: VifmCourseQuoteRequestStatus }>) {
      counts[r.status] += 1;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> {t("adminCourses.backToCourses")}
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              {t("adminCourses.quotes.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("adminCourses.quotes.subtitlePre")} <code className="text-[11px]">/courses</code>.{" "}
              {t("adminCourses.quotes.subtitleTotal", { total })}
            </p>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterChip href="/admin/courses/quotes" label={`${t("adminCourses.quotes.filterAll")} (${total})`} active={!filter} />
          {STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              href={`/admin/courses/quotes?status=${s}`}
              label={`${t(`adminCourses.quotes.status.${s}`)} (${counts[s]})`}
              active={filter === s}
              tone={STATUS_TONE[s]}
            />
          ))}
        </div>

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-rose-700">{t("adminCourses.quotes.loadFailed", { error: error.message })}</p>
            </CardContent>
          </Card>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter
                  ? t("adminCourses.quotes.emptyFiltered", { status: filter })
                  : t("adminCourses.quotes.emptyAll")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("adminCourses.quotes.inboxCount", { n: data.length })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminCourses.quotes.colRequester")}</TableHead>
                    <TableHead>{t("adminCourses.quotes.colProgramme")}</TableHead>
                    <TableHead className="text-center">{t("adminCourses.quotes.colStatus")}</TableHead>
                    <TableHead>{t("adminCourses.quotes.colGroup")}</TableHead>
                    <TableHead className="text-right">{t("adminCourses.quotes.colReceived")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          href={`/admin/courses/quotes/${r.id}`}
                          className="block"
                        >
                          <div className="text-sm font-medium hover:text-accent transition-colors">{r.requester_name}</div>
                          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {r.requester_email}
                          </div>
                          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" /> {r.requester_company}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm">{r.course_title_snapshot ?? t("adminCourses.quotes.courseRemoved")}</div>
                        {r.course_code_snapshot && (
                          <div className="text-[10px] font-mono text-muted-foreground">{r.course_code_snapshot}</div>
                        )}
                        {r.engagement_type && r.engagement_type !== "direct" && (
                          <div className="mt-1 inline-flex items-center gap-1.5">
                            <span
                              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                ENGAGEMENT_TONE[r.engagement_type] ?? ENGAGEMENT_TONE.direct
                              }`}
                            >
                              {r.engagement_type}
                            </span>
                            {r.engagement_type === "reflect" && r.reflect_engagement_id && (
                              <Link
                                href={`/reflect/consultant/engagements/${r.reflect_engagement_id}`}
                                className="text-[10px] text-accent hover:underline"
                                title={t("adminCourses.quotes.openReflectSource")}
                              >
                                {t("adminCourses.quotes.source")} ↗
                              </Link>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm align-top">
                        {r.estimated_group_size ?? "-"}
                        {r.preferred_start_date && (
                          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {r.preferred_start_date}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground align-top tabular-nums">
                        {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        <div className="text-[10px]">
                          {new Date(r.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  href, label, active, tone,
}: {
  href: string;
  label: string;
  active: boolean;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-accent text-white border-accent"
          : tone ?? "bg-card hover:bg-muted border-input"
      }`}
    >
      {label}
    </Link>
  );
}
