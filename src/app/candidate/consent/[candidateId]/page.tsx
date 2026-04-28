"use client";
// TODO: Next.js 15 migration - wrap in a server component that passes candidateId as a prop
// instead of accessing params directly in a client component

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
        setError(data.error ?? "Failed to submit consent");
        setSubmitting(false);
        return;
      }

      toast.success("Consent submitted successfully");
      router.push(`/candidate/assessments/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`);
    } catch {
      setError("Network error. Please try again.");
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
      <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label="Back to Welcome" />
      <Card>
        <CardHeader>
          <CardTitle>Consent & Data Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-muted p-4 text-sm space-y-3">
            <p className="font-semibold">Data Processing Notice</p>
            <p>
              In accordance with the UAE Federal Decree-Law No. 45 of 2021 on
              Personal Data Protection, the Saudi Arabia Personal Data Protection
              Law (PDPL), and the EU General Data Protection Regulation (GDPR),
              we are required to obtain your explicit consent before collecting
              and processing your personal data.
            </p>
            <p>
              Virginia Institute of Finance and Management (VIFM) will collect
              and process the following data during the assessment:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Personal identification information (name, email)</li>
              <li>Behavioral observations during assessment exercises</li>
              <li>Competency ratings and assessment scores</li>
              <li>Audio/video recordings (if applicable for virtual sessions)</li>
              <li>Assessment reports and development recommendations</li>
            </ul>
            <p>
              Your data will be retained for a maximum of 2 years from the
              assessment date unless otherwise agreed contractually. You have the
              right to access, correct, or request deletion of your data at any
              time.
            </p>
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
                <span className="font-medium">I confirm I have read and understood the notice above.</span> *
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
                I consent to the collection and processing of my personal data as
                described above for the purpose of the assessment center
                evaluation. I understand my rights under applicable data
                protection laws. *
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
                I voluntarily agree to participate in the assessment center and
                understand that the results will be shared with the sponsoring
                organization for the purpose of talent evaluation and
                development. *
              </Label>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">Optional</p>

            {/* Optional: Future contact */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="contact-consent"
                checked={contactConsent}
                onCheckedChange={(checked) => setContactConsent(checked === true)}
              />
              <Label htmlFor="contact-consent" className="text-sm leading-relaxed text-muted-foreground">
                I agree that VIFM can contact me, including by email, in order to
                participate in future test trials, surveys, and to provide further
                information relating to the assessment.
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
                I agree to complete any additional forms provided by the sponsoring
                organization before the start of the assessment (e.g., application
                forms, surveys).
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
            {submitting ? "Submitting..." : "I Agree - Proceed to Assessment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
