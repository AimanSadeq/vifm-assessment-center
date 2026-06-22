import Link from "next/link";
import {
  Languages, BrainCircuit, Layers, BadgeCheck, UserSearch, Compass, Aperture, ArrowRight, type LucideIcon,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerLocale, getServerDir } from "@/lib/i18n/server";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg, type Allocation } from "@/lib/clients/allocations";
import { PORTAL_SERVICES, type PortalServiceMeta, type CaliberService } from "@/lib/clients/portal-services";
import { loadPlatformClients } from "@/lib/clients/registry";

export const dynamic = "force-dynamic";

type Lang = "en" | "ar";

// Per-service visual identity - mirrors the admin platform landing (same icon +
// jewel hue per service), so the client portal looks like the admin landing.
const VISUAL: Record<CaliberService, { icon: LucideIcon; tone: string; tagEn: string; tagAr: string }> = {
  fluent: { icon: Languages, tone: "gold", tagEn: "AI English placement", tagAr: "تحديد مستوى الإنجليزية" },
  logica: { icon: BrainCircuit, tone: "fuchsia", tagEn: "Reasoning aptitude", tagAr: "القدرة على الاستدلال" },
  persona: { icon: Layers, tone: "cyan", tagEn: "Behavioural self-assessment", tagAr: "تقييم سلوكي ذاتي" },
  techno: { icon: BadgeCheck, tone: "indigo", tagEn: "Technical proficiency", tagAr: "الكفاءة التقنية" },
  prehire: { icon: UserSearch, tone: "rose", tagEn: "Pre-employment screening", tagAr: "الفرز قبل التوظيف" },
  arc: { icon: Compass, tone: "violet", tagEn: "AI Readiness · AR Compass", tagAr: "الجاهزية للذكاء الاصطناعي" },
  reflect: { icon: Aperture, tone: "teal", tagEn: "Leadership 360 feedback", tagAr: "تغذية راجعة 360" },
};

const T = {
  en: {
    subtitle: "Your allocated assessments - distribute to your staff, monitor progress, and run reports.",
    voucher: "Self-serve assessments",
    seat: "VIFM-managed programmes",
    granted: "Granted",
    used: "Used",
    remaining: "Remaining",
    open: "Open",
    expires: "Expires",
    noExpiry: "No expiry",
    notAllocated: "Not allocated - contact your VIFM consultant to enable.",
    suspended: "Suspended",
    expired: "Expired",
    statServices: "Services",
    statSeats: "Seats granted",
    statRemaining: "Seats remaining",
    noOrg: "No programme has been allocated to your organisation yet. Please contact your VIFM consultant.",
    pickClient: "Admin preview - pick a client to view their portal:",
  },
  ar: {
    subtitle: "تقييماتك المخصصة - وزّعها على موظفيك، وراقب التقدّم، وأصدر التقارير.",
    voucher: "تقييمات ذاتية الخدمة",
    seat: "برامج تُدار من VIFM",
    granted: "ممنوح",
    used: "مُستخدَم",
    remaining: "متبقٍ",
    open: "افتح",
    expires: "ينتهي",
    noExpiry: "بدون انتهاء",
    notAllocated: "غير مخصص - تواصل مع مستشار VIFM لتفعيله.",
    suspended: "موقوف",
    expired: "منتهٍ",
    statServices: "الخدمات",
    statSeats: "المقاعد الممنوحة",
    statRemaining: "المقاعد المتبقية",
    noOrg: "لم يُخصَّص أي برنامج لمؤسستك بعد. يرجى التواصل مع مستشار VIFM.",
    pickClient: "معاينة المسؤول - اختر عميلاً لعرض بوابته:",
  },
};

