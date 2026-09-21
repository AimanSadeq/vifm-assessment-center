"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { BackLink } from "@/components/shared/back-link";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import Link from "next/link";

type Props = {
  candidateId: string;
  /** Centre-specific facts a participant is consenting to (BPS 5.13, 5.8, 5.41.6). */
  pack: {
    published: boolean;
    acknowledged: boolean;
    reportRecipients: string | null;
    retentionMonths: number;
    researchUse: boolean;
  };
};

export function ConsentForm({ candidateId, pack }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const asAdmin = searchParams?.get("asAdmin") === "1";
  const [readConfirm, setReadConfirm] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [assessmentConsent, setAssessmentConsent] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  const [clientFormsAccepted, setClientFormsAccepted] = useState(false);
  // Centre-specific consents. Agreeing who receives the report is required
  // before attending (BPS 5.13); research use is separate and optional (5.8).
  const [recipientsConsent, setRecipientsConsent] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A participant who has not read the joining pack has not been given what
  // they need to consent (BPS 3.17, 5.39), so the form waits for them.
  const packOutstanding = pack.published && !pack.acknowledged;
  const canSubmit =
    readConfirm
    && dataConsent
    && assessmentConsent
    && (!pack.reportRecipients || recipientsConsent)
    && !packOutstanding;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/consent/${candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consents: [
            { consent_type: "read_confirmation", consented: readConfirm },
            { consent_type: "data_processing", consented: dataConsent },
            { consent_type: "assessment_participation", consented: assessmentConsent },
            { consent_type: "future_contact", consented: contactConsent },
            { consent_type: "client_forms", consented: clientFormsAccepted },
            { consent_type: "report_recipients", consented: recipientsConsent },
            { consent_type: "research_use", consented: researchConsent },
          ],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("candidateConsent.submitFail"));
        setSubmitting(false);
        return;
      }

      toast.success(t("candidateConsent.submitSuccess"));
      router.push(`/candidate/assessments/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`);
    } catch {
      setError(t("candidateConsent.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {asAdmin && (
        <ImpersonationBanner
          candidateName="this candidate"
          exitHref="/admin/engagements"
        />
      )}
      <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label={t("candidateConsent.backToWelcome")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("candidateConsent.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {packOutstanding && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">There is something to read first</p>
              <p className="mt-1">
                Before you agree, please read what this assessment is for, what you will be asked to do, who sees
                your results and how long they are kept.
              </p>
              <Link
                href={`/candidate/pack/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}
                className="mt-2 inline-block font-medium underline"
              >
                Read it now
              </Link>
            </div>
          )}
          <div className="rounded-md bg-muted p-4 text-sm space-y-3">
            <p className="font-semibold">{t("candidateConsent.noticeTitle")}</p>
            <p>{t("candidateConsent.noticeIntro")}</p>
            <p>{t("candidateConsent.noticeCollect")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("candidateConsent.collectItem1")}</li>
              <li>{t("candidateConsent.collectItem2")}</li>
              <li>{t("candidateConsent.collectItem3")}</li>
              <li>{t("candidateConsent.collectItem4")}</li>
              <li>{t("candidateConsent.collectItem5")}</li>
            </ul>
            <p>{t("candidateConsent.noticeRetention")}</p>
          </div>

          <Separator />

          <div className="space-y-4">
            {/* Required: Read confirmation */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="read-confirm"
                checked={readConfirm}
                onCheckedChange={(checked) => setReadConfirm(checked === true)}
              />
              <Label htmlFor="read-confirm" className="text-sm leading-relaxed">
                <span className="font-medium">{t("candidateConsent.readConfirm")}</span> *
              </Label>
            </div>

            {/* Required: Data processing */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="data-consent"
                checked={dataConsent}
                onCheckedChange={(checked) => setDataConsent(checked === true)}
              />
              <Label htmlFor="data-consent" className="text-sm leading-relaxed">
                {t("candidateConsent.dataConsent")} *
              </Label>
            </div>

            {/* Required: Assessment participation */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="assessment-consent"
                checked={assessmentConsent}
                onCheckedChange={(checked) => setAssessmentConsent(checked === true)}
              />
              <Label htmlFor="assessment-consent" className="text-sm leading-relaxed">
                {t("candidateConsent.assessmentConsent")} *
              </Label>
            </div>

            {pack.reportRecipients && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="recipients-consent"
                  checked={recipientsConsent}
                  onCheckedChange={(checked) => setRecipientsConsent(checked === true)}
                />
                <Label htmlFor="recipients-consent" className="text-sm leading-relaxed">
                  I agree that my report may be given to: {pack.reportRecipients} *
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Anyone else needs your express permission first. Your results are held for{" "}
                    {pack.retentionMonths} months and then deleted.
                  </span>
                </Label>
              </div>
            )}

            <Separator />
            <p className="text-xs text-muted-foreground">{t("candidateConsent.optional")}</p>

            {pack.researchUse && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="research-consent"
                  checked={researchConsent}
                  onCheckedChange={(checked) => setResearchConsent(checked === true)}
                />
                <Label htmlFor="research-consent" className="text-sm leading-relaxed text-muted-foreground">
                  My anonymised results may be used to check that the assessment works as it should. You can take
                  part without agreeing to this.
                </Label>
              </div>
            )}

            {/* Optional: Future contact */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="contact-consent"
                checked={contactConsent}
                onCheckedChange={(checked) => setContactConsent(checked === true)}
              />
              <Label htmlFor="contact-consent" className="text-sm leading-relaxed text-muted-foreground">
                {t("candidateConsent.contactConsent")}
              </Label>
            </div>

            {/* Optional: Client forms */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="client-forms"
                checked={clientFormsAccepted}
                onCheckedChange={(checked) => setClientFormsAccepted(checked === true)}
              />
              <Label htmlFor="client-forms" className="text-sm leading-relaxed text-muted-foreground">
                {t("candidateConsent.clientForms")}
              </Label>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? t("candidateConsent.submitting") : t("candidateConsent.agreeProceed")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
