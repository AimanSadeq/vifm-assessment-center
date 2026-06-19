"use client";

import { useMemo, useState } from "react";
import { BackLink } from "@/components/shared/back-link";
import type { DomainIconKey, BarsLevel } from "@/lib/competencies/framework-definitions";
import type { DomainNode, FrameworkCounts } from "@/lib/competencies/framework-tree";

// Branded, read-only render of the VIFM competency framework grid. Owns search,
// per-domain filter and EN/AR language state (useState only - no storage). The
// look reproduces the approved prototype (vifm-competency-framework-grid.html):
// palette, Open Sans, card radii + shadows, accent top bar, domain-coloured
// columns, cluster accent bars, numbered competency badges, the BARS card.

type Lang = "en" | "ar";

type Counts = FrameworkCounts;

// ── Domain glyphs (SVG only, inherit currentColor = white header text) ──
function DomainIcon({ icon }: { icon: DomainIconKey }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-[22px] w-[22px]",
  };
  switch (icon) {
    case "thinking":
      return (
        <svg {...common}>
          <path d="M9.5 17.5h5M10.5 20.5h3" />
          <path d="M12 3.4a6 6 0 0 0-3.8 10.7c.6.5 1.05 1.2 1.2 2l.08.4h5.04l.08-.4c.15-.8.6-1.5 1.2-2A6 6 0 0 0 12 3.4Z" />
        </svg>
      );
    case "results":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="4.4" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.3 19c0-3.1 2.6-5.2 5.7-5.2s5.7 2.1 5.7 5.2" />
          <circle cx="17.2" cy="9" r="2.3" />
          <path d="M16.3 14.6c2.6.2 4.5 2 4.5 4.4" />
        </svg>
      );
    case "self":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" />
          <circle cx="12" cy="10" r="2.7" />
          <path d="M7.3 17.4c.9-2 2.6-3 4.7-3s3.8 1 4.7 3" />
        </svg>
      );
  }
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#64748B] ltr:left-[13px] rtl:right-[13px]"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width={11} height={11} viewBox="0 0 10 10" className="mt-[3px] inline-block shrink-0">
      <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg width={11} height={11} viewBox="0 0 10 10" className="mt-[3px] inline-block shrink-0">
      <path d="M2.2 2.2 L7.8 7.8 M7.8 2.2 L2.2 7.8" fill="none" stroke="#e11d48" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

