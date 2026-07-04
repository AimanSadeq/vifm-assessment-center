/**
 * ARA email integration.
 *
 * Wraps the Microsoft Graph sender from src/lib/integrations/email.ts with
 * ARA-specific bilingual templates and the sandbox-redirect rule from
 * CLAUDE.md (M2.1 deferred items list).
 *
 * Two templates today:
 *   - ara_respondent_invitation (M2.1) - bilingual welcome with the
 *     access-token URL, sent by a consultant to a freshly-created
 *     respondent.
 *   - ara_consultant_completion (M3.3) - quiet notification fired when
 *     a respondent marks themselves complete.
 *
 * Sandbox behaviour: when the source assessment has is_sandbox=true,
 * mail is redirected to SANDBOX_EMAIL_REDIRECT (e.g. a shared mailbox
 * for QA). This prevents test runs from spamming real users while still
 * exercising the Graph send path.
 *
 * Every send writes a row to ara_email_log with respondent_id,
 * assessment_id, email_type, recipient_email, language, and the
 * is_sandbox_redirect flag - all four fields exist in migration 00007.
 */

import { ClientSecretCredential } from "@azure/identity";
import { resendConfigured, sendViaResend, type EmailAttachment } from "@/lib/integrations/resend";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { createServiceClient } from "@/lib/supabase/server";

export type AraEmailType =
  | "ara_respondent_invitation"
  | "ara_consultant_completion"
  | "ara_personal_results_link"
  | "ara_personal_results_to_client";
export type AraEmailLanguage = "en" | "ar" | "bilingual";

type RenderedEmail = {
  subject: string;
  body: string;
  contentType: "Text" | "HTML";
};

type TemplateRenderer = (data: Record<string, string>) => RenderedEmail;

