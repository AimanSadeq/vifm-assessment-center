import { AlertTriangle } from "lucide-react";
import { PROVISIONAL_COPY } from "@/lib/ara/provisional";

/**
 * Print-safe provisional strip for PDF/report surfaces (inline styles, since the
 * report pages are laid out with inline styles for Puppeteer). Renders EN, AR, or
 * both stacked (bilingual report).
 */
export function ProvisionalReportStrip({ language }: { language: "en" | "ar" | "bilingual" }) {
  const box = (lang: "en" | "ar") => {
    const c = PROVISIONAL_COPY[lang];
    return (
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{
          border: "1px solid #f59e0b",
          background: "#fffbeb",
          color: "#78350f",
          borderRadius: "6pt",
          padding: "8pt 10pt",
          marginBottom: "8pt",
          fontSize: "9pt",
          lineHeight: 1.4,
        }}
      >
        <strong>{c.title}</strong>
        <div style={{ marginTop: "2pt" }}>{c.body}</div>
      </div>
    );
  };
  return (
    <div style={{ padding: "12pt 12pt 0" }}>
      {language === "bilingual" ? (
        <>
          {box("en")}
          {box("ar")}
        </>
      ) : (
        box(language)
      )}
    </div>
  );
}

/**
 * "Provisional - content pending SME review" banner. Rendered on ARC result
 * surfaces (and reusable elsewhere) whenever the assessment served questions an
 * SME has not yet approved. Server component, bilingual, RTL-aware.
 */
export function ProvisionalBanner({
  language = "en",
  pending,
  total,
  className,
}: {
  language?: "en" | "ar";
  pending?: number;
  total?: number;
  className?: string;
}) {
  const isAr = language === "ar";
  const c = PROVISIONAL_COPY[isAr ? "ar" : "en"];
  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 ${className ?? ""}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{c.title}</p>
          <p className="mt-0.5 text-xs leading-snug">{c.body}</p>
          {typeof pending === "number" && pending > 0 && typeof total === "number" && total > 0 && (
            <p className="mt-1 text-[11px] font-medium tabular-nums opacity-80">
              {pending}/{total}{" "}
              {isAr ? "من الأسئلة المقدَّمة قيد المراجعة" : "of the questions served are pending review"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
