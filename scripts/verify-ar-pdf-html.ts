/**
 * Standalone verification of the Arabic personal-snapshot HTML
 * renderer. Writes a static HTML file to disk so we can open it
 * directly in Chrome and confirm layout + RTL shaping before
 * letting Puppeteer drive it.
 *
 * Run: npx tsx scripts/verify-ar-pdf-html.ts <output-path>
 */

import fs from "fs";
import path from "path";
import { renderPersonalSnapshotHtmlAr } from "../src/lib/reports/personal-snapshot-ar-html";

const out = process.argv[2] || "tmp-ar-pdf.html";

// Mid-range sample data: scores below target so courses populate.
const html = renderPersonalSnapshotHtmlAr({
  respondentName: "أحمد محمد",
  respondentEmail: "ahmad@example.com",
  generatedAt: "١٥ مايو ٢٠٢٦",
  overallScore: 2.5,
  factorScores: {
    thinking_sense_check: 2.0,
    results_working_practice: 3.0,
    people_collaboration: 2.5,
    self_adaptive_mindset: 2.5,
  },
  recommendedCourses: [
    {
      course_id: "demo-1",
      title_en: "Strategic Thinking and Planning",
      title_ar: "التفكير الاستراتيجي والتخطيط",
      code: "STP-301",
      vertical: "strategy",
      level: "intermediate",
      duration_label: "2–5d",
      total_score: 28,
      drivers: [
        { label: "تحقّق الذكاء الاصطناعي", gap: 2, relevance: 3 },
        { label: "ممارسة العمل بالذكاء الاصطناعي", gap: 1, relevance: 3 },
        { label: "التعاون مع الذكاء الاصطناعي", gap: 1.5, relevance: 2 },
      ],
    },
    {
      course_id: "demo-2",
      title_en: "Certified Strategic Business Intelligence Partner",
      title_ar: "شريك معتمد في ذكاء الأعمال الاستراتيجي",
      code: "CSBIP",
      vertical: "business_intelligence",
      level: "advanced",
      duration_label: "2–5d",
      total_score: 22,
      drivers: [
        { label: "تحقّق الذكاء الاصطناعي", gap: 2, relevance: 3 },
        { label: "التعاون مع الذكاء الاصطناعي", gap: 1.5, relevance: 2 },
      ],
    },
    {
      course_id: "demo-3",
      title_en: "The Art of Public Speaking",
      title_ar: "فن الخطابة",
      code: null,
      vertical: "leadership",
      level: "foundation",
      duration_label: "2–5d",
      total_score: 18,
      drivers: [
        { label: "التعاون مع الذكاء الاصطناعي", gap: 1.5, relevance: 3 },
      ],
    },
  ] as any,
});

fs.writeFileSync(path.resolve(out), html, "utf8");
console.log(`Wrote ${path.resolve(out)} (${html.length} bytes)`);
