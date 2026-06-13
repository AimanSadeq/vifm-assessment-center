// ─────────────────────────────────────────────────────────────
// JD parsing engine — pluggable, vector-ready matcher (Decision 7).
//
// `JdMatcher` is the stable interface every caller uses. The keyword
// matcher ships now; a vector/hybrid matcher can drop in behind the
// same interface later with no re-authoring (it reads the same
// per-function descriptors). The engine ALWAYS returns a ranked
// shortlist for admin confirmation — never silent auto-deploy.
// ─────────────────────────────────────────────────────────────

export interface FunctionDescriptor {
  id: string;
  key: string | null;
  nodeId: string | null;
  nameEn: string;
  domainKey: string | null;
  keywords: string[];
  descriptor?: string | null;
  nodeStatus?: "active" | "inactive";
}

export interface JdMatch {
  functionId: string;
  key: string | null;
  nodeId: string | null;
  nameEn: string;
  domainKey: string | null;
  nodeStatus?: "active" | "inactive";
  score: number; // 0..1 normalized
  matchedKeywords: string[];
}

export interface JdMatcher {
  readonly name: string;
  match(jdText: string, descriptors: FunctionDescriptor[], limit?: number): JdMatch[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9&/+.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keyword-clustering matcher: counts distinct per-function keyword
 * phrases present in the JD, normalized by the function's keyword count
 * (so functions with more keywords are not unfairly advantaged).
 */
export const keywordMatcher: JdMatcher = {
  name: "keyword",
  match(jdText, descriptors, limit = 5) {
    const hay = ` ${normalize(jdText)} `;
    const results: JdMatch[] = descriptors.map((d) => {
      const kws = (d.keywords ?? []).map(normalize).filter(Boolean);
      const matched: string[] = [];
      for (const kw of kws) {
        if (kw.length < 2) continue;
        if (hay.includes(` ${kw} `) || hay.includes(`${kw} `) || hay.includes(` ${kw}`)) {
          matched.push(kw);
        }
      }
      const denom = Math.max(kws.length, 1);
      const score = matched.length / denom;
      return {
        functionId: d.id,
        key: d.key,
        nodeId: d.nodeId,
        nameEn: d.nameEn,
        domainKey: d.domainKey,
        nodeStatus: d.nodeStatus,
        score: Math.round(score * 1000) / 1000,
        matchedKeywords: [...new Set(matched)],
      };
    });
    return results
      .filter((r) => r.matchedKeywords.length > 0)
      .sort((a, b) => b.score - a.score || b.matchedKeywords.length - a.matchedKeywords.length)
      .slice(0, limit);
  },
};

/** Default matcher (swap here when a vector/hybrid matcher lands). */
export const defaultJdMatcher: JdMatcher = keywordMatcher;

export function matchJobDescription(
  jdText: string,
  descriptors: FunctionDescriptor[],
  opts?: { matcher?: JdMatcher; limit?: number },
): JdMatch[] {
  const matcher = opts?.matcher ?? defaultJdMatcher;
  return matcher.match(jdText, descriptors, opts?.limit ?? 5);
}
