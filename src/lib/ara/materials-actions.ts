"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner } from "@/lib/ara/auth-guards";
import { respondentWriteLockError } from "@/lib/ara/respondent-access";
import type { AraMaterialType, AraRespondent } from "@/types/ara";

// ─────────────────────────────────────────────────────────────
// The Supabase Storage bucket used for supporting materials.
// Must be created once in the Supabase dashboard (Storage → New bucket).
// Name it exactly "ara-materials". Private bucket is fine - server
// generates signed URLs when consultants download.
// ─────────────────────────────────────────────────────────────
const BUCKET = "ara-materials";

async function requireRespondent(token: string): Promise<AraRespondent> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("ara_respondents")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<AraRespondent>();
  if (!data) throw new Error("Invalid access token");
  return data;
}

// ─────────────────────────────────────────────────────────────
// Add a URL-type supporting material (no file upload)
// ─────────────────────────────────────────────────────────────
const addUrlSchema = z.object({
  token: z.string().min(1),
  material_name: z.string().min(2).max(200),
  link_url: z.string().url("Must be a valid URL starting with http:// or https://"),
});

export async function addAraMaterialUrl(
  input: z.infer<typeof addUrlSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = addUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const respondent = await requireRespondent(parsed.data.token);
  const sb = createServiceClient();

  // Same write lock as answers: no collateral edits after submission or on a
  // frozen/archived assessment.
  const lockError = await respondentWriteLockError(respondent);
  if (lockError) return { ok: false, error: lockError };

  const { error } = await sb.from("ara_supporting_materials").insert({
    assessment_id: respondent.assessment_id,
    respondent_id: respondent.id,
    material_type: "url",
    material_name: parsed.data.material_name,
    link_url: parsed.data.link_url,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/respond/${parsed.data.token}`);
  revalidatePath(`/ara/consultant/assessments/${respondent.assessment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Add a file-type supporting material (Word / PDF / PowerPoint)
// ─────────────────────────────────────────────────────────────
const FILE_EXT_MAP: Record<Exclude<AraMaterialType, "url">, string[]> = {
  word: ["doc", "docx"],
  pdf: ["pdf"],
  powerpoint: ["ppt", "pptx"],
};

function materialTypeFromFileName(name: string): AraMaterialType | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  for (const [type, exts] of Object.entries(FILE_EXT_MAP)) {
    if (exts.includes(ext)) return type as AraMaterialType;
  }
  return null;
}

export async function addAraMaterialFile(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = String(formData.get("token") ?? "");
  const materialName = String(formData.get("material_name") ?? "").trim();
  const declaredType = String(formData.get("material_type") ?? "") as AraMaterialType;
  const file = formData.get("file");

  if (!token) return { ok: false, error: "Missing token" };
  if (materialName.length < 2) return { ok: false, error: "Material name must be at least 2 characters" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please choose a file" };

  // Validate extension matches declared type
  const detected = materialTypeFromFileName(file.name);
  if (!detected) return { ok: false, error: "Unsupported file type" };
  if (detected !== declaredType) {
    return { ok: false, error: `File extension does not match selected material type (${declaredType})` };
  }

  const respondent = await requireRespondent(token);
  const sb = createServiceClient();

  const lockError = await respondentWriteLockError(respondent);
  if (lockError) return { ok: false, error: lockError };

  // Path: <assessment>/<respondent>/<timestamp>-<filename>
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${respondent.assessment_id}/${respondent.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) {
    return {
      ok: false,
      error:
        uploadError.message.includes("not found") || uploadError.message.includes("bucket")
          ? `Storage bucket "${BUCKET}" not found. Create it once in Supabase Storage → New bucket (private).`
          : uploadError.message,
    };
  }

  const { error: insertError } = await sb.from("ara_supporting_materials").insert({
    assessment_id: respondent.assessment_id,
    respondent_id: respondent.id,
    material_type: detected,
    material_name: materialName,
    file_name: file.name,
    file_size_bytes: file.size,
    file_url: path, // store internal path; we sign it at download time
  });
  if (insertError) {
    // Best-effort cleanup of the uploaded blob since the row failed
    await sb.storage.from(BUCKET).remove([path]);
    return { ok: false, error: insertError.message };
  }

  revalidatePath(`/ara/respond/${token}`);
  revalidatePath(`/ara/consultant/assessments/${respondent.assessment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Remove a material (also deletes underlying storage object for files)
// ─────────────────────────────────────────────────────────────
export async function removeAraMaterial(
  materialId: string,
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const respondent = await requireRespondent(token);
  const sb = createServiceClient();

  const lockError = await respondentWriteLockError(respondent);
  if (lockError) return { ok: false, error: lockError };

  const { data: material } = await sb
    .from("ara_supporting_materials")
    .select("id, assessment_id, file_url, material_type, respondent_id")
    .eq("id", materialId)
    .maybeSingle<{
      id: string;
      assessment_id: string;
      file_url: string | null;
      material_type: AraMaterialType;
      respondent_id: string | null;
    }>();

  // Respondents can only remove materials THEY uploaded on THEIR OWN
  // assessment. A consultant-added row (respondent_id null) is never
  // respondent-deletable, and the tenancy check stops a token from one
  // assessment deleting rows on another - previously any valid token could
  // delete any consultant-added material platform-wide.
  if (!material || material.assessment_id !== respondent.assessment_id) {
    return { ok: false, error: "Material not found" };
  }
  if (!material.respondent_id || material.respondent_id !== respondent.id) {
    return { ok: false, error: "Not permitted" };
  }

  if (material.material_type !== "url" && material.file_url) {
    await sb.storage.from(BUCKET).remove([material.file_url]);
  }

  const { error } = await sb
    .from("ara_supporting_materials")
    .delete()
    .eq("id", materialId)
    .eq("respondent_id", respondent.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/respond/${token}`);
  revalidatePath(`/ara/consultant/assessments/${respondent.assessment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Consultant-facing: generate a signed download URL for a stored file.
// Requires the caller to own (or be admin of) the assessment that the
// file belongs to. Without this check the service-role client would
// happily sign URLs for any file path in the bucket.
// ─────────────────────────────────────────────────────────────
export async function signMaterialDownloadUrl(
  filePath: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const sb = createServiceClient();

  // Look up the material row by file_url and confirm the caller can
  // act on its assessment. If no row matches, the path is either
  // invalid or belongs to another tenant - deny in both cases.
  const { data: material } = await sb
    .from("ara_supporting_materials")
    .select("id, assessment_id")
    .eq("file_url", filePath)
    .maybeSingle<{ id: string; assessment_id: string }>();
  if (!material) return null;

  try {
    await requireAssessmentOwner(material.assessment_id);
  } catch {
    return null;
  }

  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
