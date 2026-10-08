// SDC HiPo sample reports: data. Everything about people and results here is FICTIONAL.
// Competencies, definitions, indicators and grade requirements come from Ali's v3 workbook
// (SDC_HiPo_Caliber_Detailed_Assessor_Indicators_v3.xlsx, 6 Oct 2026).
const path = require("path");
const v3 = require(path.join(__dirname, "v3.json"));

const LEVELS = ["Below Basic", "Basic", "Proficient", "Advanced"]; // 0..3
const LV = { "Basic": 1, "Proficient": 2, "Advanced": 3 };
const CODE = { "Innovation": "IN", "Results Oriented": "RO", "Effective Collaboration and Communication": "ECC",
  "Professionalism and Integrity": "PI", "Accountability & Ownership": "AO", "Strategic Mindset": "SM",
  "Drives Sustainable Performance": "DSP", "Makes Effective Decisions and Plans": "EDP",
  "Inspires & Motivates": "IM", "Leads by Example": "LBE" };
// Programme module each competency is mainly developed in (proposal 20260809-SDC-02-HPHLD, Part 2).
const MODULE = { IN: "M3 Leading the Business", RO: "M3 Leading the Business", ECC: "M2 Leading Others",
  PI: "M1 Leading Self", AO: "M1 Leading Self", SM: "M3 Leading the Business", DSP: "M2 Leading Others",
  EDP: "M3 Leading the Business", IM: "M2 Leading Others", LBE: "M4 Leading for the Future" };

const COMPS = [];
for (const i of v3.indicators) {
  let c = COMPS.find((x) => x.name === i.competency);
  if (!c) { c = { name: i.competency, category: i.category, code: CODE[i.competency], definition: i.definition, ind: {} }; COMPS.push(c); }
  (c.ind[i.option_level] = c.ind[i.option_level] || []).push({ id: i.id, text: i.text });
}
const gh = v3.grade_header;
const REQ = {}; // REQ[grade][code] = 0 (not required) | 1..3
for (const row of v3.grades) {
  const g = Number(row[0]); REQ[g] = {};
  for (const c of COMPS) { const v = row[gh.indexOf(c.name)]; REQ[g][c.code] = LV[v] || 0; }
}
const GRADE_LABEL = { 8: "Senior Manager", 7: "Manager", 6: "Senior Specialist", 5: "Specialist", 4: "Senior Analyst" };

// Grid rules (proposed for SDC approval).
// Competency fit: Above = every required competency met and at least 2 above; Meets = at least 80% met; else Below.
// Reasoning performance (renamed from 'cognitive agility' per Ali AlShouli, 8 Oct 2026): mean Logica accuracy. Strong >= 70%, Solid 50-69%, Developing < 50%
// (same cut-points as the VIFM HiPo model: accuracy mapped to 1-5, bands at 3.0 and 3.8). Indicative until SDC norms exist.
function fit(grade, res) {
  const req = Object.entries(REQ[grade]).filter(([, r]) => r > 0);
  const met = req.filter(([k, r]) => res[k] >= r).length;
  const above = req.filter(([k, r]) => res[k] > r).length;
  const band = met === req.length && above >= 2 ? 2 : met / req.length >= 0.8 ? 1 : 0;
  return { met, total: req.length, above, band, label: ["Below requirement", "Meets requirement", "Above requirement"][band] };
}
function cog(scores) {
  const mean = Math.round((scores.inductive + scores.numerical + scores.deductive) / 3);
  const band = mean >= 70 ? 2 : mean >= 50 ? 1 : 0;
  return { mean, band, label: ["Developing", "Solid", "Strong"][band] };
}
// GRID[cogBand][fitBand]
const GRID = [
  [{ t: "Foundational development", d: "Build core behaviours and reasoning before stretch roles." },
   { t: "Steady contributor", d: "Meets today's requirement; strengthen reasoning for bigger roles." },
   { t: "Effective in role", d: "Strong in role; build reasoning before accelerating." }],
  [{ t: "Develop competencies", d: "Capable thinker with clear behavioural gaps to close first." },
   { t: "Core talent", d: "Solid on both; grow steadily with targeted development." },
   { t: "Strong contributor", d: "Above the bar today; broaden scope and exposure." }],
  [{ t: "Untapped ability", d: "High reasoning ability; behaviours not yet at the required level." },
   { t: "Emerging potential", d: "Meets the requirement with strong reasoning; stretch with support." },
   { t: "High potential", d: "Above requirement with strong reasoning; accelerate." }],
];

