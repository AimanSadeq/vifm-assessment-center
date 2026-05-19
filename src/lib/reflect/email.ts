/**
 * Reflect email integration.
 *
 * Three bilingual templates:
 *   - reflect_rater_invitation   — sent to a rater with their token URL
 *   - reflect_rater_reminder     — gentle nudge if they haven't completed
 *   - reflect_completion_notice  — consultant notification when a rater completes
 *
 * Same posture as src/lib/ara/email.ts:
 *   - Microsoft Graph via OUTLOOK_* / AZURE_* env vars; falls back to console
 *     mock when creds are missing.
 *   - Sandbox engagements redirect every recipient to SANDBOX_EMAIL_REDIRECT.
 *   - Every send writes a reflect_email_log row (mock + real + failed).
 */

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { createServiceClient } from "@/lib/supabase/server";

export type ReflectEmailType =
  | "reflect_rater_invitation"
  | "reflect_rater_reminder"
  | "reflect_completion_notice";

export type ReflectEmailLanguage = "en" | "ar" | "bilingual";

type RenderedEmail = {
  subject: string;
  body: string;
  contentType: "Text" | "HTML";
};

type Renderer = (data: Record<string, string>) => RenderedEmail;

const ROLE_LABELS = {
  en: {
    self: "yourself",
    manager: "your direct report",
    peer: "a colleague",
    direct_report: "your line manager",
    skip_level: "your skip-level leader",
    other: "a colleague",
  },
  ar: {
    self: "نفسك",
    manager: "تقريرك المباشر",
    peer: "أحد زملائك",
    direct_report: "مديرك المباشر",
    skip_level: "القائد الأعلى منك بدرجة",
    other: "أحد زملائك",
  },
} as const;

const TEMPLATES: Record<
  ReflectEmailType,
  Record<ReflectEmailLanguage, Renderer>
> = {
  reflect_rater_invitation: {
    en: (d) => ({
      contentType: "Text",
      subject: `360° feedback invitation — ${d.participantName}`,
      body: `Hello ${d.raterName},

${d.participantName} has nominated you to provide 360° leadership feedback as part of ${d.engagementName} at ${d.organizationName}.

You'll be rating ${d.roleLabel} on a short set of observable behaviours. Your responses are anonymised in the report (peer and direct-report scores only appear once at least ${d.anonymityN} raters in each group have responded).

Your secure response link (do not share):
${d.respondentUrl}

The form takes 10–15 minutes. Your answers are saved automatically as you go, and you can pause and resume any time using the same link.

If you have questions, please reply to this email.

Best regards,
Virginia Institute of Finance and Management`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `دعوة للمشاركة في تقييم 360 — ${d.participantName}`,
      body: `مرحبًا ${d.raterName}،

تمت ترشيحك من قِبل ${d.participantName} لتقديم تغذية راجعة قيادية ضمن برنامج ${d.engagementName} في ${d.organizationName}.

ستقوم بتقييم ${d.roleLabel} وفق مجموعة موجزة من السلوكيات الملاحظة. تظل إجاباتك مجهولة الهوية في التقرير (لا تظهر نتائج فئتي الزملاء والتقارير المباشرة إلا بعد إجابة ${d.anonymityN} مقيّمين على الأقل في كل فئة).

رابطك الآمن للإجابة (يُرجى عدم مشاركته):
${d.respondentUrl}

يستغرق الاستبيان من 10 إلى 15 دقيقة. تُحفظ إجاباتك تلقائيًا، ويمكنك إيقافه واستئنافه في أي وقت باستخدام الرابط نفسه.

إن كانت لديك أي استفسارات، يُرجى الرد على هذه الرسالة.

مع أطيب التحيات،
معهد فرجينيا للتمويل والإدارة`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `360° Feedback / تقييم 360 — ${d.participantName}`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
  <p>Hello ${d.raterName},</p>
  <p>${d.participantName} has nominated you to provide 360° leadership feedback as part of <strong>${d.engagementName}</strong> at ${d.organizationName}.</p>
  <p>You'll rate ${d.roleLabel} on a short set of observable behaviours (10–15 minutes). Peer and direct-report scores are only revealed once at least ${d.anonymityN} raters in each group have responded.</p>
  <p><a href="${d.respondentUrl}" style="color:#5391D5;">Open your secure response link</a> — do not share.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <div dir="rtl" style="text-align:right;">
    <p>مرحبًا ${d.raterName}،</p>
    <p>تمت ترشيحك من قِبل ${d.participantName} لتقديم تغذية راجعة قيادية ضمن برنامج <strong>${d.engagementName}</strong> في ${d.organizationName}.</p>
    <p>ستقوم بتقييم ${d.roleLabel} وفق مجموعة موجزة من السلوكيات الملاحظة (10–15 دقيقة). لا تظهر نتائج فئتي الزملاء والتقارير المباشرة إلا بعد إجابة ${d.anonymityN} مقيّمين على الأقل.</p>
    <p><a href="${d.respondentUrl}" style="color:#5391D5;">افتح رابطك الآمن للإجابة</a> — يُرجى عدم مشاركته.</p>
  </div>
</div>`,
    }),
  },

  reflect_rater_reminder: {
    en: (d) => ({
      contentType: "Text",
      subject: `Reminder: 360° feedback for ${d.participantName}`,
      body: `Hello ${d.raterName},

This is a gentle reminder that ${d.participantName}'s 360° feedback window is still open.

Your secure response link:
${d.respondentUrl}

Field window closes ${d.fieldWindowEnd}.

— VIFM Reflect`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `تذكير: تقييم 360 لـ ${d.participantName}`,
      body: `مرحبًا ${d.raterName}،

هذا تذكير لطيف بأن نافذة تقديم التغذية الراجعة لـ ${d.participantName} لا تزال مفتوحة.

رابطك الآمن للإجابة:
${d.respondentUrl}

تُغلق نافذة التقييم في ${d.fieldWindowEnd}.

— VIFM Reflect`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `Reminder · تذكير — 360° feedback for ${d.participantName}`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
  <p>Hello ${d.raterName},</p>
  <p>A gentle reminder that ${d.participantName}'s 360° feedback window is still open. <a href="${d.respondentUrl}" style="color:#5391D5;">Resume your response</a>.</p>
  <p>Field window closes ${d.fieldWindowEnd}.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <div dir="rtl" style="text-align:right;">
    <p>مرحبًا ${d.raterName}،</p>
    <p>تذكير لطيف بأن نافذة التقييم لـ ${d.participantName} لا تزال مفتوحة. <a href="${d.respondentUrl}" style="color:#5391D5;">تابع إجابتك</a>.</p>
    <p>تُغلق النافذة في ${d.fieldWindowEnd}.</p>
  </div>
</div>`,
    }),
  },

  reflect_completion_notice: {
    en: (d) => ({
      contentType: "Text",
      subject: `Rater completed — ${d.raterName} → ${d.participantName}`,
      body: `Hi ${d.consultantName ?? "consultant"},

${d.raterName} (${d.raterRoleLabel}) has completed their 360° feedback for ${d.participantName} on ${d.engagementName}.

Status: ${d.completedCount} of ${d.totalCount} raters complete for ${d.participantName}.

Open the engagement: ${d.engagementUrl}

— VIFM Reflect`,
    }),
    ar: (d) => ({
      contentType: "Text",
      subject: `إكمال المقيّم — ${d.raterName} → ${d.participantName}`,
      body: `مرحبًا ${d.consultantName ?? "المستشار"}،

أكمل ${d.raterName} (${d.raterRoleLabel}) التغذية الراجعة لـ ${d.participantName} ضمن ${d.engagementName}.

الحالة: ${d.completedCount} من أصل ${d.totalCount} مقيّمين أنجزوا.

افتح المشروع: ${d.engagementUrl}

— VIFM Reflect`,
    }),
    bilingual: (d) => ({
      contentType: "HTML",
      subject: `Rater complete · ${d.raterName} → ${d.participantName}`,
      body: `<div style="font-family:'Open Sans',Arial,sans-serif;line-height:1.55;color:#121232;">
  <p>${d.raterName} (${d.raterRoleLabel}) has completed feedback for <strong>${d.participantName}</strong>.</p>
  <p>Status: ${d.completedCount} of ${d.totalCount} raters complete.</p>
  <p><a href="${d.engagementUrl}" style="color:#5391D5;">Open the engagement</a>.</p>
</div>`,
    }),
  },
};

