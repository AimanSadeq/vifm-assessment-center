# VIFM AI Readiness Compass — 30-Second Promo Video
## Handover Brief for AI Video Production Agent (Manus / Gemini / Runway / etc.)

> **You are receiving this brief to produce a 30-second promotional video for the VIFM AI Readiness Compass platform.** Everything you need — script, timing, scene direction, brand assets, voiceover, music cues, on-screen text — is contained in this single document. Execute section-by-section. Deliverables are listed at the end.

---

## 0. PROJECT AT A GLANCE

| Field | Value |
|---|---|
| **Product name** | VIFM AI Readiness Compass |
| **Tagline** | *Know where you stand. Know where to go.* |
| **Owner** | Virginia Institute of Finance and Management (VIFM) |
| **Target audience** | C-suite decision-makers at GCC banks, ministries, and large corporates (UAE + Saudi Arabia) |
| **Duration** | 30.0 seconds exactly |
| **Register** | Modern-AI-product (Anthropic / Stripe / Linear energy) — NOT traditional consultancy |
| **Primary delivery** | Two cuts: one English-voiced with Arabic subtitles; one Arabic-voiced with English subtitles |
| **Formats required** | 1920×1080 (16:9 landscape), 1080×1080 (1:1 square), 1080×1920 (9:16 vertical) |

---

## 1. WHAT THIS VIDEO MUST DO

1. **Establish urgency in the first 3 seconds.** GCC regulators and boards are already asking "are we AI-ready?" — the video opens by naming that reality.
2. **Position the Compass as the definitive diagnostic** — not a consulting opinion, but a *number* backed by evidence.
3. **Prove regional calibration** — UAE + Saudi regulatory frameworks, bilingual, consultant-validated.
4. **End on an emotionally confident beat** — the two-line tagline, spoken slowly, over the brand mark.

**It must NOT:**
- Use generic "AI" stock footage (glowing brains, flying binary, robot hands)
- Feature people of any kind (no actors, no handshakes, no generic office B-roll)
- Use any music with vocals or obvious EDM drops
- Include the word "revolutionary," "transform," "journey," "unleash," or "harness"
- Use any language other than English or Gulf-standard Arabic
- Appear playful, cartoonish, or overly animated — this is premium enterprise software

---

## 2. FINAL DELIVERY SPECIFICATIONS

```
Master cut (English VO):     30.00s · 1920×1080 · H.264 · 10 Mbps · 48kHz stereo · .mp4
Master cut (Arabic VO):      30.00s · 1920×1080 · H.264 · 10 Mbps · 48kHz stereo · .mp4
Square cutdown (EN):         30.00s · 1080×1080 · H.264 · 8 Mbps  · 48kHz stereo · .mp4
Vertical cutdown (EN):       30.00s · 1080×1920 · H.264 · 8 Mbps  · 48kHz stereo · .mp4
```

Frame rate: **30 fps** for all deliverables. No drop-frame. Colour space: **Rec. 709**.

All cuts must include burned-in subtitles in the opposite language (EN cut → AR subs, AR cut → EN subs). Subtitles placed bottom-centre, 28px minimum, with a 60%-opacity navy underlay for legibility on light frames.

---

## 3. BRAND KIT — USE EXACTLY

### Colour palette (hex, use verbatim)

```
Primary navy:          #010131   (backgrounds, end-slate, hero base)
Dark navy:             #111232   (text on light, alternate dark)
Gradient dark navy:    #121140   (aurora mid-stop)
Off-white:             #FEFFF9   (body text on navy, paper stock)

Accent blue:           #5391D5   (primary highlight, compass needle)
Violet:                #A78BFA   (secondary highlight, "premium AI" role)
Teal:                  #2DD4BF   (tertiary highlight, "data / bilingual" role)
Gold:                  #FBBF24   (prestige accent, tagline underline, end-slate mark)
Emerald:               #34D399   (validation / compliance moments)

DO NOT USE: rose, red, orange, any pastel, any colour outside this list.
```

### Aurora hero gradient (for any dark background scene)

