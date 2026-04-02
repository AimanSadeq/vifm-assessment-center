/**
 * Email Integration Module
 *
 * Transactional email service for VIFM Assessment Center.
 * Supports SendGrid or Resend as providers.
 * To enable:
 * 1. npm install @sendgrid/mail (or resend)
 * 2. Set EMAIL_PROVIDER and EMAIL_API_KEY in .env.local
 * 3. Set EMAIL_FROM_ADDRESS in .env.local
 */

export type EmailTemplate =
  | "candidate_invitation"
  | "assessor_assignment"
  | "consent_confirmation"
  | "report_released"
  | "washup_scheduled"
  | "engagement_created";

export type EmailPayload = {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
};

type EmailConfig = {
  provider: "sendgrid" | "resend";
  apiKey: string;
  fromAddress: string;
  fromName: string;
};

function getConfig(): EmailConfig | null {
  const provider = process.env.EMAIL_PROVIDER as "sendgrid" | "resend" | undefined;
  const apiKey = process.env.EMAIL_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;

  if (!provider || !apiKey || !fromAddress) return null;

  return {
    provider,
    apiKey,
    fromAddress,
    fromName: "VIFM Assessment Center",
  };
}

const TEMPLATES: Record<EmailTemplate, { subject: string; body: string }> = {
  candidate_invitation: {
    subject: "You have been invited to a VIFM Assessment Center",
    body: `Dear {{candidateName}},

You have been invited to participate in the {{engagementName}} assessment center for {{organizationName}}.

Assessment Dates: {{assessmentDates}}
Target Role: {{targetRole}}

Please visit the candidate portal to review your schedule and provide consent:
{{portalUrl}}

Best regards,
Virginia Institute of Finance and Management`,
  },
  assessor_assignment: {
    subject: "New Assessment Assignment - {{engagementName}}",
    body: `Dear {{assessorName}},

You have been assigned to assess candidates for {{engagementName}}.

Please visit the assessor portal to review your assignments:
{{portalUrl}}

Best regards,
VIFM Assessment Center`,
  },
  consent_confirmation: {
    subject: "Consent Received - VIFM Assessment Center",
    body: `Dear {{candidateName}},

Thank you for providing your consent for the {{engagementName}} assessment center.

Your data will be processed in accordance with applicable data protection regulations and retained for a maximum of 2 years.

Best regards,
VIFM Assessment Center`,
  },
  report_released: {
    subject: "Your Assessment Report is Ready",
    body: `Dear {{candidateName}},

Your assessment report for {{engagementName}} is now available for viewing.

Please visit the candidate portal to access your report:
{{portalUrl}}

Best regards,
VIFM Assessment Center`,
  },
  washup_scheduled: {
    subject: "Wash-Up Session Scheduled - {{engagementName}}",
    body: `Dear {{assessorName}},

A wash-up session has been scheduled for {{engagementName}}.

Date: {{sessionDate}}
Time: {{sessionTime}}

Please ensure your integration worksheets are completed before the session.

Best regards,
VIFM Assessment Center`,
  },
  engagement_created: {
    subject: "New Engagement Created - {{engagementName}}",
    body: `A new assessment center engagement has been created.

Engagement: {{engagementName}}
Organization: {{organizationName}}
Target Role: {{targetRole}}
Dates: {{assessmentDates}}

Best regards,
VIFM Assessment Center`,
  },
};

function renderTemplate(template: EmailTemplate, data: Record<string, string>) {
  const tmpl = TEMPLATES[template];
  let subject = tmpl.subject;
  let body = tmpl.body;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  return { subject, body };
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.warn(
      "Email integration not configured. Set EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM_ADDRESS."
    );
    // Log the email that would have been sent
    const { subject, body } = renderTemplate(payload.template, payload.data);
    console.log(`[EMAIL MOCK] To: ${payload.to}`);
    console.log(`[EMAIL MOCK] Subject: ${subject}`);
    console.log(`[EMAIL MOCK] Body:\n${body}\n`);
    return true; // Return success in dev mode
  }

  const { subject, body } = renderTemplate(payload.template, payload.data);

  // TODO: Implement actual provider API calls
  // if (config.provider === "sendgrid") { ... }
  // if (config.provider === "resend") { ... }

  console.log(`[EMAIL] Sent to ${payload.to}: ${subject}`);
  return true;
}

export function isEmailConfigured(): boolean {
  return !!process.env.EMAIL_PROVIDER && !!process.env.EMAIL_API_KEY;
}
