# CBI sample pack generator

Builds the files in `docs/samples/cbi/` from `data.js`.

```
cd scripts/cbi-pack
npm install            # pptxgenjs only; puppeteer comes from the repo root
npm run build          # writes the pptx and the two PDFs (HTML intermediates are removed)
```

- `data.js` is the only file to edit for a new role: the role, the six competencies with their
  definitions, indicators, questions, probes, anchors and development tips, and the fictional
  sample ratings. Pull definitions, indicators and anchors from `competencies`,
  `behavioral_indicators` and `competency_scale_anchors` for the competencies you choose.
- `build-deck.js` writes the 18-slide deck (VIFM brand, Open Sans, editable SVG icons).
- `build-all.js` runs everything. `build-guide.js` and `build-report.js` write A4 HTML; `render-pdf.js`
  turns it into PDF with the repo's puppeteer. If its bundled Chrome is missing (a cloud container,
  for instance), set `PUPPETEER_EXECUTABLE_PATH` to any Chrome or Chromium binary. Set `CBI_OUT` to
  write somewhere other than `docs/samples/cbi`.
- The deck's PDF export is made separately with LibreOffice:
  `soffice --headless --convert-to pdf --outdir docs/samples/cbi docs/samples/cbi/VIFM-Competency-Based-Interview-Approach.pptx`
- `assets/fonts/` vendors Open Sans under the SIL Open Font License (see `OFL.txt`) so the PDFs embed it.
  Logos are read from `public/images/`.
