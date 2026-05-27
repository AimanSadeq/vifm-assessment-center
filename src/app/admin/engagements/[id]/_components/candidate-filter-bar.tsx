"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

type Props = {
  engagementId: string;
  candidates: Array<{ id: string; full_name: string }>;
  /** Currently-focused candidate id from the URL, or null for cohort view. */
  focused: string | null;
};

const COHORT = "__cohort__";

/**
 * Tiny client wrapper that swaps the `?candidate=<id>` URL search param
 * to drive the recommender panel above. Server re-renders with the
 * focused candidate's gaps; "Whole cohort" clears the param.
 *
 * Lives inline above the recommender card rather than inside it so
 * the panel itself can stay a pure server component.
 */
export function CandidateFilterBar({ engagementId, candidates, focused }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const handleChange = (value: string) => {
    if (value === COHORT) {
      router.push(pathname);
    } else {
      router.push(`${pathname}?candidate=${value}`);
    }
  };

  if (candidates.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">
        {t("adminEngagements.detail.recommendationsFor")}
      </span>
      <Select
        value={focused ?? COHORT}
        onValueChange={handleChange}
      >
        <SelectTrigger className="h-8 text-xs flex-1 min-w-0 max-w-md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={COHORT}>{t("adminEngagements.detail.wholeCohort")}</SelectItem>
          {candidates
            .slice()
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
