"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCourseQuoteRequest } from "@/lib/courses/quote-request-actions";

type Props = {
  courseId: string;
  courseTitle: string;
  /** Course's supported languages, e.g. ['en', 'ar']. Drives which
   *  preferred-language options the form offers. */
  courseLanguages: string[];
  /** Course's supported delivery modes, e.g. ['in_person', 'virtual', 'hybrid']. */
  courseDeliveryModes: string[];
  /** Optional engagement-context fields. Sent as hidden inputs and
   *  consumed by submitCourseQuoteRequest to set the engagement_type
   *  discriminator + FK columns on the request row. */
  engagementType?: "direct" | "ac" | "ara" | "reflect";
  reflectEngagementId?: string;
  reflectParticipantId?: string;
  /** Optional prefill values when launching from a diagnostic report. */
  prefillName?: string;
  prefillEmail?: string;
  prefillCompany?: string;
};

/**
 * Quote-request form. Anonymous submission allowed (no auth needed) -
 * the server action validates input and persists to
 * vifm_course_quote_requests with review_status='new'.
 *
 * Three render states:
 *  - "form"    : empty form, ready for input
 *  - "loading" : submitting (button disabled, spinner shown)
 *  - "success" : confirmation panel with reset button
 *  - "error"   : red banner above the form, form remains editable
 */
export function QuoteRequestForm({
  courseId,
  courseTitle,
  courseLanguages,
  courseDeliveryModes,
  engagementType,
  reflectEngagementId,
  reflectParticipantId,
  prefillName,
  prefillEmail,
  prefillCompany,
}: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<"form" | "success">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("course_id", courseId);
    if (engagementType) formData.set("engagement_type", engagementType);
    if (reflectEngagementId) formData.set("reflect_engagement_id", reflectEngagementId);
    if (reflectParticipantId) formData.set("reflect_participant_id", reflectParticipantId);
    startTransition(async () => {
      const result = await submitCourseQuoteRequest(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("success");
    });
  }

  if (state === "success") {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-xl font-semibold text-emerald-950">{t("coursesPublic.successHeading")}</h2>
            <p className="text-sm text-emerald-900 mt-1">
              {t("coursesPublic.successBody", { course: courseTitle })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-50 transition-colors"
          >
            {t("coursesPublic.backToCatalogue")}
          </Link>
          <button
            type="button"
            onClick={() => setState("form")}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-emerald-700 hover:underline"
          >
            {t("coursesPublic.submitAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="rounded-lg border bg-card p-6 sm:p-8 space-y-6">
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <Section title={t("coursesPublic.sectionYourDetails")}>
        <Field label={t("coursesPublic.fieldFullName")} name="requester_name" required defaultValue={prefillName} />
        <Field label={t("coursesPublic.fieldWorkEmail")} name="requester_email" type="email" required defaultValue={prefillEmail} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("coursesPublic.fieldCompany")} name="requester_company" required defaultValue={prefillCompany} />
          <Field label={t("coursesPublic.fieldYourRole")} name="requester_role" placeholder={t("coursesPublic.fieldYourRolePlaceholder")} />
        </div>
        <Field label={t("coursesPublic.fieldPhone")} name="requester_phone" type="tel" placeholder={t("coursesPublic.fieldPhonePlaceholder")} />
      </Section>

      <Section title={t("coursesPublic.sectionProgrammeDetails")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("coursesPublic.fieldGroupSize")} name="estimated_group_size" type="number" min={1} placeholder={t("coursesPublic.fieldGroupSizePlaceholder")} />
          <Field label={t("coursesPublic.fieldStartDate")} name="preferred_start_date" type="date" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={t("coursesPublic.fieldPreferredLanguage")}
            name="preferred_language"
            options={[
              { value: "", label: t("coursesPublic.optNoPreference") },
              ...(courseLanguages.includes("en") ? [{ value: "en", label: t("coursesPublic.optEnglish") }] : []),
              ...(courseLanguages.includes("ar") ? [{ value: "ar", label: t("coursesPublic.optArabic") }] : []),
              ...(courseLanguages.length >= 2 ? [{ value: "bilingual", label: t("coursesPublic.optBilingual") }] : []),
            ]}
          />
          <SelectField
            label={t("coursesPublic.fieldDeliveryPreference")}
            name="delivery_mode"
            options={[
              { value: "", label: t("coursesPublic.optNoPreference") },
              ...(courseDeliveryModes.includes("in_person") ? [{ value: "in_person", label: t("coursesPublic.optInPerson") }] : []),
              ...(courseDeliveryModes.includes("virtual") ? [{ value: "virtual", label: t("coursesPublic.optVirtual") }] : []),
              ...(courseDeliveryModes.includes("hybrid") ? [{ value: "hybrid", label: t("coursesPublic.optHybrid") }] : []),
            ]}
          />
        </div>
        <div>
          <Label htmlFor="notes" className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {t("coursesPublic.fieldNotes")}
          </Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder={t("coursesPublic.fieldNotesPlaceholder")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-[11px] text-muted-foreground">
          {t("coursesPublic.consentNote")}
        </p>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
          {pending ? t("coursesPublic.sending") : t("coursesPublic.sendQuoteRequest")}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, name, type = "text", placeholder, required, min, defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-xs">
        {label}
        {required && <span className="text-rose-700 ms-1">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        defaultValue={defaultValue}
        className="mt-1"
      />
    </div>
  );
}

function SelectField({
  label, name, options,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <select
        id={name}
        name={name}
        className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