const STRINGS = {
  en: {
    back: "Back",
    sub: "Competency Framework",
    tag: "Admin · Framework Reference",
    eyebrow: "Behavioural Competency Model",
    h1: "VIFM Competency Framework",
    lede: "The VIFM-authored behavioural framework that anchors the Caliber platform - domains organised into clusters and individual competencies, each rated on a five-point behaviourally anchored scale.",
    statDomains: "Domains",
    statClusters: "Clusters",
    statCompetencies: "Competencies",
    statScale: "Scale points",
    scaleTitle: "Proficiency Scale · 5-Point BARS",
    scaleNote: "Level 3 (Meets Requirement) is the working bar for the role.",
    target: "Target",
    searchPlaceholder: "Search competencies…",
    allDomains: "All domains",
    count: (shown: number, total: number) => `Showing ${shown} of ${total} competencies`,
    noResults: "No competencies match your search.",
    tabGrid: "Framework grid",
    tabIndicators: "Behavioural indicators",
    downloadPdf: "Download PDF",
    statIndicators: "Indicators",
    positiveLabel: "Positive indicators",
    negativeLabel: "Negative indicators",
    noIndicators: "No indicators recorded for this competency.",
    indicatorsLede:
      "Positive and negative behavioural indicators per competency - what strong looks like, and the warning signs. The detailed level beneath the framework grid.",
    comps: (n: number) => `${n} ${n === 1 ? "competency" : "competencies"}`,
    clusters: (n: number) => `${n} ${n === 1 ? "cluster" : "clusters"}`,
    provenance:
      "VIFM-authored framework (clean-room v2). Bilingual English / Arabic. © VIFM · Virginia Institute of Finance and Management.",
    ver: (d: number, c: number, m: number) => `Framework v2 · ${d} Domains · ${c} Clusters · ${m} Competencies`,
  },
  ar: {
    back: "رجوع",
    sub: "إطار الجدارات",
    tag: "المسؤول · مرجع الإطار",
    eyebrow: "نموذج الجدارات السلوكية",
    h1: "إطار جدارات VIFM",
    lede: "الإطار السلوكي الذي طوّرته VIFM ويشكّل أساس منصّة كاليبر - مجالات منظَّمة في مجموعات وكفاءات فردية، يُقيَّم كلٌّ منها على مقياس سلوكي من خمس نقاط.",
    statDomains: "المجالات",
    statClusters: "المجموعات",
    statCompetencies: "الكفاءات",
    statScale: "نقاط المقياس",
    scaleTitle: "مقياس الإتقان · مقياس سلوكي من 5 نقاط",
    scaleNote: "المستوى 3 (يلبّي المتطلّب) هو الحد المرجعي للدور.",
    target: "المستهدف",
    searchPlaceholder: "ابحث في الكفاءات…",
    allDomains: "كل المجالات",
    count: (shown: number, total: number) => `عرض ${shown} من ${total} كفاءة`,
    noResults: "لا توجد كفاءات مطابقة لبحثك.",
    tabGrid: "شبكة الإطار",
    tabIndicators: "المؤشرات السلوكية",
    downloadPdf: "تنزيل PDF",
    statIndicators: "المؤشرات",
    positiveLabel: "مؤشرات إيجابية",
    negativeLabel: "مؤشرات سلبية",
    noIndicators: "لا توجد مؤشرات مسجّلة لهذه الكفاءة.",
    indicatorsLede:
      "مؤشرات سلوكية إيجابية وسلبية لكل كفاءة - كيف يبدو الأداء القوي وما العلامات التحذيرية. المستوى التفصيلي أسفل شبكة الإطار.",
    comps: (n: number) => `${n} كفاءة`,
    clusters: (n: number) => `${n} مجموعة`,
    provenance:
      "إطار طوّرته VIFM (نسخة مستقلّة v2). ثنائي اللغة الإنجليزية / العربية. © VIFM · المعهد الأمريكي للتمويل والإدارة.",
    ver: (d: number, c: number, m: number) => `الإطار v2 · ${d} مجالات · ${c} مجموعات · ${m} كفاءة`,
  },
} as const;

const CARD_SHADOW = "shadow-[0_1px_3px_rgba(1,1,49,0.06),0_6px_18px_rgba(1,1,49,0.05)]";
const CARD_SHADOW_SM = "shadow-[0_1px_2px_rgba(1,1,49,0.05)]";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5391D5]/40";

