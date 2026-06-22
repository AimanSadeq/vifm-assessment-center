import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerLocale, getServerDir } from "@/lib/i18n/server";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg, type Allocation } from "@/lib/clients/allocations";
import { PORTAL_SERVICES, type PortalServiceMeta } from "@/lib/clients/portal-services";
import { loadPlatformClients } from "@/lib/clients/registry";

export const dynamic = "force-dynamic";

const T = {
  en: {
    subtitle: "Your allocated assessments across services - distribute to your staff, monitor progress, and run reports.",
    voucher: "Self-serve assessments",
    seat: "VIFM-managed programmes",
    granted: "Granted",
    used: "Used",
    remaining: "Remaining",
    expires: "Expires",
    noExpiry: "No expiry",
    notAllocated: "Not allocated",
    suspended: "Suspended",
    expired: "Expired",
    noOrg: "No programme has been allocated to your organisation yet. Please contact your VIFM consultant.",
    pickClient: "Admin preview - pick a client to view their portal:",
  },
  ar: {
    subtitle: "تقييماتك المخصصة عبر الخدمات - وزّعها على موظفيك، وراقب التقدّم، وأصدر التقارير.",
    voucher: "تقييمات ذاتية الخدمة",
    seat: "برامج تُدار من VIFM",
    granted: "ممنوح",
    used: "مُستخدَم",
    remaining: "متبقٍ",
    expires: "ينتهي",
    noExpiry: "بدون انتهاء",
    notAllocated: "غير مخصص",
    suspended: "موقوف",
    expired: "منتهٍ",
    noOrg: "لم يُخصَّص أي برنامج لمؤسستك بعد. يرجى التواصل مع مستشار VIFM.",
    pickClient: "معاينة المسؤول - اختر عميلاً لعرض بوابته:",
  },
};

type Lang = "en" | "ar";

function ServiceCard({ svc, alloc, t, lang }: { svc: PortalServiceMeta; alloc: Allocation | undefined; t: (typeof T)["en"]; lang: Lang }) {
  const name = lang === "ar" ? svc.labelAr : svc.label;
  if (!alloc) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-4 opacity-70">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: svc.accent }} />
          <span className="text-sm font-semibold text-foreground">{name}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.notAllocated}</p>
      </div>
    );
  }
  const expired = !!alloc.expires_at && new Date(alloc.expires_at).getTime() <= Date.now();
  const daysLeft = alloc.expires_at ? Math.ceil((new Date(alloc.expires_at).getTime() - Date.now()) / 86_400_000) : null;
  const pct = alloc.seats_total > 0 ? Math.min(100, Math.round((alloc.seats_used / alloc.seats_total) * 100)) : 0;
  const expiryChip = expired
    ? "bg-rose-100 text-rose-700"
    : daysLeft !== null && daysLeft <= 30
    ? "bg-amber-100 text-amber-800"
    : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-xl border bg-card p-4" style={{ borderColor: `${svc.accent}55` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: svc.accent }} />
          <span className="text-sm font-semibold text-foreground">{name}</span>
        </div>
        {(alloc.status === "suspended" || expired) && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
            {alloc.status === "suspended" ? t.suspended : t.expired}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-lg font-semibold tabular-nums text-foreground">{alloc.seats_total}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.granted}</div></div>
        <div><div className="text-lg font-semibold tabular-nums text-foreground">{alloc.seats_used}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.used}</div></div>
        <div><div className="text-lg font-semibold tabular-nums" style={{ color: svc.accent }}>{alloc.seats_remaining}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.remaining}</div></div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: svc.accent }} />
      </div>
      <div className="mt-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${expiryChip}`}>
          {alloc.expires_at ? `${t.expires} ${new Date(alloc.expires_at).toLocaleDateString(lang === "ar" ? "ar" : "en-GB")}` : t.noExpiry}
        </span>
      </div>
    </div>
  );
}

export default async function PortalHomePage({ searchParams }: { searchParams?: { org?: string } }) {
  const locale = await getServerLocale();
  const lang: Lang = locale === "ar" ? "ar" : "en";
  const dir = getServerDir(locale);
  const t = T[lang];

  const access = await resolvePortalAccess(searchParams?.org);
  const orgId = access.ok ? access.orgId : null;

  if (!orgId) {
    if (access.ok && access.viewingAsAdmin) {
      const clients = (await loadPlatformClients()).filter((c) => c.acId);
      return (
        <div dir={dir}>
          <h1 className="text-2xl font-semibold text-primary">Client portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.pickClient}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {clients.map((c) => (
              <Link key={c.acId} href={`/portal?org=${c.acId}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div dir={dir}>
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{t.noOrg}</p>
      </div>
    );
  }

  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
  const allocations = await getAllocationsForOrg(orgId);
  const byService = new Map(allocations.map((a) => [a.service, a]));
  const voucherServices = PORTAL_SERVICES.filter((s) => s.kind === "voucher");
  const seatServices = PORTAL_SERVICES.filter((s) => s.kind === "seat");

  return (
    <div dir={dir} className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-primary">{org?.name ?? "Client portal"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.voucher}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {voucherServices.map((s) => (
            <ServiceCard key={s.id} svc={s} alloc={byService.get(s.id)} t={t} lang={lang} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.seat}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seatServices.map((s) => (
            <ServiceCard key={s.id} svc={s} alloc={byService.get(s.id)} t={t} lang={lang} />
          ))}
        </div>
      </section>
    </div>
  );
}