```css
background:
  radial-gradient(circle at 15% 20%, rgba(83, 145, 213, 0.30), transparent 45%),
  radial-gradient(circle at 85% 15%, rgba(167, 139, 250, 0.24), transparent 50%),
  radial-gradient(circle at 75% 80%, rgba(45, 212, 191, 0.18), transparent 50%),
  radial-gradient(circle at 20% 90%, rgba(251, 191, 36, 0.12), transparent 55%),
  linear-gradient(135deg, #010131 0%, #121140 50%, #111232 100%);

/* Animate background-position over 25s ease-in-out infinite for subtle drift */
```

### Typography

- **Typeface (entire video):** Open Sans — Regular 400, SemiBold 600, Bold 700
- **Eyebrow / label style:** SemiBold, UPPERCASE, letter-spacing 0.15em, 11–13px
- **Numerals:** SemiBold, letter-spacing -0.02em, font-feature-settings "tabular-nums"
- **Tagline lines:** Bold 700, 40–56px, tight leading

### Logo

- VIFM wordmark: colour version at `/public/images/vifm-logo-light.png`, white version at `/public/images/vifm-logo-dark.png` *(paths relative to the project repo)*
- Final end-slate lock-up: **VIFM logo (white)** + **"AI Readiness Compass"** wordmark to its right, separated by a thin vertical rule (1px, 20%-opacity white)

---

## 4. VOICEOVER SCRIPT — ENGLISH (PRIMARY CUT)

**Total word count: 48 · Total speech duration: ~24s · Pauses/music-only: ~6s**

```
[00:00.0 – 00:03.5]   (silence for first 0.8s, then:)
                      "In the Gulf, AI readiness is no longer optional."

[00:04.0 – 00:08.0]   "The VIFM AI Readiness Compass turns it into a number."

[00:09.0 – 00:14.0]   "Eight pillars. Fifteen regulatory frameworks.
                       One bilingual diagnostic."

[00:15.0 – 00:20.0]   "Multi-stakeholder input. Consultant-validated. Audit-ready."

[00:21.0 – 00:24.0]   "Know where you stand."

[00:25.0 – 00:27.0]   "Know where to go."

[00:28.0 – 00:30.0]   "The VIFM AI Readiness Compass."
```

**Voice artist direction:**
- **Voice profile:** Male, 35-50, neutral international English (slight British acceptable, no American regionalism), baritone register
- **Pace:** Measured. ~2 words per second average. Slow to ~1 word/sec on the two "Know where…" lines.
- **Tone:** Calm, authoritative, slightly lower-pitched than conversational. No rising intonation at line ends — these are statements, not questions.
- **Pauses:** Full quarter-second breath after every full stop. A longer half-second hold after "…into a number."
- **NO:** smiling voice, excitement, "announcer" energy, radio-ad cadence
- **Reference voices for casting:** Narrators used in recent Apple Vision Pro ads, Anthropic Claude launch videos, or Stripe annual update films

**Recommended AI voice services (if using synthetic VO):**
- **ElevenLabs v3** — voice ID: "Adam" or "Brian" at stability 0.45, clarity 0.85, style 0.15. Lower speed by 4%.
- **OpenAI TTS (gpt-4o)** — voice "onyx" works well for this register
- **PlayHT** — voice "William" at 0.95x speed

---

## 5. VOICEOVER SCRIPT — ARABIC (SECONDARY CUT)

**Idiomatic Gulf Arabic. Not translated from English — rewritten for native cadence.**

```
[00:00.0 – 00:03.5]   .في دول الخليج، الجاهزية للذكاء الاصطناعي لم تعد خياراً

[00:04.0 – 00:08.0]   .بوصلة فيفم للاستعداد للذكاء الاصطناعي تحوّلها إلى رقم

[00:09.0 – 00:14.0]   .ثماني ركائز. خمسة عشر إطاراً تنظيمياً. تقييم واحد ثنائي اللغة

[00:15.0 – 00:20.0]   .تقييم من أصحاب المصلحة، متحقَّق من قِبَل المستشار، جاهز للتدقيق

[00:21.0 – 00:24.0]   .اعرف أين أنت

[00:25.0 – 00:27.0]   .اعرف إلى أين تتجه

[00:28.0 – 00:30.0]   .بوصلة فيفم للاستعداد للذكاء الاصطناعي
```

