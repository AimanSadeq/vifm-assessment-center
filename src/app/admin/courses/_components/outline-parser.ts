import type {
  VifmCourseOutlineSection,
  VifmCourseOutlineSubsection,
  VifmCourseOutlineBullet,
} from "@/types/database";

/**
 * Parses a markdown-style block-6 outline string into the structured
 * VifmCourseOutlineSection shape used in vifm_courses.outline_en/ar.
 *
 * Syntax:
 *   # MAIN HEADER          → starts a new top-level section
 *   ## Sub-header          → starts a new subsection inside the current section
 *   - Bullet               → bullet inside the current section / subsection
 *     - Sub-bullet         → 2-or-more space indent + dash = sub-bullet of the previous bullet
 *
 * The parser is forgiving: leading/trailing whitespace, blank lines,
 * and mixed indentation (2 or 4 spaces) are all tolerated.
 *
 * Empty input returns an empty array. The reverse operation lives in
 * outlineToText() so the form can round-trip.
 */
export function parseOutlineText(raw: string): VifmCourseOutlineSection[] {
  const lines = raw.split(/\r?\n/);
  const sections: VifmCourseOutlineSection[] = [];

  let currentSection: VifmCourseOutlineSection | null = null;
  let currentSubsection: VifmCourseOutlineSubsection | null = null;
  let lastBullet: VifmCourseOutlineBullet | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim() === "") {
      continue;
    }

    // Main header: # TITLE
    const mainMatch = line.match(/^#\s+(.+)$/);
    if (mainMatch) {
      currentSection = { main_header: mainMatch[1].trim() };
      currentSubsection = null;
      lastBullet = null;
      sections.push(currentSection);
      continue;
    }

    // Sub-header: ## TITLE
    const subMatch = line.match(/^##\s+(.+)$/);
    if (subMatch) {
      if (!currentSection) {
        // Sub-header before any main header - ignore (could also error).
        continue;
      }
      currentSection.subsections ??= [];
      // If this section was using flat bullets, stop - Shape A and
      // Shape B are mutually exclusive per section. Drop bullets to
      // honour the constraint, since this section is now Shape B.
      delete currentSection.bullets;
      currentSubsection = {
        sub_header: subMatch[1].trim(),
        bullets: [],
      };
      currentSection.subsections.push(currentSubsection);
      lastBullet = null;
      continue;
    }

    // Bullet: leading whitespace + dash
    const bulletMatch = line.match(/^(\s*)[-•*]\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[2].trim();
      const isSubBullet = indent >= 2;

      if (isSubBullet && lastBullet) {
        lastBullet.sub_bullets ??= [];
        lastBullet.sub_bullets.push(text);
        continue;
      }

      // Top-level bullet - attach to current subsection (if any) or section.
      if (!currentSection) continue;
      const bullet: VifmCourseOutlineBullet = { text };
      if (currentSubsection) {
        currentSubsection.bullets.push(bullet);
      } else {
        currentSection.bullets ??= [];
        currentSection.bullets.push(bullet);
      }
      lastBullet = bullet;
      continue;
    }

    // Anything else: ignore. Free-form text outside the syntax is dropped
    // rather than guessed at - admins should follow the format.
  }

  return sections;
}

export function outlineToText(outline: VifmCourseOutlineSection[] | null | undefined): string {
  if (!outline || outline.length === 0) return "";
  const lines: string[] = [];
  for (const section of outline) {
    lines.push(`# ${section.main_header}`);
    if (section.subsections && section.subsections.length > 0) {
      for (const sub of section.subsections) {
        lines.push(`## ${sub.sub_header}`);
        for (const b of sub.bullets) {
          lines.push(`- ${b.text}`);
          for (const sb of b.sub_bullets ?? []) {
            lines.push(`  - ${sb}`);
          }
        }
      }
    } else if (section.bullets && section.bullets.length > 0) {
      for (const b of section.bullets) {
        lines.push(`- ${b.text}`);
        for (const sb of b.sub_bullets ?? []) {
          lines.push(`  - ${sb}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
