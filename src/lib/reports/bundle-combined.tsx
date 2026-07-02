// ─────────────────────────────────────────────────────────────
// Bespoke bundle - COMBINED assessment report. One PDF for the whole sitting:
// a branded cover with the per-service executive summary + contents, followed
// by the full Persona profile, the Persona Leadership Report, and the Logica
// result report, merged with pdf-lib. Each section renders through the exact
// same builders as its standalone endpoint, so the combined report can never
// drift from the individual ones.
// ─────────────────────────────────────────────────────────────

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";
import { buildPersonaPdfData } from "@/lib/reports/persona-report-data";
import { PersonaProfilePdf } from "@/lib/reports/persona-profile";
import { buildLeadershipPdfData } from "@/lib/reports/persona-leadership-data";
import { LeadershipReportPdf } from "@/lib/reports/persona-leadership";
import { buildPsyReportData } from "@/lib/reports/psy-report-data";
import { PsychometricReport } from "@/lib/reports/psychometric-report";
import { personaBand } from "@/lib/scoring/persona-bands";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#f8fafc",
  emerald: "#059669",
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 22, paddingHorizontal: 22, marginBottom: 18 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 21, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 6 },
  subtitle: { fontSize: 10, color: "#c7d2fe", marginTop: 4 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8 },
  panel: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 10, backgroundColor: C.bgSoft },
  panelTitle: { fontSize: 9, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  bigValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 3 },
  sub: { fontSize: 8.5, color: C.textLight, marginTop: 2, lineHeight: 1.4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowName: { fontSize: 9.5, color: C.text },
  rowVal: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary },
  tocRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tocName: { fontSize: 10, color: C.text },
  tocPage: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.accent },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

type CoverData = {
  bundleName: string;
  candidateName: string;
  candidateEmail: string;
  orgName: string | null;
  completedAt: string | null;
  persona: { overall: number; bandLabel: string; styleLabel: string; leadership: number; management: number } | null;
  logica: { scopeLabel: string; scales: { name: string; label: string; band: string }[]; overall: string | null } | null;
  contents: { name: string; page: number }[];
};

