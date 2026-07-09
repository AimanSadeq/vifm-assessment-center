// Server-side sanitizer for the proposal section editor's rich text. The editor is a
// contentEditable (admin-only) whose HTML flows into the Puppeteer/Chromium PDF render,
// so it MUST be sanitized to a strict inline-formatting allowlist before it is injected -
// no scripts, event handlers, style/link/iframe, or external resources. Applied both on
// save (updateProposalSectionOverrides) and on render (defence in depth).

import sanitizeHtml from "sanitize-html";

// Colours: hex, rg[b|a](), or a CSS colour keyword (letters only).
const COLOR = [/^#(0x)?[0-9a-f]+$/i, /^rgba?\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i, /^[a-z]+$/i];
// Sizes: px / pt / em / rem / % / CSS keyword (xx-small ... xx-large, larger, smaller).
const SIZE = [/^\d+(\.\d+)?(px|pt|em|rem|%)$/i, /^(xx?-)?(small|large)$/i, /^(medium|larger|smaller)$/i];

const RICH_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "i", "u", "s", "strong", "em", "span", "p", "br", "ul", "ol", "li", "h3", "h4", "sub", "sup", "a"],
  allowedAttributes: {
    span: ["style"],
    p: ["style"],
    li: ["style"],
    h3: ["style"],
    h4: ["style"],
    a: ["href", "target", "rel"],
  },
  allowedStyles: {
    "*": {
      color: COLOR,
      "background-color": COLOR,
      "font-size": SIZE,
      "font-weight": [/^(bold|bolder|lighter|normal|[1-9]00)$/i],
      "font-style": [/^(italic|normal|oblique)$/i],
      "text-decoration": [/^(underline|line-through|none|overline)(\s+\w+)*$/i],
      "text-decoration-line": [/^(underline|line-through|none|overline)$/i],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Drop the contents of anything not on the allowlist (e.g. <script>text</script> -> "").
  disallowedTagsMode: "discard",
  // Force safe link behaviour.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true),
  },
};

/** Sanitize contentEditable HTML down to the safe inline-formatting allowlist. */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, RICH_OPTS).trim();
}

/** True when a stored override is HTML (rich text) rather than the legacy markdown-lite
 *  plain text - lets the renderer pick the inject-HTML path vs renderOverride(). */
export function isRichHtml(value: string | null | undefined): boolean {
  return !!value && /<(b|i|u|s|strong|em|span|p|br|ul|ol|li|h3|h4|sub|sup|a)\b[^>]*>/i.test(value);
}
