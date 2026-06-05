"use server";

import { createAraAssessment } from "@/lib/ara/actions";

/**
 * Thin form-action wrappers for the Guided Start wizard. Each just forwards to
 * the module's own create action (no duplicated logic) and returns void so it
 * satisfies the native `<form action>` type. The wrapped action redirects into
 * the created entity, so control never returns here on success.
 */
export async function startAraAssessmentAction(formData: FormData): Promise<void> {
  await createAraAssessment(formData);
}