function getGraphClient(): Client | null {
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

export type SendReflectEmailInput = {
  to: string;
  emailType: ReflectEmailType;
  language: ReflectEmailLanguage;
  data: Record<string, string>;
  isSandbox?: boolean;
  engagementId?: string | null;
  participantId?: string | null;
  raterId?: string | null;
};

export async function sendReflectEmail(
  input: SendReflectEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const renderer = TEMPLATES[input.emailType]?.[input.language] ?? TEMPLATES[input.emailType]?.en;
  if (!renderer) return { ok: false, error: "Unknown email type/language combination" };

  const rendered = renderer(input.data);

  const sandboxRedirect = process.env.SANDBOX_EMAIL_REDIRECT?.trim() || null;
  const isRedirected = !!input.isSandbox && !!sandboxRedirect;
  const recipient = isRedirected ? sandboxRedirect! : input.to;

  const fromAddress = process.env.OUTLOOK_SENDER_EMAIL ?? process.env.EMAIL_FROM_ADDRESS;
  const graphClient = getGraphClient();

  let status: "sent" | "mocked" | "failed" = "sent";
  let errorMsg: string | undefined;

  if (!graphClient || !fromAddress) {
    status = "mocked";
    console.warn("[reflect-email] Graph not configured — falling back to console mock.");
    console.log(
      `[reflect-email MOCK] type=${input.emailType} lang=${input.language} to=${recipient}${
        isRedirected ? " (sandbox)" : ""
      }`
    );
    console.log(`[reflect-email MOCK] subject=${rendered.subject}`);
  } else {
    try {
      await graphClient.api(`/users/${fromAddress}/sendMail`).post({
        message: {
          subject: rendered.subject,
          body: { contentType: rendered.contentType, content: rendered.body },
          toRecipients: [{ emailAddress: { address: recipient } }],
        },
        saveToSentItems: true,
      });
    } catch (err) {
      status = "failed";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[reflect-email] Graph send failed:", err);
    }
  }

  // Log row regardless of outcome.
  try {
    const sb = createServiceClient();
    await sb.from("reflect_email_log").insert({
      engagement_id: input.engagementId ?? null,
      participant_id: input.participantId ?? null,
      rater_id: input.raterId ?? null,
      email_type: input.emailType,
      recipient_email: recipient,
      language: input.language === "bilingual" ? "en" : input.language,
      is_sandbox_redirect: isRedirected,
      status,
    });
  } catch (logErr) {
    console.error("[reflect-email] log insert failed:", logErr);
  }

  if (status === "failed") return { ok: false, error: errorMsg ?? "Send failed" };
  return { ok: true };
}

export function roleLabel(
  role: "self" | "manager" | "peer" | "direct_report" | "skip_level" | "other",
  language: "en" | "ar"
): string {
  return ROLE_LABELS[language][role];
}
