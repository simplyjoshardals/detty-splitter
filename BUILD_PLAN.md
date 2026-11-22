# BUILD_PLAN.md: Detty December 2026 Survival & Group Splitter

> Prompt 5 output. Inputs: REQUIREMENTS.md, ARCHITECTURE.md, DATA_MODEL.md, DESIGN.md (v2), UI_PLAN.md.
> Written Sat Nov 21, 2026, 10:38 Lagos. Launch target: **Tue Nov 24**.
> No backend exists, so every slice is UI + the `lib/` logic it needs, usable end to end.
> Slice numbers here are re-ordered from UI_PLAN.md (mapping in each heading). Tick boxes as you go.

---

## 0. Assumptions and the honest schedule

- **Total:** about 18.75h of build + about 1h price research + about 1h copy = **about 20.75h**. That's about 0.75h over the top of your 15 to 20h window, so the cut ladder in §5 is part of the plan, not an afterthought.
- **I don't know your daily availability.** I assumed about 5 to 6h on Sat, Sun and Mon, and about 4h on Tue (details in §5). If you have less, start cutting from the top of the ladder on Sunday night, not Tuesday.
- **A9 slips by a day in this schedule.** REQUIREMENTS A9 said "deploy by Monday night, launch Tuesday". With this plan the feature-complete deploy is Monday night (after Slice 9), but final polish, CSP and launch happen Tuesday. That still launches on the 24th.
- **Scope freeze:** no new features after Sunday night.
- **Order change from UI_PLAN.md:** deploy first (Slice 1), then the export spike (Slice 2). Web Share needs HTTPS and you must test on real phones, so the spike needs a live URL.
- Tasks are 0.3 to 1.0h each (smaller than the playbook's 1 to 3h) because several are 20-minute wiring jobs. Group them into one sitting if you like.
- Work method per slice: Prompt 6 for the `lib/` logic, then Prompt 7 for the UI, screenshots at 360px and desktop in light and dark. Run focused tests while building; full type-check, lint and tests once per slice.

---

## 1. Slices and tasks

### Slice 1: Scaffold, tokens, fonts, icons, deploy (1.5h) *(UI_PLAN S1)*
Goal: a live `.pages.dev` URL showing the design tokens, so every later slice ships to a real device.

- [x] **T1.1 Scaffold the project** (0.5h)
  - Build: `create-next-app` with TypeScript, Tailwind, ESLint, App Router, **no `src/`**. Set `output: 'export'` and unoptimized images. Add `@/*` alias to `./*`, `.env.example` (`NEXT_PUBLIC_CTA_URL`, `NEXT_PUBLIC_CTA_ENABLED`), `config/` stub (SITE_URL, flags), folder skeleton from ARCHITECTURE §7. `git init`, push to GitHub.
  - Done when: `yarn build` produces `out/`; `yarn dev` shows the default page; repo is on GitHub.
  - Depends on: nothing.
  - Done notes: removed `cacheComponents` and `partialPrefetching` from `next.config.ts` (server-runtime options, not needed for a static export); added `!.env.example` to `.gitignore` so the example file is tracked; `config/index.ts` is the only place env vars are read; empty folders are held by `.gitkeep` files (delete each when its first real file lands). `SITE_URL` is a placeholder, fixed in T1.3.
- [x] **T1.2 Tokens, fonts, icons** (0.5h)
  - Build: tokens and `@theme inline` from DESIGN.md §3 in `app/globals.css`; Bungee and Space Mono via `next/font` (latin + latin-ext); Phosphor installed, `optimizePackageImports` set; a throwaway test block.
  - Done when (all must pass):
    - Test line `₦1,234,567.89 $ £` renders correctly in Space Mono (if not, swap the mono per DESIGN.md §1).
    - A script lists the package's exports and every icon name in DESIGN.md §2 exists (swap any missing).
    - Light and dark both look right (toggle OS theme).
    - `next build` output noted for the JS budget (starting guess ~150 KB gzipped).
  - Depends on: T1.1.
  - Done notes: first-load JS measured at 185.8 KB gzipped (test page, 20 icons); a bare page is 172.2 KB, so the framework floor alone is about 22 KB over the ~150 KB guess and the icons plus test block add about 13.6 KB. Decision: keep Next.js; the guess is unvalidated, Cloudflare will likely serve brotli (smaller than gzip), and the receipt renderer is already a lazy chunk. Judge by real phone load time after T1.3 and re-measure after Slice 3. Measured on Windows with a .NET gzip helper, so compare like with like. `scripts/check-icons.mjs` (`yarn check:icons`) is kept to re-verify icon names.
- [x] **T1.3 Deploy to Cloudflare** (0.5h)
  - Build: connect the repo; build command `yarn build`, output directory `out` (from Cloudflare's static Next.js guide). Note whether the dashboard offers Pages or Workers static assets, and set a Node version if the build asks for one (check Cloudflare's build docs; not verified here). Add a stub `public/_headers` (no CSP yet).
  - Also: set the real `SITE_URL` in `config/index.ts` once the `.pages.dev` URL is known.
  - Done when: the `.pages.dev` URL loads on your phone over HTTPS; pushing to `main` redeploys.
  - Depends on: T1.1, T1.2.
  - Done notes: deployed with Cloudflare Pages (Pages tab, Git import, preset Next.js (Static HTML Export), `yarn build`, output `out`); live at https://detty-splitter.pages.dev and `_headers` confirmed with `curl.exe -I`. Node 22.23.4 and Yarn 4.12.0 were detected automatically, so no version pins were needed. The first build failed because Yarn ran in Plug'n'Play mode and Turbopack could not resolve `next`; fixed by committing `.yarnrc.yml` (`nodeLinker: node-modules`). The `SITE_URL` placeholder already matched the real URL, so no change was needed.

### Slice 2 ⚠: Export spike on real devices (1.0h) *(UI_PLAN S0)*
Goal: learn now whether canvas export, Web Share and the fallbacks work where your audience is.

- [x] **T2.1 Build the spike page** (0.5h)
  - Build: a throwaway `/spike` route. Hard-coded `ReceiptView`; canvas draws the danfo band, a few POS lines and amounts at 1080×1920; waits for the fonts before drawing; shows the PNG inline; two buttons: "Share now" (pre-rendered blob, `canShare` then `share` inside the click, no `await` of rendering) and "Download".
  - Done when: it works on desktop Chrome and renders the right fonts (not fallback), including ₦.
  - Depends on: T1.3.
- [x] **T2.2 Run the device matrix and record decisions** (0.5h)
  - Test on: real iPhone Safari, mid-range Android Chrome, and inside WhatsApp, Instagram, TikTok and X in-app browsers.
  - Record per device: renders correctly? Web Share with file works? download works? press-and-hold on the inline image works? Pre-rendered blob → immediate share works?
  - Done when: the matrix is filled in below and the **primary path plus fallbacks are decided** (e.g. "in-app browsers use inline image only").
  - Depends on: T2.1.
  - Matrix (tested 21 Nov 2026 on the live `/spike`; Android was Android 10, Chrome 157). The spike always pre-renders the blob, so "Share ok" also means the pre-rendered blob shares immediately.

    | Environment | Renders OK | Share w/ file | Download | Press-hold save | Notes |
    |---|---|---|---|---|---|
    | iPhone Safari | ok | ok | ok | ok | download prompt appears |
    | Android Chrome | ok | ok | ok | not tested | first run failed on fonts, see decision 5 |
    | WhatsApp in-app | n/a | n/a | n/a | n/a | no in-app browser; links open in the default browser |
    | Instagram in-app | ok | ok | partial | ok | download opens the full image, no save prompt |
    | TikTok in-app | ok | ok | partial | ok | same as Instagram |
    | X in-app | ok | ok | partial | ok | same as Instagram |

  - Decisions:
    1. Primary path: Share with the file, using the pre-rendered blob (worked in every environment tested).
    2. Fallback 1: download link (`<a download>`). It saves on iPhone Safari and Android Chrome. In Instagram, TikTok and X it only opens the full image with no save prompt, so the inline image is the fallback there.
    3. Last fallback: the inline image with "press and hold to save" (worked on iPhone Safari, Instagram, TikTok and X).
    4. No in-app browser detection is needed: Share works in all three, and the Download behaviour is covered by decision 3.
    5. Fonts: load and draw using only the first family of `--font-bungee` and `--font-space-mono`. The fallback face `next/font` appends made `document.fonts.load()` reject with NetworkError on Android (likely because it points at a system font Android lacks), even though the real fonts were fine. Whether the in-page Retry recovers from a failed font load is untested.

> Delete the `/spike` route before launch (it's on the Slice 11 checklist).

### Slice 3: First paint, defaults, read-only results (2.0h) *(UI_PLAN S2)*
Goal: the smallest working version of the core feature, deployed: real numbers and the stamp on first paint.

- [x] **T3.1 Calculation core with tests** (0.75h)
  - Build: `lib/money` (conversion, per-line rounding, formatting), `lib/calc` (line totals, shared vs per-person, per-person and group totals, tier lookup), per DATA_MODEL §2.4 including the rounding rule.
  - Done when: unit tests pass for the **golden example** (per person ₦1,347,500, group ₦5,390,000, Tier 3, USD lines 175.00 / 200.00 / 266.67 / 70.00 / 186.67 → $898.34, group $3,593.36), all-zero → Tier 1, tier boundaries (299,999 vs 300,000 etc.), headcount 1, currency round trip not changing ₦ values.
  - Depends on: T1.1.
  - Done notes: 44 tests pass (Vitest 5.1.1). Amounts are integers (whole naira, or cents/pence) and the tier is chosen by comparing exact BigInt fractions, so floating point can never put a scenario in the wrong tier. Shared types live in `lib/types.ts`; tier thresholds are passed into `calculate()` (the real tiers file arrives in T3.2). `yarn test` runs `vitest run`; under Yarn, Vitest 5 needs `vite` installed explicitly (`yarn add -D --exact vite`).
- [x] **T3.2 Data files and state skeleton** (0.5h)
  - Build: `data/` bucket definitions, 3 presets (placeholder values until R1), 5 tiers with badge, tagline and balance line (draft copy), reducer + context with the default scenario (Soft Life, group 4).
  - Done when: state initialises to the default; types are strict, no `any`.
  - Depends on: T3.1.
  - Done notes: 62 tests pass. The Soft Life preset is the DATA_MODEL golden example, so the default state gives ₦1,347,500 per person and Tier 3. Budget (₦280,000, Tier 1) and Baller (₦5,812,500, Tier 5) are made-up placeholders, and `DEFAULT_RATES` in `config/` (₦1,500 per $1, ₦2,000 per £1) is a placeholder too: replace the preset prices and tier thresholds after price research (O1) and the rates from a real source before launch. The reducer has one action, `selectPreset` (also used for "Reset to preset"); the other actions arrive in Slices 4, 5 and 8. `AppStateProvider` is only type-checked so far: T3.3 mounts it. Tier 2's badge is "Budget Boss".
- [x] **T3.3 Read-only results page** (0.75h)
  - Build: header, 5 line items with icon tiles, totals, tier stamp, footer note, all read-only, from the default state.
  - Done when: matches the golden numbers on screen; no layout shift when fonts load; works at 360 / 768 / 1280px; deployed.
  - Depends on: T3.2, T1.3.
  - Also: delete the throwaway `components/DevTestBlock.tsx` and its use in `app/page.tsx`; re-measure first-load JS and compare with the 172.2 KB bare-page baseline.
  - Done notes: golden numbers confirmed on screen (₦1,347,500 per person, ₦5,390,000 for the group), checked at 360 / 768 / 1280px and in light and dark mode; layout shift measured at 0 locally and on the deployed site. `DevTestBlock` deleted. First-load JS is 179.7 KB gzipped (184,049 bytes): the 172.2 KB bare-page floor plus about 7.5 KB for the app code, data and 5 icons. That is still over the ~150 KB guess, so the T2.2 decision stands (keep Next.js, judge by real phone load time). The footer reads only "Estimates only, not quotes." until editing exists, the page is one centred column at every width until the live receipt (Slice 6), and formula lines show ₦ prices until T5.1.

### Slice 4: Editing (3.25h) *(UI_PLAN S3)*
Goal: every number editable, every mode switchable, safely.

- [x] **T4.1 Number input with draft handling** (1.0h)
  - Build: `parseNumberInput` in `lib/`, `NumberField` (draft text separate from AppState, separators as you type, stable caret, 16px text, `inputMode="numeric"`, revert on empty/invalid, clamp with hint).
  - Done when: typing "1,5" never writes `NaN` or a half value; "1,500,000", "1 500 000", "", "abc" behave per DATA_MODEL §9.2; component tests pass (query by role and label).
  - Depends on: T3.2.
  - Also: add "Tap any number to edit." to the footer note.
  - Done notes: 183 tests pass (152 before, plus 31 new); ESLint clean. `parseNumberInput(text, range, lastGood)` returns a union, `ok` / `clamped` (with `bound`) / `reverted` (with `reason`), instead of the old `{ value, clamped, reverted }` booleans; UI_PLAN §1.2 is updated to match. Commas are thousands separators, so "1,5" is 15 and "1.5" is invalid (nothing is rounded); more than 15 digits clamps to max. A field commits only on blur or Enter (totals move then, not per keystroke), and the iOS numeric keypad has no Return key, so people tap elsewhere. Pulled forward from Slice 4: the reducer action `setBucketNumber` (re-clamps with the same `RANGES`) and one price field per bucket, so the footer text is true. Decimals are not supported yet: T5.2 rates need 2, so add `decimals` to the range type then. New devDeps for component tests: `jsdom` 31.0.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.13; `.test.tsx` files opt into jsdom with a first-line `// @vitest-environment jsdom` comment, so logic tests stay in plain Node. Checked in real Chromium: 16px text, 48px box, no overflow at 360 / 768 / 1280px with all five prices at max, light and dark. Fixed after the first screenshots: the group total now wraps under its label instead of breaking mid-number, and the focus ring has an 8px gap above the hint. Not yet checked: caret behaviour on a real Gboard and iOS Safari (**VERIFY**, fold into the T4.4 pass).
- [x] **T4.2 Stepper, segmented control, mode switch** (1.0h)
  - Build: stepper (Phosphor Plus/Minus, 44px), segmented radio control, shared/per-person switch with headcount shown only when shared, wired to the reducer.
  - Done when: switching mode changes the line total correctly (golden cases); headcount can't go below 1; keyboard and arrow keys work.
  - Depends on: T4.1.
  - Also: the formula line under each price field still repeats the price (left from T4.1); restructure that row, with quantity beside the price field as in DESIGN §5.4, and drop the duplicate. This also fixes the "split 4 / ways" orphan.
  - Done notes: 218 tests pass (191 before, plus 27 new: 14 stepper, 4 segmented control, 9 panel); ESLint clean. Built in two parts. Part A: reducer action `setBucketMode` (ignores any mode but `shared` / `perPerson`, leaves `headcount` alone so shared, per person, shared restores the old split), with golden tests. Part B: `Stepper` (minus, value, plus; the value commits on blur or Enter like `NumberField`, button presses and ArrowUp / ArrowDown commit at once), generic `SegmentedControl` (native radios, one tab stop, arrow keys; T5.1 reuses it for currency), and `BucketLine`, pulled out of `ResultsPanel` so each bucket's wiring is one small component. A stepper at its bound is `aria-disabled`, not `disabled`, so keyboard focus stays on the button. Headcount can't go below 1 by button or by typing 0 (hint "Min is 1, so we adjusted it."); quantity goes 0 to 999. The headcount stepper is its own "Split between" row, shown only when shared, so no control sits inside a radio's label (DESIGN §5.4 changed from the first sketch). Price and quantity stack below 480px and sit side by side from 480px; the quantity column is a fixed 144px, because a hint under it used to widen the column and squeeze the price field to about 95px (found in the first screenshots, fixed, checked by measurement in Chromium: price box 307px with the longest hint at 768 and 1280). The formula line no longer repeats the price: "₦1,050,000 total ÷ 4" when shared, "Each person pays this" when per person. Added `quantityLabel` to `data/buckets.ts`, the `hintFromResult` / `hintText` helpers moved to `components/numberHint.ts` (`NumberField` behaviour unchanged), and `UsersThreeIcon` / `UserIcon` to `check-icons.mjs` and DESIGN §2. One existing test changed: "every bucket has its own price field" now filters textboxes by name, because steppers are textboxes too. DESIGN §2, §5.4, §5.5 and §5.6 updated. Checked in a real browser at 360 / 768 / 1280px, light and dark, with max values (no overflow). Not done, moved to T4.4: see its Also line.
- [x] **T4.3 Route plates, group size, apply-to-all, reset** (0.75h)
  - Build: three route plates (native radios, icons, selected state is shape + icon + shadow, not colour alone), group-size stepper, "Apply to all shared", "Reset to preset" (keeps currency and rates).
  - Done when: tapping a plate fills all 5 buckets and updates totals at once; reset restores the last-picked preset's values; selected plate is distinguishable in greyscale.
  - Depends on: T4.2.
  - Done notes: 241 tests pass (218 before, plus 13 reducer and 10 component); ESLint clean. Built in two parts. Part A: reducer actions `setGroupSize` (clamps 1 to 100, ignores non-integers) and `applyGroupSizeToShared` (sets the split of shared lines only; per-person lines keep their stored headcount, so switching them back restores the old split); both return the same state object when nothing changes. "Reset to preset" needed no new action: it is `selectPreset` with the current preset id, so a plate tap and a reset share one code path. DATA_MODEL §2.3 and UI_PLAN §2.2 updated. Part B: `RoutePlates` (fieldset, native radios; selected = yellow fill, filled icon, check badge, 3px border and hard shadow, with the same outer size as an unselected plate) and `TripControls` (plates, the `Stepper` for group size, two text buttons, status line). The status line is a new pattern (DESIGN §5.9, §9): a plate tap, Apply and Reset replace many numbers with no undo, and the damage meter's live region doesn't exist until T6.2. It is always in the page, one line high, and clears after 6 seconds. Checked in a real browser at 360px (light and dark), 768px and 1280px (light); the selected plate is clear in greyscale. Fixed after the first screenshots: the right padding reserved for the check badge in the stacked layout was also applied to the three-column layout, so captions wrapped to four lines at 768 and 1280px; the status line sat 13px above the dashed rule. Known and left: at exactly 360px "Apply to all shared" and "Reset to preset" wrap onto two rows (they share a row from about 375px); a hint under the group stepper pushes the two buttons down (T4.4, see its Also line); at group size 6 the group total is ₦2 above the real bills (₦6,550,002 against ₦6,550,000) because DATA_MODEL §2.4 multiplies the already-rounded per-person total, which is the documented rule and was not changed. Also checked at 360px in dark mode with max values (group of 100, every price ₦50,000,000 × 999): nothing overflows or clips beside the new controls, and the group stepper's plus is dimmed at 100. A non-default plate (Outside on a Budget) reads the same in dark mode. A keyboard-focused plate is always the selected one (the plates are one tab stop and the arrow keys move focus and selection together), so a focused paper plate never occurs.
- [ ] **T4.4 Clamp hints, labels, 360px pass** (0.5h)
  - Build: clamp and error hints with icons and `aria-describedby`; every input labelled; layout check at 360px.
  - Done when: `max-values` fixture shows no overflow or clipping; every input has a visible label; no iOS zoom on focus.
  - Depends on: T4.1 to T4.3.
  - Also: T4.1 already built the hint (icon, `role="status"`, `aria-describedby`), so audit it rather than rebuild. A hint pushes the content below it down by about 33px, so a button directly under a field can miss a tap; either reserve the line or let the hint replace the formula line. Check caret behaviour on a real Gboard and iOS Safari.
  - Also (from T4.3): the group-size stepper sits directly above "Apply to all shared" and "Reset to preset", so a hint under the stepper (typed 0, or text that isn't a number) pushes the two buttons down about 33px at the moment the user taps one. Fix it with the hint decision below, and test it by typing an invalid group size and tapping Apply straight away.
  - Also (from T4.2 review): (1) the per-person total at max values breaks mid-number at 360px ("₦249,750,000," then "000"), because the 40px text is about 390px wide in a 328px column. Plan: a small pure function picks `--t-2xl` for 11 characters or fewer and `--t-xl` for 12 or more, with `whitespace-nowrap` and `overflow-wrap: anywhere` kept only as a safety net; check 320 and 360px with max values, and note it in DESIGN §4 and §11. (2) A long stepper hint ("That number no make sense. We kept your old one.") wraps to four lines in the 144px quantity column from 480px up; consider one full-width hint row under the price and quantity row. (3) At 360px a shared line is about 450px tall (four stacked controls); revisit with the sticky damage meter, and only if it still feels long. (4) Five solid ink "Shared | Per person" bars are the heaviest element in the list (per DESIGN §5.5); revisit only if they compete with the totals.

### Slice 5: Currency and rates (1.0h) *(UI_PLAN S4)*
- [ ] **T5.1 Currency control and display conversion** (0.5h)
  - Build: three-option control with Phosphor currency icons and text labels; all amounts converted for display only.
  - Done when: switching ₦/$/£ never changes the tier or stored ₦ values; displayed total equals the sum of displayed lines.
  - Depends on: T3.1, T4.2.
- [ ] **T5.2 Rates panel** (0.5h)
  - Build: inline panel with two inputs, "as of <date>" vs "Custom rates" tag, "Reset rates"; defaults and date from `config/` (you set real values from a real source before launch).
  - Done when: out-of-range rate shows a hint and keeps the old rate; rate 0 is impossible; custom-rates tag appears when edited.
  - Depends on: T5.1.

### Slice 6: Danfo header, damage meter, live receipt (1.75h) *(UI_PLAN S5)*
- [ ] **T6.1 Danfo band header, stripe, footer** (0.5h)
  - Done when: header band and stripe render in light and dark; currency control sits in the band; footer note present; optional "Built in Lagos by <name>" only when `AUTHOR_NAME` and `AUTHOR_URL` are set.
  - Depends on: T5.1.
- [ ] **T6.2 Damage meter** (0.5h)
  - Build: sticky bottom bar (black, yellow digits), "See receipt" jump, hides when the receipt is in view, iOS safe-area padding, hidden polite live region announcing totals after about 600ms.
  - Done when: no count-up animation; meter text passes contrast; screen reader announces once per settled edit.
  - Depends on: T3.3.
- [ ] **T6.3 Printer slot and HTML receipt** (0.75h)
  - Build: slot bar, on-screen receipt with POS header lines, status, balance line, AUTH line, stamp with "thump" (reduced-motion fallback); desktop sticky right column.
  - Done when: layout matches the export bands in DESIGN.md §7; stamp changes on tier change and is static under reduced motion.
  - Depends on: T6.1.

### Slice 7 ⚠: Canvas receipt renderer (2.25h) *(UI_PLAN S6)*
- [ ] **T7.1 `ReceiptView` builder** (0.5h)
  - Build: pure function from state to the display-ready `ReceiptView` (DATA_MODEL §6) including `balanceLine`, `authCode`, `ratesNote`, `siteUrl`.
  - Done when: unit tests cover custom rates note, auth code stability (same input, same code), formatted amounts equal the on-screen values.
  - Depends on: T3.1, T5.2.
- [ ] **T7.2 Canvas renderer** (1.0h)
  - Build: `lib/receipt` drawing the bands from DESIGN.md §7, auto-fit for large amounts, fonts loaded first, colours from `--receipt-*` resolved once. Start from the spike code. Load fonts by the first family only (see the T2.2 decisions).
  - Done when: `max-values` fixture has no clipped digits; all essential text at least 30px; ₦ renders; output matches the on-screen receipt's numbers.
  - Depends on: T7.1, T2.2 (decisions).
- [ ] **T7.3 Ink-stamp texture and pre-render cache** (0.75h)
  - Build: seeded speckle texture on the stamp; dynamic import of the renderer when the receipt nears the viewport; debounce about 500ms after the last edit; keep the latest PNG blob.
  - Done when: same input gives the same stamp texture; blob is ready before a normal tap; first-load JS is unchanged by the renderer (it's a separate chunk); render time on a mid-range phone noted (**VERIFY**).
  - Depends on: T7.2.

### Slice 8 ⚠: Share link, resume, notice (1.75h) *(UI_PLAN S7)*
- [ ] **T8.1 Encode/decode with the 20 bad-link tests** (1.0h)
  - Build: `lib/share` per DATA_MODEL §4 (grammar, allow-list, length cap, strict parsing, clamping, decode result codes).
  - Done when: **all 20 cases in DATA_MODEL §9.1 pass** (default scenario, never throws), round trip holds for the 3 presets and the worst case, link under about 200 characters.
  - Depends on: T3.2.
- [ ] **T8.2 Load precedence, copy link, notice, local save** (0.75h)
  - Build: hash then localStorage then default; "Copy link" with select-and-copy fallback; non-blocking notice banner; debounced local save (all in try/catch).
  - Done when: a link opened in a fresh tab reproduces the numbers; works with `localStorage` blocked; the worst-case link pasted into WhatsApp opens identically on two devices.
  - Depends on: T8.1, T5.2.

### Slice 9 ⚠: Export UX and fallbacks (1.25h) *(UI_PLAN S8)*
- [ ] **T9.1 Export handler chain** (0.75h)
  - Build: click handler using the pre-built blob: `canShare` then `share`, else download anchor, else inline image; cancel (`AbortError`) is silent; if the blob isn't ready, show "Printing…" and ask for another tap.
  - Done when: **no `await` of rendering sits between the tap and `share()`**; matches the decisions recorded in T2.2 on every device in the matrix.
  - Depends on: T7.3.
- [ ] **T9.2 Status line, in-app hint, retry, alt text** (0.5h)
  - Build: status line with icons for every outcome in UI_PLAN §1.1, in-app-browser hint, retry on failure, `alt` text for the inline image.
  - Done when: each outcome (shared, downloaded, inline, cancelled, each failure reason) shows the right message; blocked download falls to the inline image.
  - Depends on: T9.1.

### Slice 10: CTA, OG image, meta, analytics (1.0h) *(UI_PLAN S9)*
- [ ] **T10.1 Flag-controlled CTA card** (0.4h)
  - Done when: card renders only when the flag is exactly `true` **and** the URL parses as `https:`; no leftover gap otherwise; `rel="noopener noreferrer sponsored"` and disclosure line when set; component tests cover on, off, invalid URL.
  - Depends on: T6.3.
- [ ] **T10.2 OG image, metadata, favicon** (0.3h)
  - Build: a sample danfo debit-alert receipt as `og-image.png`, title and description in the app's voice, favicon (₦ on yellow, or a simple yellow block if ₦ is illegible at 16px).
  - Done when: pasting the URL into WhatsApp and X shows the image and title (note: WhatsApp and X cache previews, so test with a fresh URL if needed).
  - Depends on: T1.3.
- [ ] **T10.3 Umami and `track()`** (0.3h)
  - Build: Umami script in `layout.tsx` (site ID in config), `track()` adapter that never throws, events `receipt_export`, `link_copy`, `cta_click` (only when shown), optional `preset_selected`, with the property rules in DATA_MODEL §7.
  - Done when: events fire once per action; no amounts, headcounts, rates or share strings are ever sent; the app works with the script blocked.
  - Depends on: T9.2, T8.2.

### Slice 11: Polish, accessibility, QA, launch prep (2.0h) *(UI_PLAN S10)*
- [ ] **T11.1 Sleekness pass and screenshots** (0.75h)
  - Done when: DESIGN.md §11 checklist walked; screenshots at 360 / 768 / 1280 in light and dark reviewed; nothing generic or cheap-looking left from the checklist.
- [ ] **T11.2 Accessibility and end-to-end** (0.75h)
  - Done when: axe shows no violations on the main page; whole flow works by keyboard only; one Playwright flow passes (default, edit, switch currency, copy link, open link in a fresh page, numbers match, export triggers a download).
- [ ] **T11.3 CSP, final device test, launch** (0.5h)
  - Build: Content-Security-Policy in `public/_headers` **last**, test, and loosen if fonts, Umami or the page break.
  - Done when: no console errors; the `/spike` route is deleted; full loop retested on a real iPhone and Android; real preset prices and rates are in `config/`/`data/`; custom-domain decision (O2) made; launch posts drafted.
  - Depends on: everything above.

### Parallel tracks (not in the 18.75h)

- [ ] **R1 Price research for presets** (about 1.0h): collect about 10 public data points (short-let nightly rates, ticket ranges, table minimums, ride and security day rates), round them, fill the 3 presets and the tier thresholds (O1), show the presets to 3 people in Lagos for a "does this feel real?" check. **Do it Saturday evening or Sunday morning, before Slice 4 polish.** Also set real default exchange rates and the "as of" date from a real source.
- [ ] **C1 Copy refinement** (about 1.0h): badges, taglines, balance lines, microcopy (DESIGN.md §9), CTA text if used. Do it Monday or Tuesday morning.

---

## 2. Order and risk

Riskiest and least-familiar work comes first, while changing course is cheap.

| Task | Why it's risky | What to do if it goes wrong |
|---|---|---|
| **T1.2 Fonts and icons** | ₦ glyph may be missing from Space Mono; icon names unconfirmed; subset behaviour assumed | Swap the mono; swap missing icons; both are one-line changes |
| **T1.3 Cloudflare deploy** | Pages vs Workers wording, Node version, first-time setup | Time-box to 1h; switch to another static host rather than debug |
| **T2.x Export spike** | Canvas, fonts, Web Share and in-app browsers are the least predictable part (no authoritative docs for in-app browsers) | Fall back to inline "press and hold" as the main path there |
| **T7.2 / T7.3 Renderer and pre-render** | Auto-fit text, font timing, render speed on weak phones | Drop the ink texture first; keep the flat stamp |
| **T8.1 Share codec** | Strict validation is fiddly; WhatsApp mangling of links | The 20-case test table catches most of it; shorten the format only if the length test fails |
| **T9.1 Gesture handling** | `share()` needs transient activation (W3C spec); iOS has been reported to drop it after async work | Pre-render (already in the plan); if it still fails, "tap again when ready" |
| **T4.1 Number input** | Caret jumping while formatting separators | Format on blur only if live formatting can't be made stable |
| **T11.3 CSP** | Can break fonts, Umami or Next's inline scripts | Add last, test, loosen; ship without CSP rather than ship broken |

---

## 3. Definition of done (every slice)

- [ ] Works end to end on the deployed URL and on a real phone (not only localhost)
- [ ] Tests for the new logic pass (focused tests during work; type-check, lint and the relevant test suite once before moving on)
- [ ] All states in DESIGN.md §6 that the slice touches are handled (loading, empty, error, success, partial, offline, permission-denied); no blank screen, endless spinner or raw error
- [ ] Works at 360px, 768px and 1280px in light and dark; no horizontal scroll; no layout shift
- [ ] Inputs are 16px, every control has a label, focus is visible, keyboard works
- [ ] Strict TypeScript, no `any`; external input (hash, typed numbers) validated
- [ ] No console errors or warnings
- [ ] No secrets in the code (there are none; `NEXT_PUBLIC_*` values are public by design)
- [ ] First-load JS checked against the budget after any slice that adds a dependency
- [ ] Committed with a clear message and pushed (auto-deploys)
- [ ] **Launch-day only:** `/spike` removed, real prices and rates in place, CSP tested, analytics events verified

---

## 4. Time estimate per slice

| Slice | Hours | If it overruns, cut |
|---|---|---|
| 1 Scaffold, tokens, deploy | 1.5 | nothing; it's the foundation |
| 2 Export spike | 1.0 | nothing; it gates the design |
| 3 First paint | 2.0 | nothing |
| 4 Editing | 3.25 | "Apply to all shared" and "Reset to preset" (0.3h) |
| 5 Currency and rates | 1.0 | nothing |
| 6 Header, meter, live receipt | 1.75 | stamp animation (0.15h), desktop two-column layout (0.4h) |
| 7 Canvas renderer | 2.25 | ink texture (0.4h) |
| 8 Share link | 1.75 | local save and resume (0.3h) |
| 9 Export UX | 1.25 | nothing |
| 10 CTA, OG, analytics | 1.0 | analytics beyond `receipt_export` (0.2h) |
| 11 Polish and QA | 2.0 | print-feed animation and haptic (0.35h, never built unless time) |
| **Build total** | **18.75** | |
| R1 research + C1 copy | 2.0 | R1 can't be skipped; C1 can be trimmed |
| **Everything** | **about 20.75** | |

### Cut ladder (apply from the top when behind; about 2.1h in total)
1. Print-feed animation and Android haptic (0.35h)
2. Ink-stamp speckle texture, keep the flat stamp (0.4h)
3. Local save and resume (0.3h)
4. "Apply to all shared" and "Reset to preset" (0.3h)
5. Analytics beyond `receipt_export` (0.2h)
6. Desktop two-column layout, keep the centred column (0.4h)
7. Stamp animation, keep the static stamp (0.15h)

**Never cut:** the export spike, the export path (Slices 7 and 9), the share link (Slice 8), the shared/per-person split, the estimates label.

### Suggested schedule (assumes about 5 to 6h per day; adjust to your real availability)

| Day | Plan | Hours | Checkpoint at end of day |
|---|---|---|---|
| **Sat Nov 21** | Slices 1, 2, R1, Slice 3 | about 5.5 | Live URL; spike matrix filled in and export path decided; first-paint page deployed |
| **Sun Nov 22** | Slices 4, 5, 6 | about 6.0 | Fully editable calculator with currency, meter and live receipt, usable on a phone. **Scope freeze** |
| **Mon Nov 23** | Slices 7, 8, 9 | about 5.25 | Edit, copy link, open elsewhere, export a real receipt on devices. **Seed it to 10 to 20 people in 3 to 4 group chats** (Risk 5) |
| **Tue Nov 24** | Slices 10, 11, C1, launch | about 4.0 | Polished, CSP tested, real numbers in; launch posts out |

If Saturday ends without the spike decision, stop and fix that before Sunday's slices, because Slices 7 and 9 depend on it.

---

## 5. Demo milestones

| After | What you should be able to screen-record |
|---|---|
| **Slice 3** | First paint at 360px: danfo header, real numbers, stamp. Share it with one friend for a gut check |
| **Slice 5** | Editing and switching currency, the "it's instant" clip |
| **Slice 9** | The full loop: edit, copy link, open on a second phone, export a receipt, post it. This is your launch video and your portfolio demo |
| **Launch** | Post the real receipt plus the clip; add the live URL to your portfolio and README |

---

## 6. Next steps in the playbook

- **Prompt 6 / 7:** build slice by slice, starting with Slice 1. For each slice, paste this plan's slice section, the relevant docs, and what already exists.
- **Prompt 8 (review and security audit):** run it after Slice 9 (Monday) and again before launch.
- **Prompt 9 (README):** after launch, using the live URL; the demo clips from §5 feed the README.