**Voice artist direction (Arabic):**
- **Voice profile:** Male, 35-50, Gulf-standard Arabic (Khaleeji-leaning but universally intelligible; NOT Egyptian, Lebanese, or Maghrebi), baritone
- **Same pacing rules as English** — ~2 words per second, slower on the closing lines
- **Pronunciation note for "فيفم" (VIFM):** pronounce as "*fee-fim*" (one syllable stress on *fee*), NOT spelled out as letters
- **Recommended:** ElevenLabs multilingual v2 with an Arabic-native voice, or record with a professional Gulf voice artist (~$150-300 via voice123.com, bunny-studio.com, or voicebooking.com — search "Khaleeji Arabic male")

---

## 6. SHOT-BY-SHOT PRODUCTION SPEC

**IMPORTANT:** Scenes marked **[CAPTURE]** must be screen-recorded from the actual VIFM Compass portal. Scenes marked **[GENERATE]** can be produced synthetically (Veo, Runway, After Effects). Scenes marked **[HYBRID]** combine screen capture with synthetic motion graphics overlay.

### Scene 1 — 00:00.0–00:03.5 · **[GENERATE]** · 3.5s

**On-screen:** Dark navy frame. The aurora gradient (see §3) fades up over 1.2s. A stylised compass rose drifts into frame from the right at 80% scale, rotating clockwise at 0.4°/sec. A fine dot-grid (rgba white 0.12, 26px spacing, soft-masked toward edges) overlays the background.

**VO:** *"In the Gulf, AI readiness is no longer optional."* (starts at 00:00.8)

**On-screen text:** none

**Transition out:** cut on the word "optional" — match-cut to scene 2 on the beat

**Gemini Veo prompt (if generating):**
> A cinematic dark navy background with slowly drifting aurora gradient in deep blue, violet, and teal. A stylised golden compass rose rotates slowly into view from the right side of the frame. Fine white dots scatter across the background like stars. Ultra-modern, minimalist, enterprise software aesthetic. Rec. 709, 30fps, 16:9, no people, no text, no logos. Style reference: Anthropic Claude launch film, Apple product reveal, Linear.app homepage.

---

### Scene 2 — 00:03.5–00:05.0 · **[CAPTURE]** · 1.5s

**On-screen:** Portal landing page at `/ara`. Frame centred on the eyebrow label **"VIFM AI READINESS COMPASS"** and the headline.

**VO:** *"The VIFM AI Readiness Compass…"* (starts 00:04.0)

**On-screen text:** the eyebrow already renders in portal brand style — no additional overlay needed

**Motion:** static capture. In post, punch in slightly (1.00x → 1.04x zoom over the 1.5s).

**Capture instructions:** Chrome 1920×1080, navigate to `http://localhost:3000/ara`, wait for compass animation to stabilise, screen-record 3s of the hero area.

---

### Scene 3 — 00:05.0–00:08.0 · **[HYBRID]** · 3.0s

**On-screen:** The Overall Maturity Score card from `/ara/consultant/assessments/[demo-id]` — hero page. Large numeral animates **0 → 4.08** over 2.5s with ease-out cubic. Beneath it, the maturity label **"Advanced"** fades in at 00:06.5.

**VO:** *"…turns it into a number."* (00:04.8–00:08.0)

**On-screen text overlay:** tiny label `OVERALL MATURITY` (uppercase, 11px, 0.15em tracking) above the numeral

**Motion:** CountUp is already built into the portal — the real animation will play. Editor adds a subtle gold ring flash (200ms, 40% opacity) at the moment the number lands on 4.08 to punctuate "…a number."

**Capture instructions:** ensure demo data is seeded (see §9), navigate to the assessment Overview tab, let the CountUp animation run naturally during capture.

---

### Scene 4 — 00:08.5–00:10.5 · **[CAPTURE]** · 2.0s

**On-screen:** The 8-pillar radar chart. Polygon **draws itself stroke-by-stroke** over 1.5s, pillar labels fade in clockwise one by one at 120ms intervals.

**VO:** *"Eight pillars."* (starts 00:09.0)

**On-screen text overlay:** lower-third card, bottom-left, `8 PILLARS` · accent blue underline

**Capture instructions:** trigger radar render by entering the Overview tab on a fresh page load.

---

