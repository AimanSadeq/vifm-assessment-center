"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileDown, Languages, Users, Building2, Target, Layers } from "lucide-react";
import type {
  DashboardTree,
  DashboardNode,
  DashboardPerson,
  DashboardBand,
  DashboardLevel,
} from "@/lib/ara/dashboard-tree";
import type { AraIndividualFactorId } from "@/lib/constants/ara-individual-factors";

/**
 * ARC interactive dashboard - one component, opened at any level.
 *
 * Reads a DashboardTree (src/lib/ara/dashboard-tree.ts) and lets the viewer
 * drill organisation -> division -> department -> person with breadcrumbs.
 * Every number is the engine's number: this component never re-derives a
 * score, a band, or a level - it prints what the tree carries, and the tree
 * carries what the PDF reports print. Vocabulary (L1 Unaware..L5 Leading,
 * the 4.00 AI Ready target, band names) comes from tree.constants.
 *
 * Tabs appear only when there is something behind them: Units when the node
 * has children, People when the individual layer ran, Segments when enough
 * respondents answered the optional "about you" block, Training when the
 * recommender returned courses for a leaf.
 */

type Lang = "en" | "ar";
type Tab = "overview" | "units" | "people" | "segments" | "training";

export type ArcDashboardProps = {
  tree: DashboardTree;
  initialLang?: Lang;
  /** Where the top-left back affordance goes. */
  backHref: string;
  backLabel?: { en: string; ar: string };
  /** Consultant surface: show PDF links per node. Off on the public sample. */
  showPdfLinks?: boolean;
  /** Public sample: a short bilingual banner under the header. */
  sampleNote?: { en: string; ar: string };
};

const f2 = (n: number | null | undefined) => (typeof n === "number" ? n.toFixed(2) : "-");