export function FrameworkGrid({
  domains,
  scale,
  counts,
}: {
  domains: DomainNode[];
  scale: BarsLevel[];
  counts: Counts;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [query, setQuery] = useState("");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [tab, setTab] = useState<"grid" | "indicators">("grid");
  const t = STRINGS[lang];
  const ar = lang === "ar";

  // Filtered view: hide non-matching competencies, then clusters with zero
  // visible rows, then domains with zero visible clusters. Numbers stay fixed.
  const { view, shown } = useMemo(() => {
    const q = query.trim().toLowerCase();
    let count = 0;
    const v = domains
      .map((d) => {
        const domainMatch = activeDomain === "all" || d.key === activeDomain;
        const clusters = d.clusters
          .map((c) => {
            const comps = c.comps.filter((k) => {
              const hay = `${k.nameEn} ${k.nameAr}`.toLowerCase();
              return domainMatch && (!q || hay.includes(q));
            });
            count += comps.length;
            return { cluster: c, comps };
          })
          .filter((c) => c.comps.length > 0);
        return { domain: d, clusters };
      })
      .filter((d) => d.clusters.length > 0);
    return { view: v, shown: count };
  }, [domains, query, activeDomain]);

  return (
    <div className="-m-4 lg:-m-8" dir={ar ? "rtl" : "ltr"}>
      {/* Accent top bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#010131,#1A3A6B 40%,#5391D5)" }} />

      {/* Masthead */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6EBF2] bg-white px-6 py-[18px]">
        <div className="flex items-center gap-3.5">
          <BackLink href="/admin" label={t.back} history />
          <span className="ms-1 text-[20px] font-extrabold tracking-[0.14em] text-[#010131]">VIFM</span>
          <span className="h-[26px] w-px bg-[#E6EBF2]" />
          <span className="text-[13.5px] font-semibold text-[#64748B]">{t.sub}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* EN / AR toggle */}
          <div className="inline-flex overflow-hidden rounded-full border border-[#E6EBF2] bg-white text-[12px] font-bold">
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`px-3 py-1.5 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                  lang === l ? "bg-[#010131] text-white" : "text-[#1A3A6B] hover:bg-[#F5F7FA]"
                }`}
              >
                {l === "en" ? "EN" : "العربية"}
              </button>
            ))}
          </div>
          <a
            href="/api/admin/framework/pdf"
            className={`inline-flex items-center gap-2 rounded-full border border-[#010131] bg-[#010131] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#121140] ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            {t.downloadPdf}
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DCEAF8] bg-[#EFF5FC] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#5391D5] max-[640px]:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5391D5]" />
            {t.tag}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-7 pb-14 pt-[34px] max-[640px]:px-4">
        {/* Hero */}
        <section className="mb-[26px]">
          <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#5391D5]">{t.eyebrow}</div>
          <h1 className="text-[32px] font-extrabold leading-[1.12] tracking-[-0.01em] text-[#010131] max-[640px]:text-[25px]">
            {t.h1}
          </h1>
          <p className="mt-[11px] max-w-[62ch] text-[15px] text-[#64748B]">{tab === "indicators" ? t.indicatorsLede : t.lede}</p>

          {/* Stats */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            {(
              [
                [counts.domains, t.statDomains],
                [counts.clusters, t.statClusters],
                [counts.competencies, t.statCompetencies],
                [counts.indicators, t.statIndicators],
                [counts.scalePoints, t.statScale],
              ] as const
            ).map(([v, label]) => (
              <span
                key={label}
                className={`inline-flex items-baseline gap-2 rounded-full border border-[#E6EBF2] bg-white px-4 py-2 ${CARD_SHADOW_SM}`}
              >
                <b className="text-[16px] font-extrabold tabular-nums text-[#010131]">{v}</b>
                <span className="text-[12.5px] font-semibold text-[#64748B]">{label}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Tab toggle: framework grid <-> behavioural indicators */}
        <div className={`mb-[22px] inline-flex overflow-hidden rounded-full border border-[#E6EBF2] bg-white text-[13px] font-bold ${CARD_SHADOW_SM}`}>
          {([["grid", t.tabGrid], ["indicators", t.tabIndicators]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`px-4 py-2 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${tab === key ? "bg-[#010131] text-white" : "text-[#1A3A6B] hover:bg-[#F5F7FA]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Proficiency scale (grid view only) */}
        {tab === "grid" ? (
        <section aria-label="Proficiency scale" className={`mb-[26px] rounded-[14px] border border-[#E6EBF2] bg-white px-[22px] py-5 ${CARD_SHADOW}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-[#1E293B]">{t.scaleTitle}</span>
            <span className="text-[12.5px] text-[#64748B]">{t.scaleNote}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2">
            {scale.map((s) => (
              <div key={s.level}>
                <div className="h-[9px] rounded-[5px]" style={{ background: s.color }} />
                <div className="mt-[9px] flex items-start gap-[7px]">
                  <span
                    className="grid h-5 w-5 flex-none place-items-center rounded-md text-[11px] font-extrabold tabular-nums text-white"
                    style={{ background: s.color }}
                  >
                    {s.level}
                  </span>
                  <span>
                    <span className={`text-[12px] font-semibold leading-[1.3] ${s.target ? "text-[#5391D5]" : "text-[#1E293B]"}`}>
                      {ar ? s.labelAr : s.labelEn}
                    </span>
                    {s.target && (
                      <span className="mt-[3px] block">
                        <span className="inline-block rounded-full border border-[#DCEAF8] bg-[#EFF5FC] px-[7px] py-px text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[#5391D5]">
                          {t.target}
                        </span>
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center gap-3.5">
          <div className="relative min-w-[230px] max-w-[420px] flex-[1_1_280px]">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              autoComplete="off"
              className={`w-full rounded-[10px] border border-[#E6EBF2] bg-white py-[11px] text-[14px] text-[#1E293B] placeholder:text-[#9AA8BC] focus:border-[#5391D5] focus:outline-none focus:ring-[3px] focus:ring-[#5391D5]/20 ltr:pl-10 ltr:pr-3.5 rtl:pr-10 rtl:pl-3.5 ${CARD_SHADOW_SM}`}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by domain">
            <DomainChip active={activeDomain === "all"} onClick={() => setActiveDomain("all")} label={t.allDomains} />
            {domains.map((d) => (
              <DomainChip
                key={d.id}
                active={activeDomain === d.key}
                onClick={() => setActiveDomain(d.key)}
                label={ar ? d.nameAr : d.displayEn}
                swatch={d.visual.color}
              />
            ))}
          </div>
          <span className="text-[12.5px] font-semibold tabular-nums text-[#64748B] max-[640px]:w-full ltr:ml-auto rtl:mr-auto">
            {t.count(shown, counts.competencies)}
          </span>
        </div>

        {/* Grid */}
        {view.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#E6EBF2] bg-white px-5 py-[46px] text-center text-[14px] text-[#64748B]">
            {t.noResults}
          </div>
        ) : tab === "grid" ? (
          <section aria-label="Competency grid" className="grid grid-cols-1 items-start gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-4">
            {view.map(({ domain: d, clusters }) => {
              const caption = ar ? d.visual.captionAr : d.visual.captionEn;
              return (
                <div
                  key={d.id}
                  className={`flex flex-col overflow-hidden rounded-[14px] border border-[#E6EBF2] bg-white ${CARD_SHADOW}`}
                >
                  {/* Column head */}
                  <div className="relative px-[18px] pb-4 pt-[18px] text-white" style={{ background: d.visual.color }}>
                    <span className="mb-[13px] grid h-[38px] w-[38px] place-items-center rounded-[11px] border border-white/20 bg-white/[0.16]">
                      <DomainIcon icon={d.visual.icon} />
                    </span>
                    <div className="text-[18px] font-extrabold tracking-[0.01em]">{ar ? d.nameAr : d.displayEn}</div>
                    {caption ? <div className="mt-0.5 text-[11.5px] font-semibold tracking-[0.02em] opacity-[0.82]">{caption}</div> : null}
                    <div className="mt-[13px] flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.05em] opacity-[0.92]">
                      {t.clusters(clusters.length)}
                      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                      {t.comps(d.compCount)}
                    </div>
                  </div>

                  {/* Column body */}
                  <div className="flex flex-col gap-1 px-3.5 pb-4 pt-1.5">
                    {clusters.map(({ cluster: c, comps }) => {
                      const sub = !ar && c.defEn ? c.defEn : t.comps(c.comps.length);
                      return (
                        <div key={c.id} className="px-1 pb-1 pt-3">
                          <div className="mb-[9px] flex items-stretch gap-[9px] ps-0.5">
                            <span className="w-[3px] min-h-[30px] flex-none self-stretch rounded-[3px]" style={{ background: d.visual.color }} />
                            <span>
                              <span className="block text-[13px] font-extrabold leading-[1.25] text-[#1E293B]">{ar ? c.nameAr : c.nameEn}</span>
                              <span className="mt-px block text-[10.5px] font-semibold tracking-[0.02em] text-[#64748B]">{sub}</span>
                            </span>
                          </div>
                          {comps.map((k) => (
                            <div
                              key={k.id}
                              title={ar ? k.descAr || undefined : k.descEn || undefined}
                              className="flex items-center gap-[11px] rounded-[9px] px-2.5 py-2 transition-colors hover:bg-[#F5F7FA] motion-reduce:transition-none"
                            >
                              <span
                                className="grid h-[22px] w-[26px] flex-none place-items-center rounded-md text-[11px] font-extrabold tabular-nums"
                                style={{ background: d.visual.tint, color: d.visual.color }}
                              >
                                {k.seq}
                              </span>
                              <span className="text-[13px] font-semibold leading-[1.3] text-[#1E293B]">{ar ? k.nameAr : k.nameEn}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          /* Behavioural indicators view (level 2): positive + negative per competency */
          <section aria-label="Behavioural indicators" className="space-y-[18px]">
            {view.map(({ domain: d, clusters }) => {
              const comps = clusters.flatMap(({ comps: cs }) => cs);
              return (
                <div key={d.id} className={`overflow-hidden rounded-[14px] border border-[#E6EBF2] bg-white ${CARD_SHADOW}`}>
                  <div className="flex items-center gap-3 px-[18px] py-3 text-white" style={{ background: d.visual.color }}>
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border border-white/20 bg-white/[0.16]">
                      <DomainIcon icon={d.visual.icon} />
                    </span>
                    <span className="text-[16px] font-extrabold">{ar ? d.nameAr : d.displayEn}</span>
                  </div>
                  <div className="divide-y divide-[#EEF2F7]">
                    {comps.map((k) => (
                      <div key={k.id} className="px-[18px] py-3.5">
                        <div className="flex items-center gap-[11px]">
                          <span className="grid h-[22px] w-[26px] flex-none place-items-center rounded-md text-[11px] font-extrabold tabular-nums" style={{ background: d.visual.tint, color: d.visual.color }}>
                            {k.seq}
                          </span>
                          <span className="text-[14px] font-bold text-[#1E293B]">{ar ? k.nameAr : k.nameEn}</span>
                        </div>
                        {(ar ? k.descAr : k.descEn) ? (
                          <p className="mt-1 text-[12px] text-[#64748B] ltr:ml-[37px] rtl:mr-[37px]">{ar ? k.descAr : k.descEn}</p>
                        ) : null}
                        {k.positives.length > 0 || k.negatives.length > 0 ? (
                          <div className="mt-2.5 grid gap-3 sm:grid-cols-2 ltr:ml-[37px] rtl:mr-[37px]">
                            <div>
                              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-emerald-700">{t.positiveLabel}</div>
                              <ul className="space-y-1">
                                {k.positives.length > 0 ? k.positives.map((p, i) => (
                                  <li key={`p-${i}`} className="flex gap-1.5 text-[12.5px] leading-[1.4] text-[#1E293B]"><Tick /><span>{p}</span></li>
                                )) : <li className="text-[12px] text-[#9AA8BC]">-</li>}
                              </ul>
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-rose-700">{t.negativeLabel}</div>
                              <ul className="space-y-1">
                                {k.negatives.length > 0 ? k.negatives.map((n, i) => (
                                  <li key={`n-${i}`} className="flex gap-1.5 text-[12.5px] leading-[1.4] text-[#1E293B]"><Cross /><span>{n}</span></li>
                                )) : <li className="text-[12px] text-[#9AA8BC]">-</li>}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-[12px] text-[#9AA8BC] ltr:ml-[37px] rtl:mr-[37px]">{t.noIndicators}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3.5 border-t border-[#E6EBF2] px-7 pb-10 pt-[22px]">
        <small className="text-[11.5px] leading-[1.6] text-[#64748B]">{t.provenance}</small>
        <span className="rounded-full border border-[#E6EBF2] bg-[#EFF3F9] px-[11px] py-[5px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#1A3A6B]">
          {t.ver(counts.domains, counts.clusters, counts.competencies)}
        </span>
      </footer>
    </div>
  );
}

function DomainChip({
  active,
  onClick,
  label,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-[15px] py-2 text-[12.5px] font-bold transition-colors motion-reduce:transition-none ${CARD_SHADOW_SM} ${FOCUS_RING} ${
        active ? "border-[#010131] bg-[#010131] text-white" : "border-[#E6EBF2] bg-white text-[#1A3A6B] hover:border-[#A8C4E5]"
      }`}
    >
      {swatch && (
        <span
          className={`h-[9px] w-[9px] rounded-full ${active ? "ring-2 ring-white/35" : ""}`}
          style={{ background: swatch }}
        />
      )}
      {label}
    </button>
  );
}
