"use client";

import { UpskillingPathwayView } from "@/components/shared/upskilling-pathway-view";

/**
 * AC candidate Upskilling Pathway - thin wrapper over the shared view,
 * pointed at the candidate generation endpoint.
 */
export function PathwayClient({
  candidateId,
  lang,
}: {
  candidateId: string;
  lang: "en" | "ar";
  candidateName: string;
}) {
  return (
    <UpskillingPathwayView
      lang={lang}
      endpoint="/api/ac/pathway"
      body={{ candidateId, language: lang }}
    />
  );
}
