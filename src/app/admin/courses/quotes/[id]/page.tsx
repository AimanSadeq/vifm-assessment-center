import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, Building2, Calendar, Globe2, Users } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  VifmCourseQuoteRequest, VifmCourseQuoteRequestStatus,
} from "@/types/database";
import { QuoteRequestActionsPanel } from "./_components/actions-panel";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<VifmCourseQuoteRequestStatus, string> = {
  new:       "bg-amber-100 text-amber-900 border-amber-200",
  contacted: "bg-sky-100 text-sky-900 border-sky-200",
  quoted:    "bg-violet-100 text-violet-900 border-violet-200",
  won:       "bg-emerald-100 text-emerald-900 border-emerald-200",
  lost:      "bg-rose-100 text-rose-900 border-rose-200",
};

export default async function QuoteRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = createServiceClient();
  const { data: q } = await sb
    .from("vifm_course_quote_requests")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<VifmCourseQuoteRequest>();
  if (!q) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/admin/courses/quotes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to inbox
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${STATUS_TONE[q.status]}`}>
                {q.status}
              </span>
              <span className="text-xs text-muted-foreground">
                Submitted {new Date(q.created_at).toLocaleString("en-GB", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-primary">
              {q.requester_name} · {q.requester_company}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Quote request for{" "}
              <strong className="text-foreground">{q.course_title_snapshot ?? "(course removed)"}</strong>
              {q.course_code_snapshot && (
                <span className="font-mono text-[11px] ms-1.5">({q.course_code_snapshot})</span>
              )}
            </p>
          </div>
          {q.course_id && q.course_code_snapshot && (
            <Link
              href={`/admin/courses/${q.course_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              Open course in admin <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-5">
            {/* Requester */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requester</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row icon={Mail} label="Email">
                  <a href={`mailto:${q.requester_email}`} className="text-accent hover:underline">
                    {q.requester_email}
                  </a>
                </Row>
                <Row icon={Building2} label="Company">{q.requester_company}</Row>
                {q.requester_role && <Row label="Role">{q.requester_role}</Row>}
                {q.requester_phone && (
                  <Row icon={Phone} label="Phone">
                    <a href={`tel:${q.requester_phone}`} className="text-accent hover:underline">
                      {q.requester_phone}
                    </a>
                  </Row>
                )}
              </CardContent>
            </Card>

            {/* Programme details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Programme details requested</CardTitle>
                <CardDescription>
                  What the requester captured at submission. Use this when scoping the quote.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <Row icon={Users} label="Group size">{q.estimated_group_size ?? "-"}</Row>
                <Row icon={Calendar} label="Preferred start">{q.preferred_start_date ?? "-"}</Row>
                <Row icon={Globe2} label="Language">{q.preferred_language ?? "-"}</Row>
                <Row label="Delivery mode">
                  {q.delivery_mode ? q.delivery_mode.replace("_", " ") : "-"}
                </Row>
              </CardContent>
            </Card>

            {/* Free-text notes */}
            {q.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes from the requester</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{q.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Internal notes (sales-only) - editable */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
                <CardDescription>
                  Sales notes for VIFM use only. Not visible to the requester.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuoteRequestActionsPanel
                  id={q.id}
                  initialStatus={q.status}
                  initialNotes={q.internal_notes ?? ""}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - pipeline timeline */}
          <aside className="lg:sticky lg:top-6 self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-xs">
                  <Step active label="Submitted" timestamp={q.created_at} />
                  <Step active={!!q.contacted_at} label="Contacted" timestamp={q.contacted_at} />
                  <Step active={!!q.quoted_at} label="Quoted" timestamp={q.quoted_at} />
                  <Step
                    active={!!q.closed_at}
                    label={q.status === "won" ? "Won" : q.status === "lost" ? "Lost" : "Closed"}
                    timestamp={q.closed_at}
                  />
                </ol>
                {q.updated_at !== q.created_at && (
                  <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t">
                    Last updated{" "}
                    {new Date(q.updated_at).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon, label, children,
}: {
  icon?: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}

function Step({ active, label, timestamp }: { active: boolean; label: string; timestamp: string | null }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`inline-block h-2 w-2 rounded-full mt-1.5 shrink-0 ${
          active ? "bg-accent" : "bg-muted-foreground/30"
        }`}
      />
      <div className="flex-1">
        <p className={`font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
        {timestamp && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(timestamp).toLocaleString("en-GB", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </li>
  );
}
