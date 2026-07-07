// VIFM logo assets for the proposal PDF, embedded as data URIs (Puppeteer
// renders the HTML via setContent, so relative /public URLs never resolve).
// Per the VIFM Brand Kit: the MONOCHROME (white) logo goes on dark
// backgrounds (the navy cover); the PRIMARY COLOR logo goes on light
// backgrounds. Reads are cached per process and tolerant - a missing file
// simply renders the document without a logo rather than failing the PDF.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type VifmLogoVariant = "white" | "color";

const FILES: Record<VifmLogoVariant, string> = {
  white: "vifm-logo-white.png",
  color: "vifm-logo-light.png",
};

const cache = new Map<VifmLogoVariant, string | null>();

export function getVifmLogoDataUri(variant: VifmLogoVariant): string | null {
  if (cache.has(variant)) return cache.get(variant) ?? null;
  let uri: string | null = null;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "images", FILES[variant]));
    uri = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    uri = null;
  }
  cache.set(variant, uri);
  return uri;
}
