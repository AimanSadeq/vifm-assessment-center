/**
 * Email Integration Module - Microsoft Graph API (Outlook/M365)
 *
 * Sends transactional emails via Microsoft Graph API using Azure AD app credentials.
 *
 * Required environment variables (either naming convention works; OUTLOOK_*
 * takes precedence so the existing Render production env stays the source of
 * truth):
 *   OUTLOOK_TENANT_ID     or AZURE_TENANT_ID     - Azure AD tenant ID
 *   OUTLOOK_CLIENT_ID     or AZURE_CLIENT_ID     - App registration client ID
 *   OUTLOOK_CLIENT_SECRET or AZURE_CLIENT_SECRET - App registration client secret
 *   OUTLOOK_SENDER_EMAIL  or EMAIL_FROM_ADDRESS  - Sender email (must be a valid M365 mailbox)
 */

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { resendConfigured, sendViaResend } from "./resend";

const graphTenantId = () => process.env.OUTLOOK_TENANT_ID ?? process.env.AZURE_TENANT_ID;
const graphClientId = () => process.env.OUTLOOK_CLIENT_ID ?? process.env.AZURE_CLIENT_ID;
const graphClientSecret = () => process.env.OUTLOOK_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET;
const graphFromAddress = () => process.env.OUTLOOK_SENDER_EMAIL ?? process.env.EMAIL_FROM_ADDRESS;

export type EmailTemplate =
  | "candidate_invitation"
  | "assessor_assignment"
  | "consent_confirmation"
  | "report_released"
  | "washup_scheduled"
  | "engagement_created"
  | "course_quote_request"
  | "fluent_result"
  | "prehire_invitation"
  | "prehire_client_report"
  | "role_readiness_invitation";

/** Optional file attachment (e.g. a generated PDF report). */
export type EmailAttachment = {
  filename: string;
  /** Base64-encoded file contents. */
  contentBase64: string;
  contentType?: string;
};

export type EmailPayload = {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
  attachments?: EmailAttachment[];
};

function getGraphClient(): Client | null {
  const tenantId = graphTenantId();
  const clientId = graphClientId();
  const clientSecret = graphClientSecret();

  if (!tenantId || !clientId || !clientSecret) return null;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
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
  course_quote_request: {
    subject: "New quote request - {{courseTitle}}",
    body: `A new course quote request has come in from the public catalogue.

Course:    {{courseTitle}}{{courseCode}}
Requester: {{requesterName}} <{{requesterEmail}}>
Company:   {{requesterCompany}}
Group size: {{groupSize}}
Preferred start: {{preferredStart}}
Delivery: {{deliveryMode}}
Language: {{preferredLanguage}}

Notes:
{{notes}}

Manage this request: {{adminUrl}}

- VIFM Assessment Platform`,
  },
  prehire_invitation: {
    subject: "You're invited to apply: {{roleTitle}}",
    body: `Dear {{candidateName}},

You've been invited to complete a short pre-employment screening for the {{roleTitle}} role{{orgClause}}.

It takes about {{duration}} and may include a brief competency check, an English placement, and a short behavioural interview. Your answers are saved as you go - you can pause and resume using the same link.

Start your screening here (please don't share this link, it's unique to you):
{{applyUrl}}

Your responses are processed by VIFM on behalf of {{orgName}} for the sole purpose of evaluating your application, in line with applicable data-protection law. A person reviews the results - no decision is made automatically.

Best regards,
Virginia Institute of Finance and Management`,
  },
  prehire_client_report: {
    subject: "Pre-Hire® screening report - {{candidateName}} ({{roleTitle}})",
    body: `Dear {{clientName}},

Please find attached the pre-hire screening report for {{candidateName}}{{empClause}}, who completed the screening for the {{roleTitle}} role.

The report summarises the advisory composite and the per-stage results. As always, this is a screening signal to support your process - VIFM does not make the hiring decision; your team does.

Please treat the attached report as confidential.

Best regards,
Virginia Institute of Finance and Management`,
  },
  role_readiness_invitation: {
    subject: "Your VIFM Role Readiness assessment: {{roleName}}",
    body: `Dear {{candidateName}},

You've been invited to complete the {{roleName}} readiness assessment.

It takes one sitting and covers two short sections. Start here (this link is unique to you):
{{redeemUrl}}

If the link doesn't open, copy and paste it into your browser.

Best regards,
Virginia Institute of Finance and Management`,
  },
  fluent_result: {
    subject: "Your Fluent® result - {{level}}",
    body: `Dear {{takerName}},

Thank you for completing the Fluent English placement test.

Your indicative CEFR level: {{level}} ({{levelLabel}})
  Reading: {{reading}}    Listening: {{listening}}
  Writing: {{writing}}    Speaking: {{speaking}}

View and download your certificate:
{{certUrl}}

This is an indicative placement for development purposes - not a certified high-stakes language qualification.

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
  const { subject, body } = renderTemplate(payload.template, payload.data);

  // Resend is the live production transport (RESEND_API_KEY + EMAIL_FROM on
  // Render, viftraining.com verified). Prefer it over Graph, mirroring
  // src/lib/ara/email.ts. Without this, an unconfigured Graph silently
  // console-mocks and returns true, so the caller's "emailed" gate sees a
  // success that never reached the recipient (the CAL-PRE-507 client-report bug,
  // and the same defect on prehire invitations + AC Fluent results).
  if (resendConfigured()) {
    const res = await sendViaResend({
      to: payload.to,
      subject,
      text: body,
      attachments: (payload.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
      })),
    });
    if (!res.ok) console.error(`[EMAIL] Resend failed to ${payload.to}: ${res.error}`);
    else console.log(`[EMAIL] Sent via Resend to ${payload.to}: ${subject}`);
    return res.ok;
  }

  const fromAddress = graphFromAddress();

  const graphClient = getGraphClient();

  if (!graphClient || !fromAddress) {
    console.warn("Email integration not configured. Set OUTLOOK_TENANT_ID / OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET / OUTLOOK_SENDER_EMAIL (or the AZURE_*/EMAIL_FROM_ADDRESS equivalents).");
    console.log(`[EMAIL MOCK] To: ${payload.to}`);
    console.log(`[EMAIL MOCK] Subject: ${subject}`);
    console.log(`[EMAIL MOCK] Body:\n${body}\n`);
    for (const a of payload.attachments ?? []) {
      console.log(`[EMAIL MOCK] Attachment: ${a.filename} (${a.contentType ?? "application/pdf"}, ${Math.round((a.contentBase64.length * 3) / 4 / 1024)} KB)`);
    }
    return true;
  }

  try {
    const attachments = (payload.attachments ?? []).map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.contentType ?? "application/pdf",
      contentBytes: a.contentBase64,
    }));

    await graphClient.api(`/users/${fromAddress}/sendMail`).post({
      message: {
        subject,
        body: {
          contentType: "Text",
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: payload.to,
            },
          },
        ],
        ...(attachments.length > 0 ? { attachments } : {}),
      },
      saveToSentItems: true,
    });

    console.log(`[EMAIL] Sent to ${payload.to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${payload.to}:`, error);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  // Resend is the live transport; Graph is the legacy fallback. Either counts as
  // configured so callers' "emailed" gating reflects a real send path.
  return (
    resendConfigured() ||
    !!(graphTenantId() && graphClientId() && graphClientSecret() && graphFromAddress())
  );
}
