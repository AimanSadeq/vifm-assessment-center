import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string; // omit on the current (last) crumb
};

/**
 * Lightweight breadcrumb strip for deep ARA routes. Pass an ordered
 * array of { label, href }. The last item should omit href (rendered
 * as plain text — the current page).
 *
 * Style is deliberately subtle — muted text, small chevron separators,
 * matches the existing ArrowLeft back-links in tone.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i === 0 && <Home className="h-3 w-3 me-0.5" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground font-medium" : ""}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/60" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