// Fictional sample candidate for the individual reports (Grade 7, so leadership applies at Basic).
const CANDIDATE = {
  name: "Lina Al-Qahtani", grade: 7, position: "Visitor Experience Manager", unit: "Commercial",
  date: "22 October 2026",
  res: { IN: 3, RO: 2, ECC: 3, PI: 3, AO: 2, SM: 2, DSP: 1, EDP: 2, IM: 1, LBE: 1 },
  cog: { inductive: 78, numerical: 72, deductive: 67 },
};

// Fictional cohort for the group report.
const COHORT = [
  ["Faisal Al-Dosari", 8, "Development & Asset Management", { IN: 3, RO: 3, ECC: 3, PI: 3, AO: 3, SM: 3, DSP: 2, EDP: 3, IM: 2, LBE: 2 }, [82, 76, 74]],
  ["Lina Al-Qahtani", 7, "Commercial", CANDIDATE.res, [78, 72, 67]],
  ["Tariq Al-Ghamdi", 7, "Finance", { IN: 2, RO: 3, ECC: 2, PI: 3, AO: 3, SM: 2, DSP: 2, EDP: 2, IM: 1, LBE: 2 }, [64, 81, 58]],
  ["Hind Al-Mutairi", 7, "Human Capital", { IN: 2, RO: 2, ECC: 2, PI: 3, AO: 2, SM: 1, DSP: 1, EDP: 1, IM: 1, LBE: 1 }, [55, 49, 52]],
  ["Nasser Al-Harbi", 6, "Strategy", { IN: 3, RO: 3, ECC: 3, PI: 3, AO: 3, SM: 2, DSP: 1, EDP: 2, IM: 1, LBE: 1 }, [84, 79, 70]],
  ["Maha Al-Otaibi", 6, "Governance, Risk & Compliance", { IN: 2, RO: 3, ECC: 2, PI: 3, AO: 2, SM: 1, DSP: 1, EDP: 1, IM: 1, LBE: 1 }, [61, 66, 57]],
  ["Bandar Al-Anazi", 6, "Corporate Services", { IN: 2, RO: 2, ECC: 2, PI: 2, AO: 2, SM: 1, DSP: 1, EDP: 1, IM: 0, LBE: 1 }, [72, 69, 75]],
  ["Ghada Al-Rashidi", 6, "Project Delivery", { IN: 1, RO: 2, ECC: 2, PI: 2, AO: 1, SM: 0, DSP: 1, EDP: 1, IM: 1, LBE: 1 }, [46, 44, 41]],
  ["Yousef Al-Shamrani", 5, "Development & Asset Management", { IN: 3, RO: 2, ECC: 3, PI: 2, AO: 3, SM: 2, DSP: 1, EDP: 2, IM: 1, LBE: 1 }, [79, 74, 71]],
  ["Rawan Al-Malki", 5, "Finance", { IN: 2, RO: 2, ECC: 2, PI: 2, AO: 2, SM: 1, DSP: 1, EDP: 1, IM: 1, LBE: 1 }, [58, 63, 54]],
  ["Fahad Al-Yami", 5, "Destination Sustainability", { IN: 2, RO: 2, ECC: 1, PI: 2, AO: 2, SM: 1, DSP: 0, EDP: 1, IM: 1, LBE: 1 }, [75, 70, 68]],
  ["Joud Al-Balawi", 5, "Strategy", { IN: 1, RO: 1, ECC: 2, PI: 2, AO: 1, SM: 0, DSP: 0, EDP: 1, IM: 0, LBE: 1 }, [52, 47, 49]],
  ["Ziyad Al-Faifi", 5, "Corporate Services", { IN: 2, RO: 3, ECC: 2, PI: 3, AO: 2, SM: 1, DSP: 1, EDP: 2, IM: 1, LBE: 2 }, [44, 52, 47]],
  ["Areej Al-Saadi", 4, "Commercial", { IN: 3, RO: 2, ECC: 2, PI: 3, AO: 3, SM: 1, DSP: 1, EDP: 1, IM: 1, LBE: 1 }, [71, 77, 73]],
  ["Dana Al-Hazmi", 4, "Finance", { IN: 2, RO: 2, ECC: 2, PI: 2, AO: 1, SM: 1, DSP: 0, EDP: 1, IM: 0, LBE: 1 }, [63, 58, 55]],
].map(([name, grade, unit, res, c]) => ({ name, grade, unit, res, cog: { inductive: c[0], numerical: c[1], deductive: c[2] } }));

module.exports = { LEVELS, COMPS, REQ, GRADE_LABEL, MODULE, GRID, CANDIDATE, COHORT, fit, cog };