function ServiceCard({
  svc,
  alloc,
  t,
  lang,
  href,
}: {
  svc: PortalServiceMeta;
  alloc: Allocation | undefined;
  t: (typeof T)["en"];
  lang: Lang;
  href: string | undefined;
}) {
  const vis = VISUAL[svc.id];
  const Icon = vis.icon;
  const name = lang === "ar" ? svc.labelAr : svc.label;
  const tag = lang === "ar" ? vis.tagAr : vis.tagEn;
  const dateLocale = lang === "ar" ? "ar" : "en-GB";

  // Dimmed, non-interactive card for a service the org was not allocated.
  if (!alloc) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-dashed bg-card/40 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="ara-eyebrow">{tag}</div>
            <h3 className="text-base font-semibold text-muted-foreground">{name}</h3>
          </div>
        </div>
        <p className="mt-3 text-xs leading-snug text-muted-foreground">{t.notAllocated}</p>
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
    <Link
      href={href ?? "#"}
      className={`launcher-card tone-${vis.tone} flex h-full flex-col p-4 transition hover:shadow-md`}
      style={{ borderColor: `${svc.accent}55` }}
    >
      <Icon className="launcher-card-glyph h-28 w-28" aria-hidden="true" />

      <div className="relative z-[1] flex items-start gap-3">
        <div className="launcher-card-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="ara-eyebrow">{tag}</div>
          <h3 className="text-base font-semibold text-primary">{name}</h3>
        </div>
        {(alloc.status === "suspended" || expired) && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
            {alloc.status === "suspended" ? t.suspended : t.expired}
          </span>
        )}
      </div>

      <div className="relative z-[1] mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold tabular-nums text-foreground">{alloc.seats_total}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.granted}</div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums text-foreground">{alloc.seats_used}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.used}</div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: svc.accent }}>{alloc.seats_remaining}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.remaining}</div>
        </div>
      </div>

      <div className="relative z-[1] mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: svc.accent }} />
      </div>

      <div className="relative z-[1] mt-3 flex items-center justify-between gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${expiryChip}`}>
          {alloc.expires_at ? `${t.expires} ${new Date(alloc.expires_at).toLocaleDateString(dateLocale)}` : t.noExpiry}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: svc.accent }}>
          {t.open} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </span>
      </div>
    </Link>
  );
}

export default async function PortalHomePage({ searchParams }: { searchParams?: { org?: string } }) {
  const locale = await getServerLocale();
  const lang: Lang = locale === "ar" ? "ar" : "en";
  const dir = getServerDir(locale);
  const t = T[lang];

  const access = await resolvePortalAccess(searchParams?.org);
  const orgId = access.ok ? access.orgId : null;
  const viewingAsAdmin = access.ok ? access.viewingAsAdmin : false;
  const svcHref = (id: string, allocated: boolean) =>
    allocated ? `/portal/services/${id}${viewingAsAdmin ? `?org=${orgId}` : ""}` : undefined;

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

  // Headline stats (only over allocated services).
  const seatsGranted = allocations.reduce((n, a) => n + a.seats_total, 0);
  const seatsRemaining = allocations.reduce((n, a) => n + a.seats_remaining, 0);

  return (
    <div dir={dir} className="space-y-7">
      <header className="rounded-2xl border bg-gradient-to-br from-[#010131] to-[#121140] p-6 text-white">
        <h1 className="text-2xl font-semibold">{org?.name ?? "Client portal"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/75">{t.subtitle}</p>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {[
            { v: allocations.length, l: t.statServices },
            { v: seatsGranted, l: t.statSeats },
            { v: seatsRemaining, l: t.statRemaining },
          ].map((s) => (
            <div key={s.l}>
              <dd className="text-2xl font-semibold tabular-nums leading-none">{s.v}</dd>
              <dt className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/55">{s.l}</dt>
            </div>
          ))}
        </dl>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.voucher}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {voucherServices.map((s) => (
            <ServiceCard key={s.id} svc={s} alloc={byService.get(s.id)} t={t} lang={lang} href={svcHref(s.id, byService.has(s.id))} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.seat}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seatServices.map((s) => (
            <ServiceCard key={s.id} svc={s} alloc={byService.get(s.id)} t={t} lang={lang} href={svcHref(s.id, byService.has(s.id))} />
          ))}
        </div>
      </section>
    </div>
  );
}
