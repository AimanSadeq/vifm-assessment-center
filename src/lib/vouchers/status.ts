import { createServiceClient } from "@/lib/supabase/server";
import { VOUCHER_DESCRIPTORS, type VoucherServiceKey } from "./descriptor";

/**
 * Why a voucher code cannot currently be claimed.
 *
 * Trial feedback (Asaad on Fluent, Amal on ARC): re-opening a spent voucher
 * link served a clean, working form, so the delegate filled in every field and
 * only then got a generic "invalid, expired, or fully used" error. The redeem
 * pages already loaded the voucher row to prefill the client name - they simply
 * threw the status away. This resolves it once for every service.
 */
export type VoucherBlockReason = "disabled" | "expired" | "used_up";

export type VoucherBlock = {
  reason: VoucherBlockReason;
  /** Seat count, so a multi-seat cohort code can say "all N places are taken". */
  maxUses: number;
};

/**
 * Resolve whether `code` is currently claimable for `service`.
 *
 * CRITICAL: this must never be STRICTER than the service's claim RPC, or a
 * delegate holding a perfectly good code is turned away. Each condition is
 * therefore applied ONLY when the column actually exists on the row, which
 * mirrors each RPC exactly:
 *
 *   ara / persona / cognitive / fluent / technical / prehire
 *     status = 'active' AND used_count < max_uses AND (expires_at IS NULL OR expires_at > now())
 *   roleReadiness (rr_claim_voucher_seat, since 00193)
 *     uses < max_uses AND (expires_at IS NULL OR expires_at > now())
 *     - rr_vouchers has no `status` column, so there is no deactivate lever
 *       here; that condition is simply absent rather than exempted.
 *
 * Returns null when the code is claimable, unknown, or the lookup fails - in
 * every one of those cases the caller shows the normal form and the atomic RPC
 * remains the real gate at submit time.
 */
export async function loadVoucherBlock(
  service: VoucherServiceKey,
  rawCode: string,
): Promise<VoucherBlock | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const descriptor = VOUCHER_DESCRIPTORS[service];
  // redeemViaDescriptor normalizeCode()s (trim + uppercase) before invoking
  // EVERY claim RPC, role-readiness included, so match on the uppercased code.
  const lookup = code.toUpperCase();

  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from(descriptor.table)
      .select("*")
      .eq("code", lookup)
      .maybeSingle<Record<string, unknown>>();
    if (!data) return null; // unknown code - the form's own error is the right place

    const maxUses = Number(data.max_uses ?? 1);
    // used_count on most services; `uses` on role-readiness.
    const used = Number(data.used_count ?? data.uses ?? 0);

    const status = data.status as string | undefined;
    if (status !== undefined && status !== "active") return { reason: "disabled", maxUses };

    const expiresAt = data.expires_at as string | null | undefined;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return { reason: "expired", maxUses };
    }

    if (maxUses - used <= 0) return { reason: "used_up", maxUses };
    return null;
  } catch {
    // Tolerant: a missing table/column or a failed query degrades to today's
    // behaviour (render the form) rather than falsely blocking a delegate.
    return null;
  }
}

type Copy = { title: string; body: string };

/** Bilingual copy for a blocked code. The page has no language toggle once the
 *  form is replaced, so both languages are shown. */
export function voucherBlockCopy(block: VoucherBlock): { en: Copy; ar: Copy } {
  const multi = block.maxUses > 1;
  switch (block.reason) {
    case "disabled":
      return {
        en: {
          title: "This code is no longer active",
          body: "The organisation that issued this code has deactivated it. Please contact them for a new link.",
        },
        ar: {
          title: "لم يعد هذا الرمز نشطًا",
          body: "قامت الجهة التي أصدرت هذا الرمز بإلغاء تفعيله. يرجى التواصل معها للحصول على رابط جديد.",
        },
      };
    case "expired":
      return {
        en: {
          title: "This code has expired",
          body: "This link is past its valid-until date. Please contact the organisation that invited you for a new one.",
        },
        ar: {
          title: "انتهت صلاحية هذا الرمز",
          body: "انتهت صلاحية هذا الرابط. يرجى التواصل مع الجهة التي دعتك للحصول على رابط جديد.",
        },
      };
    case "used_up":
      return multi
        ? {
            en: {
              title: "This code has no places left",
              body: `All ${block.maxUses} places on this code have been taken. Please ask the organisation that invited you for a new code.`,
            },
            ar: {
              title: "لم تعد هناك مقاعد متاحة على هذا الرمز",
              body: `تم استخدام جميع المقاعد البالغ عددها ${block.maxUses} على هذا الرمز. يرجى طلب رمز جديد من الجهة التي دعتك.`,
            },
          }
        : {
            en: {
              title: "This code has already been used",
              body: "Each access code can be used once, and this one has been redeemed. If you already completed the assessment, your result was sent to the organisation that invited you. If you think this is a mistake, contact them for a new code.",
            },
            ar: {
              title: "تم استخدام هذا الرمز بالفعل",
              body: "يمكن استخدام كل رمز مرة واحدة فقط، وقد تم استخدام هذا الرمز. إذا كنت قد أكملت التقييم بالفعل، فقد أُرسلت نتيجتك إلى الجهة التي دعتك. وإذا كنت ترى أن هناك خطأ، يرجى التواصل معها للحصول على رمز جديد.",
            },
          };
  }
}
