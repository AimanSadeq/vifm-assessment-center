/**
 * Email Integration Module — Microsoft Graph API (Outlook/M365)
 *
 * Sends transactional emails via Microsoft Graph API using Azure AD app credentials.
 *
 * Required environment variables:
 *   AZURE_TENANT_ID     — Azure AD tenant ID
 *   AZURE_CLIENT_ID     — App registration client ID
 *   AZURE_CLIENT_SECRET — App registration client secret
 *   EMAIL_FROM_ADDRESS  — Sender email (must be a valid M365 mailbox)
 */

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

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

function getGraphClient(): Client | null {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

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
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;

  const graphClient = getGraphClient();

  if (!graphClient || !fromAddress) {
    console.warn("Email integration not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, EMAIL_FROM_ADDRESS.");
    console.log(`[EMAIL MOCK] To: ${payload.to}`);
    console.log(`[EMAIL MOCK] Subject: ${subject}`);
    console.log(`[EMAIL MOCK] Body:\n${body}\n`);
    return true;
  }

  try {
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
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.EMAIL_FROM_ADDRESS
  );
}