### Scene 5 — 00:10.5–00:12.5 · **[CAPTURE]** · 2.0s

**On-screen:** Regulatory coverage section from `/ara/roadmap`. The UAE framework pill-badges slide in from the left, Saudi from the right. Badges meet in the middle of the frame.

**VO:** *"Fifteen regulatory frameworks."* (starts 00:11.0)

**On-screen text overlay:** lower-third, `15 FRAMEWORKS · UAE + KSA` · gold underline

**Capture instructions:** scroll to the regulatory section on `/ara/roadmap`, capture 4s of the two region cards visible.

---

### Scene 6 — 00:12.5–00:14.5 · **[CAPTURE]** · 2.0s

**On-screen:** The `/ara/respond/[demo-token]` welcome hero. **Quick cross-dissolve** between English mode and Arabic RTL mode. Dissolve happens on the beat at 00:13.5.

**VO:** *"One bilingual diagnostic."* (starts 00:13.0)

**On-screen text overlay:** centre-top, `EN ⇄ AR` with directional arrows

**Capture instructions:** record the page in English for 2s, then toggle language via the portal's language toggle and capture in Arabic for 2s. Editor cross-dissolves the two clips.

---

### Scene 7 — 00:14.5–00:16.5 · **[CAPTURE]** · 2.0s

**On-screen:** Respondents table on the assessment detail page. Four respondent rows populate one at a time, each row's progress bar animates 0% → 100%.

**VO:** *"Multi-stakeholder input."* (starts 00:15.0)

**On-screen text overlay:** lower-third, `4 STAKEHOLDERS`

**Capture instructions:** seed demo data with 4 completed respondents. Reload page to re-trigger any animations. Capture 3s.

---

### Scene 8 — 00:16.5–00:18.5 · **[CAPTURE]** · 2.0s

**On-screen:** The Phase 2 tab of assessment detail. A cursor clicks into a "Consultant validated score" input field; the number **4.2** types out character-by-character; a green emerald-coloured checkmark appears.

**VO:** *"Consultant-validated."* (starts 00:17.0)

**On-screen text overlay:** lower-third, `PHASE 2 VALIDATION`

**Capture instructions:** record the consultant action live. Use a real mouse cursor — do not use the OS cursor, use a recorder like Screen Studio that renders a stylised cursor.

---

### Scene 9 — 00:18.5–00:20.5 · **[HYBRID]** · 2.0s

**On-screen:** Three PDF report covers fan out like a hand of cards against the navy background — **EN (left), Bilingual landscape (centre, larger), AR (right)**. Each cover shows the portal-branded hero.

**VO:** *"Audit-ready."* (starts 00:19.0)

**On-screen text overlay:** small caption under each cover: `EN` · `BILINGUAL` · `AR`

**Capture instructions:** generate the three PDFs from the portal at `/api/ara/reports/[assessmentId]/pdf?lang=en`, `?lang=bilingual`, `?lang=ar`. Take still frames of page 1 of each. Editor animates them into the fan composition.

---

### Scene 10 — 00:20.5–00:24.0 · **[GENERATE]** · 3.5s

**On-screen:** Wide shot. Return to the full compass rose, centred, on the dark aurora background. The four cardinal tick marks pulse in sequence through the palette: **blue → violet → teal → gold**, each lasting 500ms.

**VO:** *"Know where you stand."* (00:21.0–00:24.0) — delivered slowly, one word per beat

**On-screen text:** reveals at 00:22.5 — **"Know where you stand."** centred, 56px, Open Sans Bold 700, off-white #FEFFF9, letter-spacing -0.02em

**Gemini Veo prompt:**
> A large, stylised golden compass rose fills the frame, centred against a dark navy background with subtle aurora gradient drift. Four cardinal tick marks illuminate in sequence: electric blue, vivid violet, bright teal, warm gold — one at a time, each for half a second. The compass rotates slowly. Cinematic, minimalist, premium enterprise software aesthetic. 30fps, 16:9.

---

### Scene 11 — 00:24.0–00:27.5 · **[GENERATE]** · 3.5s