const TEMPLATES: Record<AraEmailType, Record<AraEmailLanguage, TemplateRenderer>> = {
  ara_respondent_invitation: {
    en: (d) => ({
      contentType: "Text",
      subject: `You've been invited to the ${d.assessmentName} AI Readiness Compass®`,
      body: `Hello ${d.respondentName},

${d.consultantName ? `${d.consultantName} has invited you` : "You have been invited"} to participate in the AI Readiness Compass for ${d.organizationName}: ${d.assessmentName}.

Your secure response link (do not share):
${d.respondentUrl}

The assessment takes 20–30 minutes. Your answers are saved automatically as you go, and you can pause and resume at any time using the same link.

If you have questions, please reply to this email.

Best regards,
Virginia Institute of Finance and Management`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `دعوة للمشاركة في بوصلة الجاهزية للذكاء الاصطناعي - ${d.assessmentName}`,
      body: `مرحبًا ${d.respondentName}،

${d.consultantName ? `${d.consultantName} قام بدعوتك` : "تمت دعوتك"} للمشاركة في بوصلة الجاهزية للذكاء الاصطناعي لـ ${d.organizationName}: ${d.assessmentName}.

رابطك الآمن للإجابة (يُرجى عدم مشاركته):
${d.respondentUrl}

يستغرق التقييم من 20 إلى 30 دقيقة. تُحفظ إجاباتك تلقائيًا، ويمكنك إيقاف التقييم واستئنافه في أي وقت من خلال الرابط نفسه.

إذا كانت لديك أي استفسارات، يرجى الرد على هذه الرسالة.

مع أطيب التحيات،
معهد فرجينيا للتمويل والإدارة`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `${d.assessmentName} - AI Readiness Compass® / بوصلة الجاهزية للذكاء الاصطناعي`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
        <p>Hello ${d.respondentName},</p>
        <p>${d.consultantName ? `${d.consultantName} has invited you` : "You have been invited"} to participate in the AI Readiness Compass for <strong>${d.organizationName}</strong>: ${d.assessmentName}.</p>
        <p><a href="${d.respondentUrl}" style="color:#5391D5;">Open your secure response link</a> (do not share).</p>
        <p>The assessment takes 20–30 minutes. Answers save automatically; you can pause and resume.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <div dir="rtl" style="text-align:right;">
          <p>مرحبًا ${d.respondentName}،</p>
          <p>${d.consultantName ? `${d.consultantName} قام بدعوتك` : "تمت دعوتك"} للمشاركة في بوصلة الجاهزية للذكاء الاصطناعي لـ <strong>${d.organizationName}</strong>: ${d.assessmentName}.</p>
          <p><a href="${d.respondentUrl}" style="color:#5391D5;">افتح رابطك الآمن للإجابة</a> (يُرجى عدم مشاركته).</p>
          <p>يستغرق التقييم من 20 إلى 30 دقيقة. تُحفظ إجاباتك تلقائيًا، ويمكنك إيقاف التقييم واستئنافه في أي وقت.</p>
        </div>
      </div>`,
    }),
  },

  ara_consultant_completion: {
    en: (d) => ({
      contentType: "Text",
      subject: `Respondent completed: ${d.respondentName} - ${d.assessmentName}`,
      body: `Hi ${d.consultantName},

${d.respondentName} has marked their responses complete for ${d.assessmentName} (${d.organizationName}).

Open the assessment dashboard:
${d.assessmentUrl}

Status snapshot:
  Completed: ${d.completedCount} of ${d.totalCount}

- VIFM ARC®`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `إكمال المستجيب: ${d.respondentName} - ${d.assessmentName}`,
      body: `مرحبًا ${d.consultantName}،

أكمل ${d.respondentName} الردود الخاصة بـ ${d.assessmentName} (${d.organizationName}).

افتح لوحة التقييم:
${d.assessmentUrl}

ملخص الحالة:
  المُكتمل: ${d.completedCount} من ${d.totalCount}

- VIFM ARC®`,
    }),
    bilingual: (d) => ({
      contentType: "Text",
      subject: `Respondent completed / إكمال المستجيب - ${d.assessmentName}`,
      body: `${d.respondentName} marked complete for ${d.assessmentName} (${d.completedCount}/${d.totalCount}).

Dashboard: ${d.assessmentUrl}`,
    }),
  },

  // Sent to a person who just finished their Personal AI Readiness
  // Snapshot. Carries the bookmarkable results URL plus the PDF
  // download URL so they can open either from any device. No
  // marketing copy - keep it minimal and respectful.
  ara_personal_results_link: {
    en: (d) => ({
      contentType: "Text",
      subject: `Your VIFM Personal AI Readiness Snapshot is ready`,
      body: `Hello ${d.respondentName},

Thank you for completing the VIFM Personal AI Readiness Snapshot.

Your results page (bookmark this - return any time):
${d.resultsUrl}

Download as PDF:
${d.pdfUrl}

Your snapshot is private to you. The results page lists the four
VIFM factor scores and the VIFM training programmes most likely to
help you close any gaps.

Best regards,
Virginia Institute of Finance and Management`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `لقطتك الشخصية للجاهزية للذكاء الاصطناعي من VIFM جاهزة`,
      body: `مرحبًا ${d.respondentName}،

شكراً لإكمالك لقطة الجاهزية الشخصية للذكاء الاصطناعي من VIFM.

صفحة نتائجك (احفظها للرجوع إليها في أي وقت):
${d.resultsUrl}

تنزيل بصيغة PDF:
${d.pdfUrl}

لقطتك خاصة بك. تعرض صفحة النتائج درجات عوامل VIFM الأربعة وبرامج
التدريب الأكثر ملاءمة لمساعدتك في معالجة أي فجوات.

مع أطيب التحيات،
معهد فرجينيا للتمويل والإدارة`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `Your VIFM Personal AI Readiness Snapshot - لقطتك الشخصية`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
<p>Hello ${d.respondentName},</p>
<p>Thank you for completing the VIFM Personal AI Readiness Snapshot.</p>
<p><strong>Results page:</strong> <a href="${d.resultsUrl}">${d.resultsUrl}</a><br/>
<strong>PDF download:</strong> <a href="${d.pdfUrl}">${d.pdfUrl}</a></p>
<hr style="border:0;border-top:1px solid #e5e7eb;margin:18px 0;"/>
<div dir="rtl" style="font-family:'Open Sans',Arial,sans-serif;">
<p>مرحبًا ${d.respondentName}،</p>
<p>شكراً لإكمالك اللقطة الشخصية. احفظ الرابط أعلاه للرجوع إليه من أي جهاز.</p>
</div>
</div>`,
    }),
  },
  ara_personal_results_to_client: {
    en: (d) => ({
      contentType: "Text",
      subject: `AI Readiness results - ${d.respondentName} (${d.assessmentName})`,
      body: `Hello ${d.clientName},

${d.respondentName}${d.respondentEmail ? ` (${d.respondentEmail})` : ""} has completed the VIFM AI Readiness Snapshot for ${d.assessmentName}.

Their results report is attached as a PDF. It covers the four AI-readiness factors and the VIFM training programmes most likely to close any gaps.

If you have questions about interpreting the results, please contact your VIFM consultant.

Best regards,
Virginia Institute of Finance and Management`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `نتائج الجاهزية للذكاء الاصطناعي - ${d.respondentName} (${d.assessmentName})`,
      body: `مرحبًا ${d.clientName}،

أكمل ${d.respondentName}${d.respondentEmail ? ` (${d.respondentEmail})` : ""} لقطة الجاهزية للذكاء الاصطناعي من VIFM لـ ${d.assessmentName}.

تقرير النتائج مرفق بصيغة PDF. يغطي عوامل الجاهزية الأربعة وبرامج تدريب VIFM الأكثر ملاءمة لمعالجة أي فجوات.

إذا كانت لديك أسئلة حول تفسير النتائج، يرجى التواصل مع مستشار VIFM الخاص بك.

مع أطيب التحيات،
معهد فرجينيا للتمويل والإدارة`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `AI Readiness results - ${d.respondentName} / نتائج الجاهزية`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
<p>Hello ${d.clientName},</p>
<p>${d.respondentName}${d.respondentEmail ? ` (${d.respondentEmail})` : ""} has completed the VIFM AI Readiness Snapshot for <strong>${d.assessmentName}</strong>. Their results report is attached as a PDF.</p>
<hr style="border:0;border-top:1px solid #e5e7eb;margin:18px 0;"/>
<div dir="rtl" style="font-family:'Open Sans',Arial,sans-serif;">
<p>مرحبًا ${d.clientName}،</p>
<p>أكمل ${d.respondentName} لقطة الجاهزية للذكاء الاصطناعي لـ <strong>${d.assessmentName}</strong>. تقرير النتائج مرفق بصيغة PDF.</p>
</div>
</div>`,
    }),
  },
};

function getGraphClient(): Client | null {
  // Production (Render) uses OUTLOOK_* env-var names; documentation and
  // .env.local.example use AZURE_*. Accept either, prefer OUTLOOK_*.
  const tenantId = process.env.OUTLOOK_TENANT_ID ?? process.env.AZURE_TENANT_ID;
  const clientId = process.env.OUTLOOK_CLIENT_ID ?? process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  return Client.initWithMiddleware({ authProvider });
}

export type SendAraEmailInput = {
  to: string;
  emailType: AraEmailType;
  language: AraEmailLanguage;
  data: Record<string, string>;
  /** When true, recipient is overridden to SANDBOX_EMAIL_REDIRECT and the log row is flagged. */
  isSandbox?: boolean;
  respondentId?: string | null;
  assessmentId?: string | null;
  /** Optional file attachments (e.g. the results PDF), base64-encoded. */
  attachments?: EmailAttachment[];
};

// `delivered` is true ONLY when a real transport accepted the message (status
// "sent"). Console-mock (no transport) and failed sends are NOT delivered, so
// callers that report an "emailed N" count must gate on `delivered`, not `ok`.
export async function sendAraEmail(
  input: SendAraEmailInput
): Promise<{ ok: boolean; delivered: boolean; error?: string }> {
  const renderer = TEMPLATES[input.emailType]?.[input.language] ?? TEMPLATES[input.emailType]?.en;
  if (!renderer) return { ok: false, delivered: false, error: "Unknown email type/language combination" };

  const rendered = renderer(input.data);

  const sandboxRedirect = process.env.SANDBOX_EMAIL_REDIRECT?.trim() || null;
  const isRedirected = !!input.isSandbox && !!sandboxRedirect;
  const recipient = isRedirected ? sandboxRedirect! : input.to;

  const fromAddress = process.env.OUTLOOK_SENDER_EMAIL ?? process.env.EMAIL_FROM_ADDRESS;
  const graphClient = getGraphClient();

  let status: "sent" | "mocked" | "failed" = "sent";
  let errorMsg: string | undefined;

  const isHtml = rendered.contentType === "HTML";

  if (resendConfigured()) {
    // Preferred transport: Resend (also supports attachments).
    const r = await sendViaResend({
      to: recipient,
      subject: rendered.subject,
      html: isHtml ? rendered.body : undefined,
      text: isHtml ? undefined : rendered.body,
      attachments: input.attachments,
    });
    if (!r.ok) {
      status = "failed";
      errorMsg = r.error;
      console.error("[ara-email] Resend send failed:", r.error);
    }
  } else if (!graphClient || !fromAddress) {
    status = "mocked";
    console.warn("[ara-email] No transport configured - falling back to console mock.");
    console.log(`[ara-email MOCK] type=${input.emailType} lang=${input.language} to=${recipient}${isRedirected ? " (sandbox)" : ""}`);
    console.log(`[ara-email MOCK] subject=${rendered.subject}`);
  } else {
    try {
      // Map attachments (e.g. the results PDF) to Graph fileAttachment blocks -
      // the Graph path previously omitted them, so the emailed PDF silently
      // never attached (EMAIL-17). ARA only ever attaches the results PDF.
      const graphAttachments = (input.attachments ?? []).map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: "application/pdf",
        contentBytes: a.content,
      }));
      await graphClient.api(`/users/${fromAddress}/sendMail`).post({
        message: {
          subject: rendered.subject,
          body: { contentType: rendered.contentType, content: rendered.body },
          toRecipients: [{ emailAddress: { address: recipient } }],
          ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
        },
        saveToSentItems: true,
      });
    } catch (err) {
      status = "failed";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[ara-email] Graph send failed:", err);
    }
  }

  // Always write to ara_email_log - even mocks - so the consultant has
  // a paper trail of what would have been sent. Never throw on log
  // failure; emails are a nicety, never a blocker.
  try {
    const sb = createServiceClient();
    await sb.from("ara_email_log").insert({
      respondent_id: input.respondentId ?? null,
      assessment_id: input.assessmentId ?? null,
      email_type: input.emailType,
      recipient_email: recipient,
      language: input.language === "bilingual" ? "en" : input.language,
      is_sandbox_redirect: isRedirected,
      status,
    });
  } catch (logErr) {
    console.error("[ara-email] log insert failed:", logErr);
  }

  if (status === "failed") return { ok: false, delivered: false, error: errorMsg ?? "Send failed" };
  return { ok: true, delivered: status === "sent" };
}
