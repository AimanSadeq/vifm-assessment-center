"use client";

import { useRouter } from "next/navigation";
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
  { value: "created_at", label: "Date Created" },
  { value: "name", label: "Name" },
  { value: "start_date", label: "Start Date" },
  { value: "client", label: "Client" },
];

export function ProjectListToolbar({ organizations, currentSort, currentDir, currentClient, currentStatus }: Props) {
  const router = useRouter();

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
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
          <SelectItem value="desc">Newest</SelectItem>
          <SelectItem value="asc">Oldest</SelectItem>
        </SelectContent>
      </Select>

      {organizations.length > 0 && (
        <Select
          value={currentClient}
          onValueChange={(val) => router.push(buildUrl({ client: val }))}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
