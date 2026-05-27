"use client";
// TODO: Next.js 15 migration - wrap in a server component that passes candidateId as a prop
// instead of accessing params directly in a client component

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

type Props = { params: { candidateId: string } };

export default function ConsentPage({ params }: Props) {
  const { candidateId } = params;
  const router = useRouter();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const asAdmin = searchParams?.get("asAdmin") === "1";
  const [readConfirm, setReadConfirm] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [assessmentConsent, setAssessmentConsent] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  const [clientFormsAccepted, setClientFormsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = readConfirm && dataConsent && assessmentConsent;

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

            <Separator />
            <p className="text-xs text-muted-foreground">{t("candidateConsent.optional")}</p>

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
