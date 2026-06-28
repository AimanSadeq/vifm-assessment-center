import type { Sector, Region, Brand } from "./sample-data";

const SECTORS: Sector[] = ["government", "banking", "general"];
const REGIONS: Region[] = ["uae", "saudi"];

// Parse + validate the brand config the launcher encodes into the URL. Shared by
// the admin preview route and the public shareable route. Returns null when no
// org is given (the page then redirects to the launcher). The logo is restricted
// to http(s) URLs so the shareable link can't smuggle a non-image scheme into the
// <img src>.
export function parseBrandParams(
  sp: { org?: string; sector?: string; region?: string; accent?: string; logo?: string; featured?: string } | undefined,
): Brand | null {
  const org = (sp?.org ?? "").trim();
  if (!org) return null;

  const sector = (SECTORS.includes(sp?.sector as Sector) ? sp?.sector : "government") as Sector;
  const region = (REGIONS.includes(sp?.region as Region) ? sp?.region : "saudi") as Region;
  const rawAccent = sp?.accent ?? "";
  const accent = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : "#5391D5";
  const rawLogo = (sp?.logo ?? "").trim();
  const logo = /^https?:\/\//i.test(rawLogo) ? rawLogo : "";
  const featured = (sp?.featured ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    org,
    sector,
    region,
    accent,
    ...(logo ? { logo } : {}),
    ...(featured.length ? { featured } : {}),
  };
}
