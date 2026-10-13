import "server-only";

// Report filing for bespoke bundles (00237, Ali's recommendations 3 and 4).
//
// When staff generate a candidate's Combined report or High-Potential Profile,
// the PDF is kept in the private 'bundle-reports' bucket, foldered by company /
// assessment / candidate, with one bundle_report_files row per candidate and
// report kind (regenerating replaces it). The first filing also moves the
// candidate from 'completed' to 'scored'.
//
// Filing is a side effect of a download, so it must never break the download:
// every function here catches, logs and returns a result instead of throwing,
// and tolerates 00237 not being applied yet (the table, bucket or 'scored'
// status missing all surface as ok:false).

import JSZip from "jszip";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, fetchAllByIdChunks } from "@/lib/ara/paginate";
import {
  buildReportStoragePath,
  buildZipEntryPath,
  dedupeZipPath,
  reportKindLabel,
  type BundleReportKind,
} from "./report-filing-paths";

export const BUNDLE_REPORTS_BUCKET = "bundle-reports";
/** Upper bound on one ZIP, so a large company cannot exhaust the server. */
export const ZIP_MAX_FILES = 300;

export type FileReportResult =
  | { ok: true; storagePath: string; scored: boolean }
  | { ok: false; error: string };

export async function fileBundleReport(input: {
  candidateId: string;
  kind: BundleReportKind;
  fileName: string;
  buffer: Buffer | Uint8Array;
  /** profiles.id of the staff member who generated it; null in dev mode. */
  actorId?: string | null;
}): Promise<FileReportResult> {
  const fail = (error: string): FileReportResult => {
    console.error(`[report filing] ${input.kind} for ${input.candidateId}: ${error}`);
    return { ok: false, error };
  };
  try {
    const sb = createServiceClient();
    const { data: cand, error: candErr } = await sb
      .from("bundle_candidates")
      .select("id, bespoke_service_id, organization_id, full_name, status")
      .eq("id", input.candidateId)
      .maybeSingle<{
        id: string; bespoke_service_id: string; organization_id: string | null;
        full_name: string | null; status: string;
      }>();
    if (candErr) return fail(candErr.message);
    if (!cand) return fail("Candidate not found.");

    const { data: bundle } = await sb
      .from("bespoke_services")
      .select("name_en, organization_id")
      .eq("id", cand.bespoke_service_id)
      .maybeSingle<{ name_en: string | null; organization_id: string | null }>();
    // The candidate's own organisation wins; a bundle's client is the fallback
    // so a candidate row without one still lands in the right company folder.
    const orgId = cand.organization_id ?? bundle?.organization_id ?? null;
    let orgName: string | null = null;
    if (orgId) {
      const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
      orgName = org?.name ?? null;
    }

    const storagePath = buildReportStoragePath({
      orgId,
      orgName,
      bundleId: cand.bespoke_service_id,
      bundleName: bundle?.name_en ?? null,
      candidateId: cand.id,
      candidateName: cand.full_name,
      kind: input.kind,
    });

    // The previous copy, if its path has since changed (renamed candidate,
    // company or bundle), is removed once the new one is in place.
    const { data: prev, error: prevErr } = await sb
      .from("bundle_report_files")
      .select("storage_path")
      .eq("bundle_candidate_id", cand.id)
      .eq("kind", input.kind)
      .maybeSingle<{ storage_path: string }>();
    if (prevErr) return fail(prevErr.message);

    const up = await sb.storage.from(BUNDLE_REPORTS_BUCKET).upload(storagePath, input.buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return fail(up.error.message);

    const row = await sb.from("bundle_report_files").upsert(
      {
        bespoke_service_id: cand.bespoke_service_id,
        bundle_candidate_id: cand.id,
        organization_id: orgId,
        kind: input.kind,
        storage_path: storagePath,
        file_name: input.fileName,
        size_bytes: input.buffer.byteLength,
        created_by: input.actorId ?? null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "bundle_candidate_id,kind" },
    );
    if (row.error) {
      if (!prev) await sb.storage.from(BUNDLE_REPORTS_BUCKET).remove([storagePath]);
      return fail(row.error.message);
    }
    if (prev && prev.storage_path !== storagePath) {
      const rm = await sb.storage.from(BUNDLE_REPORTS_BUCKET).remove([prev.storage_path]);
      if (rm.error) console.error("[report filing] could not remove the superseded copy:", rm.error.message);
    }

    // Completed -> Scored. Conditional, so it is race-safe and never moves an
    // invited / in-progress candidate (or rewrites scored_at on a regeneration).
    const st = await sb
      .from("bundle_candidates")
      .update({ status: "scored", scored_at: new Date().toISOString() })
      .eq("id", cand.id)
      .eq("status", "completed")
      .select("id");
    if (st.error) return fail(`Filed, but the status was not updated: ${st.error.message}`);
    return { ok: true, storagePath, scored: (st.data?.length ?? 0) > 0 };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Filing failed.");
  }
}

export type FiledReport = {
  id: string;
  bundleId: string;
  bundleName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  organizationId: string | null;
  orgName: string;
  kind: string;
  kindLabel: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
};

type FileRow = {
  id: string;
  bespoke_service_id: string;
  bundle_candidate_id: string;
  organization_id: string | null;
  kind: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
};

/**
 * Filed reports, newest first, joined with candidate, bundle and company names.
 * organizationId: a uuid scopes to that company, null to reports with no
 * company, undefined to every company. Returns [] when 00237 is not applied.
 */
export async function loadFiledReports(
  filter: { organizationId?: string | null; bundleId?: string } = {},
): Promise<FiledReport[]> {
  try {
    const sb = createServiceClient();
    const rows = await fetchAllPages<FileRow>((from, to) => {
      let q = sb
        .from("bundle_report_files")
        .select("id, bespoke_service_id, bundle_candidate_id, organization_id, kind, storage_path, file_name, size_bytes, created_at");
      if (filter.organizationId === null) q = q.is("organization_id", null);
      else if (filter.organizationId) q = q.eq("organization_id", filter.organizationId);
      if (filter.bundleId) q = q.eq("bespoke_service_id", filter.bundleId);
      return q.order("created_at", { ascending: false }).order("id").range(from, to);
    });
    if (rows.length === 0) return [];

    const uniq = (xs: Array<string | null>) => Array.from(new Set(xs.filter((x): x is string => !!x)));
    const [cands, bundles, orgs] = await Promise.all([
      fetchAllByIdChunks<{ id: string; full_name: string | null; email: string | null }>(
        uniq(rows.map((r) => r.bundle_candidate_id)),
        (chunk, from, to) => sb.from("bundle_candidates").select("id, full_name, email").in("id", chunk).order("id").range(from, to),
      ),
      fetchAllByIdChunks<{ id: string; name_en: string | null }>(
        uniq(rows.map((r) => r.bespoke_service_id)),
        (chunk, from, to) => sb.from("bespoke_services").select("id, name_en").in("id", chunk).order("id").range(from, to),
      ),
      fetchAllByIdChunks<{ id: string; name: string | null }>(
        uniq(rows.map((r) => r.organization_id)),
        (chunk, from, to) => sb.from("organizations").select("id, name").in("id", chunk).order("id").range(from, to),
      ),
    ]);
    const candById = new Map(cands.map((c) => [c.id, c]));
    const bundleById = new Map(bundles.map((b) => [b.id, b.name_en]));
    const orgById = new Map(orgs.map((o) => [o.id, o.name]));

    return rows.map((r) => {
      const c = candById.get(r.bundle_candidate_id);
      return {
        id: r.id,
        bundleId: r.bespoke_service_id,
        bundleName: bundleById.get(r.bespoke_service_id) || "Bespoke bundle",
        candidateId: r.bundle_candidate_id,
        candidateName: c?.full_name || "Candidate",
        candidateEmail: c?.email ?? null,
        organizationId: r.organization_id,
        orgName: (r.organization_id && orgById.get(r.organization_id)) || "Unassigned",
        kind: r.kind,
        kindLabel: reportKindLabel(r.kind),
        storagePath: r.storage_path,
        fileName: r.file_name,
        sizeBytes: r.size_bytes,
        createdAt: r.created_at,
      };
    });
  } catch (e) {
    console.error("[report filing] could not load filed reports:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** One filed report's storage path and download name, or null. */
export async function getFiledReport(id: string): Promise<{ storagePath: string; fileName: string } | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_report_files")
      .select("storage_path, file_name")
      .eq("id", id)
      .maybeSingle<{ storage_path: string; file_name: string }>();
    return data ? { storagePath: data.storage_path, fileName: data.file_name } : null;
  } catch {
    return null;
  }
}

/** Short-lived signed URL for a filed PDF (downloads under `downloadName` when given). */
export async function signedReportUrl(storagePath: string, seconds = 300, downloadName?: string): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.storage
      .from(BUNDLE_REPORTS_BUCKET)
      .createSignedUrl(storagePath, seconds, downloadName ? { download: downloadName } : undefined);
    if (error) {
      console.error("[report filing] signed URL failed:", error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * ZIP of filed reports as {Org}/{Bundle}/{Candidate} - {kind}.pdf. At most
 * ZIP_MAX_FILES files; anything left out (over the cap, or a file that could
 * not be read) is listed in a README inside the archive rather than dropped
 * silently.
 */
export async function buildReportsZip(rows: FiledReport[]): Promise<Buffer> {
  const sb = createServiceClient();
  const zip = new JSZip();
  const taken = new Set<string>();
  const picked = rows.slice(0, ZIP_MAX_FILES);
  const missing: string[] = [];

  const entries = picked.map((r) => ({
    row: r,
    path: dedupeZipPath(
      buildZipEntryPath({ orgName: r.orgName, bundleName: r.bundleName, candidateName: r.candidateName, kind: r.kind }),
      taken,
    ),
  }));

  // A few downloads at a time: quicker than one by one, gentle on Storage.
  const POOL = 5;
  for (let i = 0; i < entries.length; i += POOL) {
    await Promise.all(
      entries.slice(i, i + POOL).map(async ({ row, path }) => {
        try {
          const dl = await sb.storage.from(BUNDLE_REPORTS_BUCKET).download(row.storagePath);
          if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "empty");
          zip.file(path, Buffer.from(await dl.data.arrayBuffer()));
        } catch (e) {
          console.error(`[report filing] zip: could not read ${row.storagePath}:`, e instanceof Error ? e.message : e);
          missing.push(`${path} (could not be read; generate the report again)`);
        }
      }),
    );
  }
  for (const r of rows.slice(ZIP_MAX_FILES)) {
    missing.push(`${r.orgName} / ${r.bundleName} / ${r.candidateName} - ${r.kindLabel} (over the ${ZIP_MAX_FILES}-file limit)`);
  }
  if (missing.length) {
    zip.file(
      "README.txt",
      `These reports are not in this archive:\r\n\r\n${missing.join("\r\n")}\r\n\r\n` +
        `Download them from Filed reports in the admin, one assessment at a time.\r\n`,
    );
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
