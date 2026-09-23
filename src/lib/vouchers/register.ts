import { createServiceClient } from "@/lib/supabase/server";

/**
 * The voucher register: every code any Caliber service has ever issued, in one
 * list, answering four questions per row - which service, which company, has it
 * been redeemed, and who issued it.
 *
 * Eight services keep eight voucher tables with eight slightly different shapes.
 * This module reads each one into a common row rather than changing any table,
 * so the per-service managers keep working untouched. Every read is tolerant of
 * a table being absent in an environment: that service simply contributes no
 * rows and is reported as unavailable.
 */

import type { RegisterService, RegisterStatus, VoucherRegister, VoucherRegisterRow } from "./register-types";

export type { RegisterService, RegisterStatus, VoucherRegister, VoucherRegisterRow } from "./register-types";

type Sb = ReturnType<typeof createServiceClient>;
type Raw = Record<string, unknown>;

const PAGE = 1000;

/** Read a whole table in pages. PostgREST caps a single request at 1000 rows,
 *  and an uncapped read that silently stops at 1000 is how a register lies. */
async function readAll(sb: Sb, table: string, select: string): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Raw[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

function deriveStatus(statusCol: unknown, redeemed: number, seats: number, expiresAt: string | null, now: number): RegisterStatus {
  const s = (str(statusCol) ?? "").toLowerCase();
  if (s === "revoked" || s === "cancelled" || s === "disabled" || s === "archived") return "revoked";
  if (seats > 0 && redeemed >= seats) return "fully_redeemed";
  if (expiresAt && Date.parse(expiresAt) < now) return "expired";
  if (redeemed > 0) return "partly_redeemed";
  return "unused";
}

/** Name lookups shared across services, fetched once. */
type Lookups = {
  people: Map<string, { name: string; role: string | null }>;
  orgs: Map<string, string>;
  araOrgs: Map<string, string>;
};

async function loadLookups(sb: Sb): Promise<Lookups> {
  const people = new Map<string, { name: string; role: string | null }>();
  const orgs = new Map<string, string>();
  const araOrgs = new Map<string, string>();
  await Promise.all([
    readAll(sb, "profiles", "id, full_name, email, role")
      .then((rows) => {
        for (const r of rows) {
          const id = str(r.id);
          if (!id) continue;
          people.set(id, { name: str(r.full_name) ?? str(r.email) ?? "Unnamed user", role: str(r.role) });
        }
      })
      .catch(() => undefined),
    readAll(sb, "organizations", "id, name, created_at")
      .then((rows) => rows.forEach((r) => { const id = str(r.id); const n = str(r.name); if (id && n) orgs.set(id, n); }))
      .catch(() => undefined),
    readAll(sb, "ara_organizations", "id, name, created_at")
      .then((rows) => rows.forEach((r) => { const id = str(r.id); const n = str(r.name); if (id && n) araOrgs.set(id, n); }))
      .catch(() => undefined),
  ]);
  return { people, orgs, araOrgs };
}

function companyOf(r: Raw, lk: Lookups, fallback?: string | null): string {
  return (
    str(r.client_name) ??
    str(r.organization_name) ??
    (str(r.organization_id) ? lk.orgs.get(str(r.organization_id)!) ?? lk.araOrgs.get(str(r.organization_id)!) ?? null : null) ??
    fallback ??
    "-"
  );
}

function issuerOf(r: Raw, lk: Lookups): { issuedBy: string; issuedByRole: string | null } {
  const id = str(r.created_by);
  if (!id) return { issuedBy: "Not recorded", issuedByRole: null };
  const p = lk.people.get(id);
  return p ? { issuedBy: p.name, issuedByRole: p.role } : { issuedBy: "Unknown user", issuedByRole: null };
}

type ServiceSpec = {
  service: RegisterService;
  table: string;
  select: string;
  /** Column holding the redeemed count - most tables say used_count, two say uses. */
  usedCol: "used_count" | "uses";
  scope?: (r: Raw, extra: Map<string, Raw>) => string | null;
  /** Company fallback for services that reach their organisation through another table. */
  companyVia?: (r: Raw, extra: Map<string, Raw>, lk: Lookups) => string | null;
  /** A secondary table to read for scope / company resolution, keyed by id. */
  extra?: { table: string; select: string };
};

const BASE = "id, code, label, created_by, max_uses, expires_at, created_at";

const SPECS: ServiceSpec[] = [
  {
    service: "arc",
    table: "ara_vouchers",
    select: `${BASE}, used_count, status, client_name, organization_id, tier, is_practice`,
    usedCol: "used_count",
    scope: (r) => {
      const tier = str(r.tier);
      return tier ? `${tier}${r.is_practice ? " (practice)" : ""}` : null;
    },
  },
  {
    service: "technical",
    table: "technical_sandbox_vouchers",
    select: `${BASE}, used_count, status, organization_name, organization_id, function_id`,
    usedCol: "used_count",
    extra: { table: "technical_functions", select: "id, name_en, created_at" },
    scope: (r, fx) => str(fx.get(str(r.function_id) ?? "")?.name_en),
  },
  {
    service: "fluent",
    table: "eng_fluent_vouchers",
    select: `${BASE}, used_count, status, client_name, organization_id`,
    usedCol: "used_count",
  },
  {
    service: "cognitive",
    table: "cognitive_vouchers",
    select: `${BASE}, used_count, status, client_name, organization_id, project_label`,
    usedCol: "used_count",
    scope: (r) => str(r.project_label),
  },
  {
    service: "persona",
    table: "persona_vouchers",
    select: `${BASE}, used_count, status, client_name, organization_id, project_label, purpose, scoped_competency_ids`,
    usedCol: "used_count",
    scope: (r) => {
      const parts: string[] = [];
      const purpose = str(r.purpose);
      if (purpose) parts.push(purpose);
      const scope = Array.isArray(r.scoped_competency_ids) ? r.scoped_competency_ids.length : 0;
      parts.push(scope > 0 ? `${scope} competencies` : "full framework");
      const pl = str(r.project_label);
      if (pl) parts.push(pl);
      return parts.join(" - ");
    },
  },
  {
    service: "prehire",
    table: "prehire_vouchers",
    select: `${BASE}, used_count, status, organization_name, requisition_id`,
    usedCol: "used_count",
    extra: { table: "prehire_requisitions", select: "id, title, organization_id, created_at" },
    scope: (r, fx) => str(fx.get(str(r.requisition_id) ?? "")?.title),
    companyVia: (r, fx, lk) => {
      const orgId = str(fx.get(str(r.requisition_id) ?? "")?.organization_id);
      return orgId ? lk.orgs.get(orgId) ?? null : null;
    },
  },
  {
    service: "role_readiness",
    table: "rr_vouchers",
    select: `${BASE}, uses, client_name, organization_id, role_config_id, project_label, is_sample`,
    usedCol: "uses",
    extra: { table: "rr_role_configs", select: "id, name_en, organization_id, created_at" },
    scope: (r, fx) => str(fx.get(str(r.role_config_id) ?? "")?.name_en),
    companyVia: (r, fx, lk) => {
      const orgId = str(fx.get(str(r.role_config_id) ?? "")?.organization_id);
      return orgId ? lk.orgs.get(orgId) ?? null : null;
    },
  },
  {
    service: "bundle",
    table: "bundle_vouchers",
    select: `${BASE}, uses, organization_id, bespoke_service_id, is_sample`,
    usedCol: "uses",
    extra: { table: "bespoke_services", select: "id, name_en, organization_id, created_at" },
    scope: (r, fx) => str(fx.get(str(r.bespoke_service_id) ?? "")?.name_en),
    companyVia: (r, fx, lk) => {
      const orgId = str(fx.get(str(r.bespoke_service_id) ?? "")?.organization_id);
      return orgId ? lk.orgs.get(orgId) ?? null : null;
    },
  },
];

export async function loadVoucherRegister(): Promise<VoucherRegister> {
  const sb = createServiceClient();
  const now = Date.now();
  const lk = await loadLookups(sb);
  const unavailable: RegisterService[] = [];
  const rows: VoucherRegisterRow[] = [];

  await Promise.all(
    SPECS.map(async (spec) => {
      try {
        const [raw, extraRows] = await Promise.all([
          readAll(sb, spec.table, spec.select),
          spec.extra ? readAll(sb, spec.extra.table, spec.extra.select).catch(() => [] as Raw[]) : Promise.resolve([] as Raw[]),
        ]);
        const extra = new Map<string, Raw>();
        for (const e of extraRows) {
          const id = str(e.id);
          if (id) extra.set(id, e);
        }
        for (const r of raw) {
          const seats = num(r.max_uses);
          const redeemed = num(r[spec.usedCol]);
          const expiresAt = str(r.expires_at);
          const { issuedBy, issuedByRole } = issuerOf(r, lk);
          rows.push({
            id: String(r.id),
            service: spec.service,
            code: str(r.code) ?? "-",
            label: str(r.label),
            scope: spec.scope ? spec.scope(r, extra) : null,
            company: companyOf(r, lk, spec.companyVia ? spec.companyVia(r, extra, lk) : null),
            seats,
            redeemed,
            status: deriveStatus(r.status, redeemed, seats, expiresAt, now),
            issuedBy,
            issuedByRole,
            issuedAt: str(r.created_at) ?? "",
            expiresAt,
            isSample: r.is_sample === true,
          });
        }
      } catch {
        unavailable.push(spec.service);
      }
    }),
  );

  rows.sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : a.issuedAt > b.issuedAt ? -1 : 0));
  return { rows, unavailable, loadedAt: new Date(now).toISOString() };
}
