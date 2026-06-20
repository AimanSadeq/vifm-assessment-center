import { z } from "zod";

/**
 * Permissive UUID-shape regex. The VIFM seed data uses synthetic but
 * format-valid UUIDs whose version/variant nibbles are 0, e.g.
 *   competencies     a0000001-0000-0000-0000-000000000001
 *   clusters/domains c1000001-... / d0000001-...
 *   role profiles    00000001-aaaa-0000-0000-000000000001
 * Zod 4's strict `z.string().uuid()` validates the RFC version+variant nibbles,
 * so it REJECTS every one of these. Any id that ORIGINATES from the seed
 * (competencies, clusters, domains, role profiles, seeded orgs) must be checked
 * with this shape, not `.uuid()`, or the parse fails with a hidden field error
 * ("Invalid requisition" / "Invalid input"). Accepts canonical 8-4-4-4-12 hex;
 * still rejects obvious junk (wrong length, non-hex). App-generated real UUIDs
 * pass too, so this is always a safe substitute when seed ids can flow in.
 */
export const UUID_SHAPE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** A Zod string that accepts any UUID-shaped id, including synthetic seed ids. */
export const uuidish = (message = "Invalid id") => z.string().regex(UUID_SHAPE, message);
