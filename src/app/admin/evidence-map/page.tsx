import { gatherEvidenceMetrics } from "@/lib/evidence-map/metrics";
import { buildMatrix, matrixTotals } from "@/lib/evidence-map/matrix";
import { EvidenceMapClient } from "./_components/evidence-map-client";

export const dynamic = "force-dynamic";

/**
 * Evidence & Validity Map (admin).
 *
 * One tool, two views:
 *  - Dashboard: live data counts per instrument that move as the DB fills.
 *  - Coverage matrix: what scientific/psychometric documentation exists
 *    vs is missing, per instrument × validity/reliability category.
 *
 * Covers AC · ARC (org + individual) · Fluent · Technical · Reflect 360 ·
 * Psychometrics. Metrics are gathered server-side with the service-role
 * client; the matrix mixes curated judgements with live-computed cells.
 */
export default async function EvidenceMapPage() {
  const metrics = await gatherEvidenceMetrics();
  const matrix = buildMatrix(metrics);
  const totals = matrixTotals(matrix);

  return <EvidenceMapClient metrics={metrics} matrix={matrix} totals={totals} />;
}
