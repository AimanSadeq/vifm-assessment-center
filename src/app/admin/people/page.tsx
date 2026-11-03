import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Search, UserSearch } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { searchPeople, PEOPLE_SEARCH_MIN } from "@/lib/clients/people-search";
import { BackLink } from "@/components/shared/back-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * Find a person by name or email across every service (Ahmad, 3 Nov 2026).
 * One list of every sitting the person has: service, client, where it stands,
 * the report when one exists, and the page where that sitting is managed.
 * Admin only.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PeopleSearchPage({ searchParams }: { searchParams?: { q?: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const q = (searchParams?.q ?? "").trim();
  const hits = q.length >= PEOPLE_SEARCH_MIN ? await searchPeople(q) : [];
  const people = new Set(hits.map((h) => `${h.name.toLowerCase()}|${(h.email ?? "").toLowerCase()}`)).size;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Admin" history />
      <header>
        <div className="flex items-center gap-2">
          <UserSearch className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Find a person</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Search by name or email. Every sitting the person has on any service, with its status and report.
        </p>
      </header>

      <form method="get" action="/admin/people" className="flex max-w-xl items-center gap-2">
        <label htmlFor="people-q" className="sr-only">Name or email</label>
        <input
          id="people-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name or email"
          autoFocus
          minLength={PEOPLE_SEARCH_MIN}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </form>

      {q.length === 0 ? null : q.length < PEOPLE_SEARCH_MIN ? (
        <p className="text-sm text-muted-foreground">Type at least {PEOPLE_SEARCH_MIN} characters.</p>
      ) : hits.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No sitting on any service matches &ldquo;{q}&rdquo;.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The search covers AI Readiness Compass, Persona, Logica, Fluent, Techno, Pre-Hire, bespoke bundles and Reflect 360, by the name or email the person gave when they redeemed or were invited.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hits.length} sitting{hits.length === 1 ? "" : "s"} for {people} {people === 1 ? "person" : "people"}, newest first.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Report</TableHead>
                <TableHead className="w-20 text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hits.map((h, i) => (
                <TableRow key={`${h.service}-${i}`}>
                  <TableCell>
                    <div className="font-medium">{h.name}</div>
                    {h.email ? <div className="text-xs text-muted-foreground">{h.email}</div> : null}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: h.accent }} />
                      {h.service}
                    </span>
                  </TableCell>
                  <TableCell>{h.client ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className={h.completed ? "" : "text-amber-700"}>{h.state}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(h.date)}</TableCell>
                  <TableCell className="text-right">
                    {h.reports.length > 0 ? (
                      <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1">
                        {h.reports.map((r) => (
                          <a key={r.path} href={r.path} className="inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap">
                            <Download className="h-3.5 w-3.5" /> {r.label}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{h.completed ? "-" : "No report yet"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {h.managePath ? (
                      <Link href={h.managePath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