**On-screen:** Continuous from scene 10. The north-pointing needle of the compass brightens to gold (#FBBF24), pulses, and a golden halo expands outward.

**VO:** *"Know where to go."* (00:25.0–00:27.0)

**On-screen text:** reveals at 00:25.5 — **"Know where to go."** same style as scene 10

---

### Scene 12 — 00:27.5–30.0 · **[GENERATE]** · 2.5s

**On-screen:** The compass dissolves. Against deep navy, the VIFM logo (white version) fades in centred. To its right, separated by a thin vertical rule, the wordmark **"AI Readiness Compass"** settles in Open Sans SemiBold. A thin gold (#FBBF24) underline draws left-to-right beneath the entire lock-up over 0.8s.

**VO:** *"The VIFM AI Readiness Compass."* (00:28.0–00:30.0)

**On-screen text:** below the lock-up, smaller (14px), off-white 70% opacity: the URL `vifm.ae / compass` (or whichever URL the client chooses)

**Gemini Veo prompt:**
> A clean, minimalist end-slate on a deep navy background. The VIFM logo wordmark in white fades in centred, with the words "AI Readiness Compass" to its right, separated by a thin vertical line. A slim gold horizontal line draws itself beneath the entire lock-up from left to right. Simple, elegant, enterprise brand identity. No motion after the underline completes. 30fps, 16:9.

---

## 7. MUSIC DIRECTION & BEAT MAP

### Brief

**Genre:** Modern-product-reveal electronic. Sparse, confident, not anthemic. **BPM:** 90–96. **Key:** B minor or C# minor (sits well under navy visuals). **Arrangement ceiling:** sub bass + one pad + sparse pluck/arpeggio + optional riser. **No vocals. No drops. No cinematic strings.**

### Beat map — sync edits to these moments

```
00:00.0   Soft sub hit on the fade-up (no percussion yet)
00:04.0   First melodic note lands exactly on "The VIFM…"
00:08.0   Pad expansion + subtle bass drop on "…into a number"
00:11.5   Percussion or hi-hat enters under "Fifteen frameworks"
00:15.0   Filter opens gradually through "Multi-stakeholder input"
00:20.0   All percussion cuts. Pad sustains. Breath moment.
00:21.0   "Know where you stand" enters over pad only
00:24.0   Sub re-enters softly
00:25.0   "Know where to go" over rebuilding texture
00:28.0   "Button" stinger — reverse cymbal or sub hit on the logo lock-up
00:30.0   Cold stop on the tonic. No fade-out.
```

### Recommended source tracks (all royalty-free, commercial-cleared)

| Library | Track | Notes |
|---|---|---|
| **Artlist.io** | *"First Light"* — Stanley Gurvich | Closest direct match to required mood |
| **Epidemic Sound** | *"Awakening"* collection — any by Andreas Jamsheree | Multiple variants for different densities |
| **Musicbed** | *"Reveal"* — Anbr | Strong "product-launch" feel |
| **Uppbeat.io** (free for non-broadcast) | *"Prism"* — Tokyo Music Walker | Works if budget is zero |

If commissioning original music, brief the composer with this document's §7 — a 30s piece costs $300-800 from a junior composer on Fiverr or Soundbetter.

---

## 8. ON-SCREEN TEXT INVENTORY

**All copy is final. Do not paraphrase or shorten.**

### English cut

| Scene | Time | Text | Style |
|---|---|---|---|
| 2 | 00:04.0 | *(portal eyebrow)* `VIFM AI READINESS COMPASS` | 11px uppercase, letter-spacing 0.15em, accent blue #5391D5 |
| 3 | 00:05.0 | `OVERALL MATURITY` | 11px uppercase eyebrow, off-white 70% |
| 4 | 00:09.0 | `8 PILLARS` | 13px lower-third, accent blue underline |
| 5 | 00:11.0 | `15 FRAMEWORKS · UAE + KSA` | 13px lower-third, gold underline |
| 6 | 00:13.0 | `EN ⇄ AR` | 13px centre-top, teal |
| 7 | 00:15.0 | `4 STAKEHOLDERS` | 13px lower-third, accent blue |
| 8 | 00:17.0 | `PHASE 2 VALIDATION` | 13px lower-third, emerald underline |
| 9 | 00:19.0 | `EN · BILINGUAL · AR` | 11px captions under PDF covers |
| 10 | 00:22.5 | `Know where you stand.` | 56px Bold 700, off-white, centred |
| 11 | 00:25.5 | `Know where to go.` | 56px Bold 700, off-white, centred |
| 12 | 00:28.0 | `VIFM AI Readiness Compass` + URL | Lock-up — see §3 and Scene 12 |

### Arabic cut (mirror layout — all lower-thirds move to the opposite side for RTL)

| Scene | Time | Text | Style |
|---|---|---|---|
| 2 | 00:04.0 | `بوصلة فيفم للاستعداد للذكاء الاصطناعي` | 11px, accent blue |
| 3 | 00:05.0 | `النضج الإجمالي` | 11px eyebrow |
| 4 | 00:09.0 | `ثماني ركائز` | 13px lower-third |
| 5 | 00:11.0 | `١٥ إطاراً · الإمارات + السعودية` | 13px, gold — note Arabic numerals |
| 6 | 00:13.0 | `الإنجليزية ⇄ العربية` | 13px |
| 7 | 00:15.0 | `٤ أصحاب مصلحة` | 13px |
| 8 | 00:17.0 | `التحقق - المرحلة الثانية` | 13px, emerald |
| 9 | 00:19.0 | `إنجليزي · ثنائي · عربي` | 11px |
| 10 | 00:22.5 | `.اعرف أين أنت` | 56px Bold |
| 11 | 00:25.5 | `.اعرف إلى أين تتجه` | 56px Bold |
| 12 | 00:28.0 | `بوصلة فيفم للاستعداد للذكاء الاصطناعي` | Lock-up |

---

## 9. ASSETS & DATA PREPARATION

### 9.1 Brand assets to fetch

```
VIFM logo (white):    {repo}/public/images/vifm-logo-dark.png
VIFM logo (colour):   {repo}/public/images/vifm-logo-light.png
Portal font:          Open Sans — https://fonts.google.com/specimen/Open+Sans
Portal URL (local):   http://localhost:3000/ara
Portal URL (staging): (add when available)
```

### 9.2 Demo data — seeded by `scripts/seed-compass-promo.ts`

**To prepare the portal for capture, run:**

```bash
npx tsx scripts/seed-compass-promo.ts
```

The script is idempotent (re-running resets to a clean state) and seeds:

- **Organization:** *Al Noor Bank* / *مصرف النور* — UAE, banking (fictional — safe for public use)
- **Assessment:** bilingual-capable, status `frozen`, phase `phase2`, sandbox flag on
- **Overall score:** `4.08` · label `Advanced` (green band) — target number for scene 3
- **Pillar scores** with the following shape, chosen so the radar chart has a distinctive silhouette and credible "strengths vs. gaps" storytelling:
  - Strategy 4.5 · Data 4.3 · Technology 4.0 · Talent 3.7 · Culture 3.9 · Governance 4.6 · Operations 4.0 · Model Management 3.6
  - Self-assessment scores set +0.25 above consultant-validated for a visible perception-vs-reality gap
- **4 respondents** — bilingual names, plausible GCC banking roles, all marked complete:
  - Ali Al-Mansouri · Chief Data Officer · EN
  - Fatima Al-Sayegh · Head of AI & Innovation · EN
  - Khalid bin Sultan · Director of Risk & Compliance · AR
  - Mariam Al-Hashimi · Head of Digital Strategy · EN
- **3 supporting materials:** 1 PDF, 1 Word, 1 URL — varied types for richer UI
- **5 AI use cases** spanning ideation / piloting / production, across different risk-value quadrants
- **5 consultant notes** — all flagged `include_in_report`, covering overall posture plus pillar-specific strengths and gaps
- **Phase 2 consultant-validated scores** set for all 8 pillars (so the Phase 2 tab has populated inputs when the cursor tabs between fields in scene 8)

The script prints the assessment ID, respondent access tokens, and every URL needed for capture, at the end of its run. Copy those directly into the recording checklist in §9.3.

### 9.3 Screen-capture setup

- Browser: **Chrome 120+**, incognito, no extensions, zoom 100%, bookmarks hidden
- Viewport: **1920×1080**
- Recorder: **Screen Studio (macOS)** preferred for its stylised cursor; **OBS Studio** acceptable
- Frame rate: **60fps source** (down-sample to 30fps on export)
- Codec: ProRes 422 or H.264 CRF 18 — lossless enough for motion-graphics compositing

### 9.4 Synthetic-generation setup (for scenes 1, 10, 11, 12)

- **Gemini Veo 3 or Runway Gen-3:** paste the per-scene prompt from §6 verbatim. Generate 8s clips for scene 1, scenes 10+11 combined, and scene 12. Trim to duration in post.
- **Fallback — After Effects:** the four generated scenes are all abstract brand visuals (compass, aurora, typography). A motion designer can replicate them in AE within 4–6 hours using the brand kit in §3.

---

## 10. DO / DON'T

### Do
- ✓ Cut on the beat of the music (§7)
- ✓ Use the exact hex colour palette (§3)
- ✓ Use Open Sans throughout — no fallback substitutions
- ✓ Burn in subtitles in the opposite language for both cuts
- ✓ End cold on the tonic note — no fade-out
- ✓ Keep cursor interactions in screen captures intentional and unhurried
- ✓ Use `tabular-nums` for all numeric displays
- ✓ Preserve the portal's existing motion (compass rotation, aurora drift) — do not speed them up

### Don't
- ✗ Use people, faces, hands, or body parts
- ✗ Use any stock footage of GCC skylines or offices
- ✗ Add glow effects, lens flares, glitch transitions, or "cyberpunk" aesthetic
- ✗ Use any colour not in the §3 palette
- ✗ Substitute any word in the scripts (§4, §5) — all copy is final
- ✗ Add a presenter, CEO talking head, or customer testimonial
- ✗ Use music with vocals, drums above 110 BPM, or obvious EDM elements
- ✗ Fade in or out of the start/end — hard cuts only

---

## 11. ACCEPTANCE CRITERIA

The deliverable is considered complete when all of the following are true:

1. ☐ Total runtime is **30.00s ± 0.2s** for all four cuts
2. ☐ VO timing matches §4 / §5 within ±100ms at every marked timecode
3. ☐ All on-screen text from §8 renders in Open Sans with correct colour and size
4. ☐ Subtitles are burned in on both master cuts in the opposite language
5. ☐ Aurora gradient and compass motion match the portal's live animations (reference: open `http://localhost:3000/ara` side-by-side while QA'ing)
6. ☐ Music ends cold on the tonic at exactly 30.00s
7. ☐ No forbidden elements per §10 Don't
8. ☐ Square (1:1) and Vertical (9:16) cutdowns preserve the tagline lines fully and keep the end-slate lock-up legible
9. ☐ Exported H.264 files play cleanly in QuickTime, VLC, and in-browser on Chrome and Safari
10. ☐ A final review pass is done by a native Gulf-Arabic speaker on the AR cut before delivery

---

## 12. FINAL DELIVERABLES

Package as a single ZIP named `VIFM_Compass_Promo_v1.zip` containing:

```
/master/
    vifm-compass-30s-en.mp4               (1920×1080, EN voice, AR subtitles)
    vifm-compass-30s-ar.mp4               (1920×1080, AR voice, EN subtitles)
/square/
    vifm-compass-30s-en-square.mp4        (1080×1080, EN voice, AR subtitles)
    vifm-compass-30s-ar-square.mp4        (1080×1080, AR voice, EN subtitles)
/vertical/
    vifm-compass-30s-en-vertical.mp4      (1080×1920, EN voice, AR subtitles)
    vifm-compass-30s-ar-vertical.mp4      (1080×1920, AR voice, EN subtitles)
/stems/
    voiceover-en.wav                      (isolated English VO, 48kHz)
    voiceover-ar.wav                      (isolated Arabic VO, 48kHz)
    music-bed.wav                         (isolated music, 48kHz)
    motion-graphics.mov                   (MGFX only, alpha channel, ProRes 4444)
/stills/
    cover-frame-en.jpg                    (LinkedIn/social preview — 1200×630)
    cover-frame-ar.jpg                    (1200×630)
    end-slate.png                         (transparent PNG of the final lock-up, 2000px wide)
/captions/
    subtitles-en.srt                      (for platforms that want plain subtitle files)
    subtitles-ar.srt
README.txt                                (any deviations from this brief, noted)
```

---

## APPENDIX A — MANUS TASK GRAPH (if orchestrated by Manus)

If you are Manus (or any multi-step agent), execute in this order:

```
1.  Read this brief end-to-end. Confirm understanding.
2.  Verify brand assets are accessible (logos at paths in §9.1).
3.  Seed demo data:  npx tsx scripts/seed-compass-promo.ts
    Capture the assessment ID and respondent tokens it prints.
4.  Launch portal locally (npm run dev) on port 3000.
5.  Execute screen captures — clips 2, 3, 4, 5, 6, 7, 8 — following §9.3,
    substituting the seeded IDs/tokens into each URL.
    Save each to /raw-captures/clip-XX.mov.
6.  Generate PDF report covers for scene 9 (three language modes:
    ?lang=en, ?lang=ar, ?lang=bilingual). Screenshot page 1 of each.
    Save to /raw-captures/pdf-{en,ar,bilingual}.png.
7.  Generate synthetic clips 1, 10, 11, 12 via Veo 3 or Runway,
    using prompts from §6 / Appendix B. Save to /raw-generated/scene-XX.mp4.
8.  Generate English voiceover (§4) via ElevenLabs. Save to /audio/vo-en.wav.
9.  Generate Arabic voiceover (§5) via ElevenLabs multilingual.
    Save to /audio/vo-ar.wav.
10. Source or license music track per §7. Save to /audio/music.wav.
11. Assemble timeline in your NLE of choice (ffmpeg composition acceptable
    if well-scripted). Sync cuts to music beats per §7.
12. Generate burned-in subtitles for both cuts.
13. Render all six formats per §12.
14. Run QA against the §11 acceptance checklist.
15. Package and deliver.
```

## APPENDIX B — GEMINI VEO PROMPT LIBRARY (copy-paste directly)

For users who want to generate the entire video synthetically via Gemini Veo 3 or Runway Gen-3 Alpha and accept that it will not show real portal UI (the result will be abstract brand film, not a product demo):

### Scene 1 (00:00–00:03.5)
> Cinematic dark navy background with slowly drifting aurora gradient in deep blue, violet, and teal. A stylised golden compass rose rotates slowly into view from the right side of the frame. Fine white dots scatter across the background like stars. Ultra-modern, minimalist, enterprise software aesthetic. Rec. 709, 30fps, 16:9, no people, no text, no logos. 3.5 seconds.

### Scenes 10–11 (00:20–00:27.5, one combined 7.5s clip)
> A large stylised golden compass rose fills the frame, centred against a dark navy background with subtle aurora gradient drift. Four cardinal tick marks illuminate in sequence — electric blue, vivid violet, bright teal, warm gold — one at a time, each for half a second. Then the north-pointing needle brightens to gold, pulses, and a golden halo expands outward. The compass rotates slowly throughout. Cinematic, minimalist, premium enterprise software aesthetic. No text, no logos, no people. 30fps, 16:9. 7.5 seconds.

### Scene 12 (00:27.5–00:30)
> Clean minimalist end-slate on a deep navy background. The letters "VIFM" in white fade in centred, with the words "AI Readiness Compass" in smaller type to the right, separated by a thin vertical line. A slim gold horizontal line draws itself beneath the entire lock-up from left to right. Simple, elegant, enterprise brand identity. No motion after the underline completes. No people, no extra graphics. 30fps, 16:9. 2.5 seconds.

### Middle scenes (2–9) — NOT generable synthetically

These scenes show actual product UI. They **must** be screen-captured from the real VIFM Compass portal per §9.3. If an agent attempts to generate these, it will produce fabricated UI that doesn't match the product and will fail §11 acceptance criteria #5. Refuse and request screen captures instead.

---

## APPENDIX C — REFERENCE LINKS

- **Brand style reference:** Anthropic Claude launch films (anthropic.com), Stripe Annual Update films, Linear.app homepage video
- **Motion reference:** any recent Apple product reveal; Framer.com homepage
- **Music reference:** Artlist search term *"corporate innovation minimalist"*
- **Typography reference:** Stripe Docs, Linear.app

---

## REVISION LOG

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-04-23 | Initial brief. Approved for production handover. |

---

**End of brief. Deliverables due per agreement with VIFM.**
