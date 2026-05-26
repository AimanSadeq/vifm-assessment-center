"use client";

import { UpskillingPathwayView } from "@/components/shared/upskilling-pathway-view";

/**
 * ARA assessment Upskilling Pathway - thin wrapper over the shared view,
 * pointed at the ARA generation endpoint. Consultant-facing (English).
 */
export function AraPathwayCard({ assessmentId }: { assessmentId: string }) {
  return (
    <UpskillingPathwayView
      lang="en"
      endpoint="/api/ara/pathway"
      body={{ assessmentId, language: "en" }}
    />
  );
}
