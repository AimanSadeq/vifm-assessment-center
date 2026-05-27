"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  organizations: { id: string; name: string }[];
  currentSort: string;
  currentDir: string;
  currentClient: string;
  currentStatus: string;
};

const SORT_OPTIONS = [
  { value: "created_at", labelKey: "adminEngagements.toolbar.sortDateCreated" },
  { value: "name", labelKey: "adminEngagements.toolbar.sortName" },
  { value: "start_date", labelKey: "adminEngagements.toolbar.sortStartDate" },
  { value: "client", labelKey: "adminEngagements.toolbar.sortClient" },
];

export function ProjectListToolbar({ organizations, currentSort, currentDir, currentClient, currentStatus }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = {
      status: currentStatus,
      sort: currentSort,
      dir: currentDir,
      client: currentClient,
      ...overrides,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== "all" && v !== "created_at" && !(k === "dir" && v === "desc")) {
        params.set(k, v);
      }
    });
    const qs = params.toString();
    return `/admin/engagements${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mt-3 flex gap-2 flex-wrap items-center">
      <Select
        value={currentSort}
        onValueChange={(val) => router.push(buildUrl({ sort: val }))}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder={t("adminEngagements.toolbar.sortPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentDir}
        onValueChange={(val) => router.push(buildUrl({ dir: val }))}
      >
        <SelectTrigger className="w-[100px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">{t("adminEngagements.toolbar.dirNewest")}</SelectItem>
          <SelectItem value="asc">{t("adminEngagements.toolbar.dirOldest")}</SelectItem>
        </SelectContent>
      </Select>

      {organizations.length > 0 && (
        <Select
          value={currentClient}
          onValueChange={(val) => router.push(buildUrl({ client: val }))}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder={t("adminEngagements.toolbar.allClients")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminEngagements.toolbar.allClients")}</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