export function ArcDashboard({ tree, initialLang = "en", backHref, backLabel, showPdfLinks = false, sampleNote }: ArcDashboardProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [path, setPath] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [personId, setPersonId] = useState<string | null>(null);
  const rtl = lang === "ar";
  const T = (en: string, ar: string) => (rtl ? ar : en);
  const name = (n: DashboardNode) => (rtl ? n.label_ar : n.label);

  const { node, crumbs } = useMemo(() => {
    const crumbs: DashboardNode[] = [tree.root];
    let cur = tree.root;
    for (const id of path) {
      const next = cur.children.find((c) => c.id === id);
      if (!next) break;
      crumbs.push(next);
      cur = next;
    }
    return { node: cur, crumbs };
  }, [tree.root, path]);

  const C = tree.constants;
  const pillarName = (id: string) => {
    const p = C.pillars.find((x) => x.id === id);
    return p ? (rtl ? p.name_ar : p.name_en) : id;
  };
  const factorName = (id: AraIndividualFactorId) => {
    const f = C.factors.find((x) => x.id === id);
    return f ? (rtl ? f.name_ar : f.name_en) : id;
  };
  const bandOf = (score: number | null): DashboardBand | null => {
    if (score === null) return null;
    let m = C.bands[0];
    for (const b of C.bands) if (score >= b.min) m = b;
    return m;
  };
  const levelOf = (score: number | null): DashboardLevel | null => {
    if (score === null) return null;
    let m = C.levels[0];
    for (const l of C.levels) if (score >= l.min) m = l;
    return m;
  };
  const levelText = (score: number | null) => {
    const l = levelOf(score);
    return l ? `L${l.level} ${rtl ? l.label_ar : l.label_en}` : "-";
  };
  const pooledFrom = (n: number) =>
    rtl ? (n === 2 ? "مجمّعة من وحدتين" : `مجمّعة من ${n} وحدات`) : `pooled from ${n} units`;
  const kindLabel = (k: DashboardNode["kind"]) =>
    k === "organisation" ? T("Organisation", "المؤسسة") : k === "division" ? T("Division", "القطاع") : T("Department", "الإدارة");

  const tabs: Array<{ id: Tab; label: string; on: boolean }> = [
    { id: "overview", label: T("Overview", "نظرة عامة"), on: true },
    { id: "units", label: T("Units by pillar", "الوحدات حسب الركيزة"), on: node.children.length > 0 },
    { id: "people", label: T("People", "الأفراد"), on: node.people.length > 0 },
    { id: "segments", label: T("Segments", "الشرائح"), on: node.segments.length > 0 },
    { id: "training", label: T("Training", "التدريب"), on: node.training.length > 0 },
  ];
  const activeTab: Tab = tabs.find((t) => t.id === tab && t.on) ? tab : "overview";

  const drill = (child: DashboardNode) => {
    setPath((p) => [...p, child.id]);
    setTab("overview");
    setPersonId(null);
  };
  const jump = (index: number) => {
    setPath((p) => p.slice(0, index));
    setTab("overview");
    setPersonId(null);
  };

  const atTarget = node.pillars.filter((p) => p.score >= C.target).length;
  const person = personId ? node.people.find((p) => p.id === personId) ?? null : null;
  const pdf = (n: DashboardNode) =>
    n.children.length > 0 ? `/api/ara/reports/${n.id}/rollup/pdf?language=` : `/api/ara/reports/${n.id}/pdf?language=`;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={`min-h-screen bg-background text-foreground ${rtl ? "font-arabic" : ""}`}>
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-white/75 hover:text-white">
              <ArrowLeft className={`h-4 w-4 ${rtl ? "rotate-180" : ""}`} />
              {backLabel ? (rtl ? backLabel.ar : backLabel.en) : T("Back", "رجوع")}
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-accent">{T("AI Readiness Compass", "بوصلة الجاهزية للذكاء الاصطناعي")} · {T("Dashboard", "لوحة المتابعة")}</div>
              <h1 className="mt-1 text-2xl font-semibold">{tree.organization_name ?? name(tree.root)}</h1>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/60">
              <button
                type="button"
                onClick={() => setLang(rtl ? "en" : "ar")}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                aria-label={T("Switch to Arabic", "التبديل إلى الإنجليزية")}
              >
                <Languages className="h-3.5 w-3.5" /> {rtl ? "English" : "العربية"}
              </button>
              <span>
              {T("Generated", "أُنشئت")} {new Date(tree.generated_at).toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {tree.is_sample && <span className="ms-2 rounded bg-amber-400/20 px-2 py-0.5 text-amber-200">{T("Sample data", "بيانات تجريبية")}</span>}
              </span>
            </div>
          </div>
        </div>
      </header>

      {sampleNote && (
        <div className="border-b bg-amber-50 text-amber-900">
          <div className="mx-auto max-w-7xl px-6 py-2 text-xs">{rtl ? sampleNote.ar : sampleNote.en}</div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label={T("Location", "الموقع")} className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className={`h-4 w-4 text-muted-foreground ${rtl ? "rotate-180" : ""}`} />}
              {i < crumbs.length - 1 ? (
                <button type="button" onClick={() => jump(i)} className="text-accent hover:underline">{name(c)}</button>
              ) : (
                <span className="font-semibold text-primary">{name(c)}</span>
              )}
            </span>
          ))}
          <span className="ms-2 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{kindLabel(node.kind)}{node.pooled && node.children.length > 0 ? ` · ${pooledFrom(node.children.length)}` : ""}</span>
          {showPdfLinks && (
            <span className="ms-auto inline-flex items-center gap-2 text-xs">
              <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
              <a className="text-accent hover:underline" href={`${pdf(node)}en`}>PDF EN</a>
              <a className="text-accent hover:underline" href={`${pdf(node)}ar`}>PDF AR</a>
            </span>
          )}
        </nav>

        {/* Summary tiles */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            icon={<Target className="h-4 w-4" />}
            label={T("Overall readiness", "الجاهزية الإجمالية")}
            value={f2(node.overall)}
            sub={node.band ? `${rtl ? node.band.label_ar : node.band.label_en} · ${levelText(node.overall)}` : T("No scores yet", "لا توجد درجات بعد")}
            color={node.band?.color}
          />
          <Tile icon={<Users className="h-4 w-4" />} label={T("Respondents", "المستجيبون")} value={String(node.respondents)} sub={T("completed", "أكملوا التقييم")} />
          {node.children.length > 0 ? (
            <Tile icon={<Building2 className="h-4 w-4" />} label={T("Units beneath", "الوحدات التابعة")} value={String(node.children.length)} sub={node.children.map(name).slice(0, 3).join(" · ") + (node.children.length > 3 ? " …" : "")} />
          ) : (
            <Tile icon={<Users className="h-4 w-4" />} label={T("Individual layer", "الطبقة الفردية")} value={node.people.length > 0 ? String(node.people.length) : "-"} sub={node.people.length > 0 ? T("people with a personal report", "أفراد لديهم تقرير شخصي") : T("not run here", "لم تُفعَّل هنا")} />
          )}
          <Tile
            icon={<Layers className="h-4 w-4" />}
            label={T("Pillars at target", "الركائز عند المستهدف")}
            value={`${atTarget} / ${node.pillars.length}`}
            sub={`${T("target", "المستهدف")} ${C.target.toFixed(2)} ${T("AI Ready", "جاهز للذكاء الاصطناعي")}`}
          />
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.filter((t) => t.on).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setPersonId(null); }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${activeTab === t.id ? "border-accent font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
          {node.people.length > 0 && node.segments.length === 0 && (
            <span className="ms-auto self-center text-[11px] text-muted-foreground">
              {node.segmentsAnswered === 0
                ? T("Segments: nobody answered the optional \"about you\" block.", "الشرائح: لم يُجب أحد على قسم \"عنك\" الاختياري.")
                : T(`Segments: ${node.segmentsAnswered} answered; no group reaches the minimum of ${C.segment_min_n}.`, `الشرائح: أجاب ${node.segmentsAnswered}؛ لا تبلغ أي مجموعة الحد الأدنى ${C.segment_min_n}.`)}
            </span>
          )}
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3" title={T("Readiness by pillar", "الجاهزية حسب الركيزة")} sub={T("Scores on the 1-5 maturity scale against the 4.00 target.", "الدرجات على مقياس النضج من 1 إلى 5 مقابل المستهدف 4.00.")}>
              {node.pillars.length === 0 ? (
                <Empty>{T("No pillar scores yet.", "لا توجد درجات للركائز بعد.")}</Empty>
              ) : (
                <ul className="space-y-3">
                  {node.pillars.map((p) => (
                    <li key={p.id}>
                      <Bar label={pillarName(p.id)} value={p.score} target={C.target} color={bandOf(p.score)?.color ?? "#5391D5"} right={`${f2(p.score)} · ${levelText(p.score)}`} rtl={rtl} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-6 lg:col-span-2">
              {node.children.length > 0 && (
                <Card title={T("Units ranked", "ترتيب الوحدات")} sub={T("Strongest first. Click a unit to open it.", "الأقوى أولاً. انقر على وحدة لفتحها.")}>
                  <ol className="divide-y">
                    {node.children.map((c, i) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => drill(c)} className="flex w-full items-center gap-3 py-2 text-start hover:bg-muted/50">
                          <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                          <span className="flex-1">
                            <span className="block text-sm font-medium">{name(c)}</span>
                            <span className="block text-[11px] text-muted-foreground">{c.respondents} {T("respondents", "مستجيب")}{c.children.length > 0 ? ` · ${c.children.length} ${T("departments", "إدارات")}` : ""}</span>
                          </span>
                          <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ background: c.band?.color ?? "#94a3b8" }}>{f2(c.overall)}</span>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground ${rtl ? "rotate-180" : ""}`} />
                        </button>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
              {node.workforce && (
                <Card title={T("Workforce readiness", "جاهزية القوى العاملة")} sub={T(`Four-factor means over ${node.people.length} people who completed the individual layer.`, `متوسط العوامل الأربعة لـ ${node.people.length} فرداً أكملوا الطبقة الفردية.`)}>
                  <div className="mb-3 text-3xl font-semibold text-primary">{f2(node.workforce.overall)} <span className="text-sm font-normal text-muted-foreground">/ 5</span></div>
                  <ul className="space-y-3">
                    {C.factors.map((fa) => (
                      <li key={fa.id}>
                        <Bar label={rtl ? fa.name_ar : fa.name_en} value={node.workforce?.factors[fa.id] ?? null} target={C.target} color={fa.color} right={f2(node.workforce?.factors[fa.id])} rtl={rtl} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {node.children.length === 0 && !node.workforce && (
                <Card title={T("Reading this page", "قراءة هذه الصفحة")}>
                  <p className="text-sm text-muted-foreground">{T("Each pillar is scored 1 to 5 from the unit's respondents. The 4.00 line is the AI Ready target; bars short of it are the gaps the report sequences.", "تُقيَّم كل ركيزة من 1 إلى 5 من إجابات مستجيبي الوحدة. خط 4.00 هو مستهدف الجاهزية؛ الأعمدة التي لا تبلغه هي الفجوات التي يرتبها التقرير.")}</p>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === "units" && (
          <Card title={T("Every unit against every pillar", "كل وحدة مقابل كل ركيزة")} sub={T("Cell colour is the maturity band. A dash means the pillar was not in that unit's scope.", "لون الخلية هو نطاق النضج. الشرطة تعني أن الركيزة لم تكن ضمن نطاق تلك الوحدة.")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-2 text-start font-medium">{T("Unit", "الوحدة")}</th>
                    <th className="py-2 text-center font-medium">{T("Overall", "الإجمالي")}</th>
                    {node.pillars.map((p) => <th key={p.id} className="px-1 py-2 text-center font-medium">{pillarName(p.id)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {node.children.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">
                        <button type="button" onClick={() => drill(c)} className="text-accent hover:underline">{name(c)}</button>
                        <div className="text-[11px] text-muted-foreground">{c.respondents} {T("respondents", "مستجيب")}</div>
                      </td>
                      <td className="py-2 text-center font-semibold">{f2(c.overall)}</td>
                      {node.pillars.map((p) => {
                        const s = c.pillars.find((x) => x.id === p.id)?.score ?? null;
                        return (
                          <td key={p.id} className="px-1 py-2 text-center">
                            {s === null ? <span className="text-muted-foreground">-</span> : (
                              <span className="inline-block min-w-[3.25rem] rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: bandOf(s)?.color ?? "#94a3b8" }}>{f2(s)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/40">
                    <td className="py-2 font-semibold">{name(node)}</td>
                    <td className="py-2 text-center font-semibold">{f2(node.overall)}</td>
                    {node.pillars.map((p) => <td key={p.id} className="px-1 py-2 text-center text-xs font-semibold">{f2(p.score)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "people" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3" title={T("People", "الأفراد")} sub={T("Everyone who completed the individual layer. Click a name for their four factors.", "كل من أكمل الطبقة الفردية. انقر على الاسم لعرض عوامله الأربعة.")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-2 text-start font-medium">{T("Name", "الاسم")}</th>
                      <th className="py-2 text-center font-medium">{T("Overall", "الإجمالي")}</th>
                      <th className="py-2 text-start font-medium">{T("Stage", "المرحلة")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...node.people].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)).map((p) => (
                      <tr key={p.id} className={`border-t ${personId === p.id ? "bg-muted/50" : ""}`}>
                        <td className="py-2">
                          <button type="button" onClick={() => setPersonId(p.id)} className="text-accent hover:underline">{p.name}</button>
                          {p.individual_only && <span className="ms-2 text-[10px] text-muted-foreground">{T("individual only", "فردي فقط")}</span>}
                        </td>
                        <td className="py-2 text-center font-semibold">{f2(p.overall)}</td>
                        <td className="py-2">{p.stage ? (rtl ? p.stage.name_ar : p.stage.name_en) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="lg:col-span-2">
              {person ? <PersonPanel person={person} factorName={factorName} factors={C.factors} target={C.target} rtl={rtl} T={T} /> : (
                <Card title={T("Select a person", "اختر شخصاً")}>
                  <p className="text-sm text-muted-foreground">{T("Their four-factor profile appears here. The full individual report is the PDF the consultant delivers.", "يظهر هنا ملف العوامل الأربعة. التقرير الفردي الكامل هو ملف PDF الذي يسلّمه المستشار.")}</p>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === "segments" && (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              {T(`Optional self-declared segments from ${node.segmentsAnswered} of ${node.people.length} people. Groups smaller than ${C.segment_min_n} are not shown. Aggregates only - nothing here is per person.`, `شرائح اختيارية صرّح بها ${node.segmentsAnswered} من ${node.people.length} فرداً. لا تُعرض المجموعات الأصغر من ${C.segment_min_n}. مجاميع فقط - لا شيء هنا على مستوى الفرد.`)}
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {node.segments.map((dim) => (
                <Card key={dim.id} title={rtl ? dim.label_ar : dim.label_en}>
                  <ul className="space-y-3">
                    {dim.slices.map((s) => (
                      <li key={s.key}>
                        <Bar label={`${rtl ? s.label_ar : s.label_en} (${s.n})`} value={s.overall} target={C.target} color={bandOf(s.overall)?.color ?? "#5391D5"} right={f2(s.overall)} rtl={rtl} />
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {C.factors.map((fa) => <span key={fa.id}>{rtl ? fa.name_ar : fa.name_en}: <b className="text-foreground">{f2(s.factors[fa.id])}</b></span>)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "training" && (
          <Card title={T("Recommended VIFM training", "برامج VIFM التدريبية الموصى بها")} sub={T("Ranked by the pillar gaps of this unit. The report's Next Steps carry the same list.", "مرتبة حسب فجوات ركائز هذه الوحدة. تحمل خطوات التقرير التالية القائمة نفسها.")}>
            <ul className="grid gap-3 md:grid-cols-2">
              {node.training.map((c, i) => (
                <li key={`${c.code ?? i}`} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{c.code ?? ""}{c.code ? " · " : ""}{c.duration_days} {T("days", "أيام")}</div>
                  <div className="mt-0.5 text-sm font-semibold text-primary">{(rtl && c.title_ar) || c.title_en}</div>
                  {c.drivers.length > 0 && <div className="mt-1 text-[11px] text-muted-foreground">{T("Addresses", "يعالج")}: {c.drivers.join(" · ")}</div>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}

function Tile({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-3xl font-semibold text-primary" style={color ? { color } : undefined}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className}`}>
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      {sub && <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Bar({ label, value, target, color, right, rtl }: { label: string; value: number | null; target: number; color: string; right: string; rtl: boolean }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100));
  const tpct = (target / 5) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{right}</span>
      </div>
      <div className="relative mt-1 h-2.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full" style={{ width: `${pct}%`, background: color, [rtl ? "right" : "left"]: 0 }} />
        <div className="absolute -top-1 h-[1.125rem] w-px bg-primary/60" style={{ [rtl ? "right" : "left"]: `${tpct}%` }} title={`${target.toFixed(2)}`} />
      </div>
    </div>
  );
}

function PersonPanel({ person, factorName, factors, target, rtl, T }: {
  person: DashboardPerson;
  factorName: (id: AraIndividualFactorId) => string;
  factors: DashboardTree["constants"]["factors"];
  target: number;
  rtl: boolean;
  T: (en: string, ar: string) => string;
}) {
  return (
    <Card title={person.name} sub={person.stage ? `${T("Stage", "المرحلة")}: ${rtl ? person.stage.name_ar : person.stage.name_en} · ${T("overall", "الإجمالي")} ${f2(person.overall)}` : T("No factor scores yet", "لا توجد درجات للعوامل بعد")}>
      <ul className="space-y-3">
        {factors.map((fa) => (
          <li key={fa.id}>
            <Bar label={factorName(fa.id)} value={person.factors[fa.id]} target={target} color={fa.color} right={f2(person.factors[fa.id])} rtl={rtl} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground">{T("Self-rated and demonstrated sub-scores, development priorities and the 30/60/90-day plan are in the individual report PDF.", "الدرجات الفرعية للتقييم الذاتي والمُثبت وأولويات التطوير وخطة 30/60/90 يوماً موجودة في التقرير الفردي PDF.")}</p>
    </Card>
  );
}