function CombinedCover({ d }: { d: CoverData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM Bespoke Services · Combined Assessment Report</Text>
          <Text style={s.title}>{d.bundleName}</Text>
          <Text style={s.subtitle}>
            {d.candidateName} · {d.candidateEmail}
            {d.orgName ? ` · for ${d.orgName}` : ""}
            {d.completedAt ? ` · completed ${d.completedAt}` : ""}
          </Text>
        </View>

        <Text style={s.h2}>Sitting at a glance</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {d.persona && (
            <View style={[s.panel, { flex: 1 }]}>
              <Text style={s.panelTitle}>Persona® · behavioural self-assessment</Text>
              <Text style={s.bigValue}>{d.persona.overall.toFixed(2)} / 5</Text>
              <Text style={s.sub}>Overall self-rating · {d.persona.bandLabel}</Text>
              <View style={{ marginTop: 6 }}>
                <View style={s.row}>
                  <Text style={s.rowName}>Leadership orientation</Text>
                  <Text style={s.rowVal}>{d.persona.styleLabel}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.rowName}>Leadership (transformational)</Text>
                  <Text style={s.rowVal}>{d.persona.leadership.toFixed(2)}</Text>
                </View>
                <View style={[s.row, { borderBottomWidth: 0 }]}>
                  <Text style={s.rowName}>Management (transactional)</Text>
                  <Text style={s.rowVal}>{d.persona.management.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
          {d.logica && (
            <View style={[s.panel, { flex: 1 }]}>
              <Text style={s.panelTitle}>Logica® · {d.logica.scopeLabel}</Text>
              <Text style={s.bigValue}>{d.logica.overall ?? "-"}</Text>
              <Text style={s.sub}>Overall reasoning result</Text>
              <View style={{ marginTop: 6 }}>
                {d.logica.scales.map((sc, i) => (
                  <View key={sc.name} style={[s.row, i === d.logica!.scales.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                    <Text style={s.rowName}>{sc.name}</Text>
                    <Text style={s.rowVal}>{sc.label} · {sc.band}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <Text style={[s.h2, { marginTop: 10 }]}>In this report</Text>
        {d.contents.map((c) => (
          <View key={c.name} style={s.tocRow}>
            <Text style={s.tocName}>{c.name}</Text>
            <Text style={s.tocPage}>page {c.page}</Text>
          </View>
        ))}
        <Text style={[s.sub, { marginTop: 10 }]}>
          Each section is the full standalone report for that instrument, combined into one document for convenience.
          Individual per-service reports remain available from the portal.
        </Text>

        <Text style={s.footer} fixed>
          Assessment signals to combine with a structured interview and work evidence - not an automated decision.
          Persona is a self-report; Logica is an indicative developmental read unless norm-referenced. © VIFM.
        </Text>
      </Page>
    </Document>
  );
}

export type CombinedBuild =
  | { ok: true; buffer: Buffer; fileName: string; organizationId: string | null }
  | { ok: false; status: number; error: string };

/** Build the combined bundle report for a completed (or partial) sitting. */
export async function buildBundleCombinedReport(candidateId: string): Promise<CombinedBuild> {
  const svc = createServiceClient();
  const { data: cand } = await svc
    .from("bundle_candidates")
    .select("id, full_name, email, organization_id, bespoke_service_id, persona_session_id, cognitive_result_id, completed_at")
    .eq("id", candidateId)
    .maybeSingle<{
      id: string; full_name: string; email: string; organization_id: string | null;
      bespoke_service_id: string; persona_session_id: string | null; cognitive_result_id: string | null; completed_at: string | null;
    }>();
  if (!cand) return { ok: false, status: 404, error: "Candidate not found" };
  if (!cand.persona_session_id && !cand.cognitive_result_id) {
    return { ok: false, status: 400, error: "No completed sections yet for this candidate." };
  }

  const { data: bundle } = await svc
    .from("bespoke_services")
    .select("name_en, service_config")
    .eq("id", cand.bespoke_service_id)
    .maybeSingle<{ name_en: string; service_config: Record<string, unknown> | null }>();
  const bundleName = bundle?.name_en ?? "Bespoke Assessment";

  let orgName: string | null = null;
  if (cand.organization_id) {
    const { data: org } = await svc.from("organizations").select("name").eq("id", cand.organization_id).maybeSingle<{ name: string }>();
    orgName = org?.name ?? null;
  }

  // ── Render each section through its standalone builder ──
  const sections: { name: string; buffer: Buffer }[] = [];
  let personaCover: CoverData["persona"] = null;
  let logicaCover: CoverData["logica"] = null;

  if (cand.persona_session_id) {
    const persona = await buildPersonaPdfData(cand.persona_session_id, "en");
    if (persona.ok) {
      sections.push({ name: "Persona® Behavioural Profile", buffer: Buffer.from(await renderToBuffer(<PersonaProfilePdf data={persona.data} />)) });
    }
    const lead = await buildLeadershipPdfData(cand.persona_session_id);
    if (lead.ok) {
      sections.push({ name: "Persona® Leadership Report", buffer: Buffer.from(await renderToBuffer(<LeadershipReportPdf data={lead.data} />)) });
      personaCover = {
        overall: lead.data.overall,
        bandLabel: personaBand(lead.data.overall).label,
        styleLabel: lead.data.profile.styleLabel,
        leadership: lead.data.profile.leadership,
        management: lead.data.profile.management,
      };
    }
  }

  if (cand.cognitive_result_id) {
    const psy = await buildPsyReportData(cand.cognitive_result_id);
    if (psy.ok) {
      sections.push({ name: "Logica® Reasoning Report", buffer: Buffer.from(await renderToBuffer(<PsychometricReport data={psy.data} />)) });
      const cfg = (bundle?.service_config as { logica?: { subtests?: string[] } } | null)?.logica;
      const scoped = COGNITIVE_SUBTEST_KEYS.filter((k) => cfg?.subtests?.includes(k));
      const scopeLabel =
        scoped.length > 0 && scoped.length < COGNITIVE_SUBTEST_KEYS.length
          ? scoped.map((k) => COGNITIVE_SUBTESTS.find((x) => x.key === k)?.name_en ?? k).join(" · ")
          : "reasoning (full battery)";
      logicaCover = {
        scopeLabel,
        scales: psy.data.scales.map((sc) => ({ name: sc.name, label: sc.rawLabel, band: sc.bandLabel })),
        overall: psy.data.overall ? `${psy.data.overall.normalized}% · ${psy.data.overall.bandLabel}` : null,
      };
    }
  }

  if (sections.length === 0) return { ok: false, status: 400, error: "No sections could be rendered." };

  // ── Contents page numbers: cover is page 1; sections follow in order ──
  const counts = await Promise.all(sections.map(async (sec) => (await PDFDocument.load(sec.buffer)).getPageCount()));
  const contents: CoverData["contents"] = [];
  let pageNo = 2;
  sections.forEach((sec, i) => {
    contents.push({ name: sec.name, page: pageNo });
    pageNo += counts[i];
  });

  const coverBuf = Buffer.from(
    await renderToBuffer(
      <CombinedCover
        d={{
          bundleName,
          candidateName: cand.full_name,
          candidateEmail: cand.email,
          orgName,
          completedAt: cand.completed_at
            ? new Date(cand.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null,
          persona: personaCover,
          logica: logicaCover,
          contents,
        }}
      />
    )
  );

  // ── Merge: cover + sections ──
  const merged = await PDFDocument.create();
  for (const buf of [coverBuf, ...sections.map((x) => x.buffer)]) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  merged.setTitle(`${bundleName} - Combined Assessment Report - ${cand.full_name}`);
  const out = Buffer.from(await merged.save());

  const safe = cand.full_name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") || "Candidate";
  return { ok: true, buffer: out, fileName: `VIFM_Combined_Report_${safe}.pdf`, organizationId: cand.organization_id };
}
