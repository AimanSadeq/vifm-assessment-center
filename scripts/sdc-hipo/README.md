# SDC HiPo generators

Internal tools for the Soudah Development Company (SDC) HiPo assessment. Nothing here is
sent to candidates.

| File | Builds |
|---|---|
| `build-template.py` | `SDC_HiPo_Scenario_Template_v1.xlsx`, the workbook Ali uses to write the 30 scenario questions (3 per SDC competency, 4 responses keyed Advanced / Proficient / Basic / Counter-evidence to v3 indicator IDs, with automatic level and indicator checks). |
| `build-idp-sheet.py` | `SDC_HiPo_IDP_Actions_v1.xlsx`, the sheet Ali reviews: one row per competency and target level an IDP can show (25), with goal behaviours from v3 and draft 70/20/10 actions from `idp_actions.py`. |
| `build-reports.js` | The three one-page sample reports for SDC approval: executive summary, individual development plan, group report. All people and results are fictional (`data.js`). |

```
cd scripts/sdc-hipo
python3 build-template.py                 # writes out/SDC_HiPo_Scenario_Template_v1.xlsx
python3 build-idp-sheet.py                # writes out/SDC_HiPo_IDP_Actions_v1.xlsx
PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node build-reports.js
                                          # writes out/SDC-HiPo-Sample-{1,2,3}-*.pdf
```

- `v3.json`: the 10 SDC competencies, definitions and 160 indicators from Ali's
  `SDC_HiPo_Caliber_Detailed_Assessor_Indicators_v3.xlsx` (6 Oct 2026), plus SDC's grade mapping
  (Grade 4 uses Grade 5 levels, confirmed by Suzanne Salim on 6 Oct 2026).
- `bank.json`: the closest existing VIFM scenario item for each SDC competency, taken from
  `docs/competency-items-cluster1.md` and `docs/competency-items-clusters2-8.md`.
- `data.js`: grid rules (competency fit and cognitive agility bands), grid labels, programme module
  links, and the fictional sample candidate and cohort. Change the rules here if SDC asks.
- `build-reports.js` reuses the VIFM page styles and PDF renderer from `scripts/cbi-pack/`
  (Open Sans, logos from `public/images/`). Set `PUPPETEER_EXECUTABLE_PATH` if puppeteer's own
  Chrome is missing.
- The template has no stored formula results, so check it with a formula engine before sending
  (LibreOffice recalculation hung in the cloud container; the Python `formulas` package worked).
