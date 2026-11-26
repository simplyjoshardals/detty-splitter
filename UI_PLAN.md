# UI_PLAN.md: Backend contract, frontend architecture, UI slices

> Prompt 4, steps 4 to 6. Mode: NEW PROJECT. Companion to DESIGN.md.
> Section 1 gets applied to DATA_MODEL.md and ARCHITECTURE.md (already done, see §1.4).
> Section 3 (slices) is what you paste into Prompt 5 / BUILD_PLAN.md.
> **VERIFY** = not confirmed from docs.

---

## 1. Backend contract

There is **no backend**. The "contract" is the set of typed boundaries between the UI and the pure `lib/` modules, plus a few things the UI needs that the earlier docs didn't cover.

### 1.1 States the UI must tell apart

**Share-link decoding** (S6 notice and logging):

| Code | Meaning | UI |
|---|---|---|
| `empty` | No hash | Load default silently |
| `too_long` | Hash over 300 characters | Notice |
| `bad_chars` | Character outside the allow-list | Notice |
| `bad_version` | Not `v1` | Notice |
| `bad_structure` | Wrong field count or bucket field count | Notice |
| `bad_value` | Non-digit, leading zero, empty number, wrong enum, over digit cap | Notice |
| `ok` (with `clamped: FieldName[]`) | Valid, some numbers clamped | Load, show a clamp hint on those fields |

All rejected codes show the same user-facing notice. They are kept distinct so tests can assert each path.

**Export** (S4 states):

| Outcome | UI |
|---|---|
| `rendering` | Button reads "Printing…" |
| `not_ready` (tap before the blob exists, in a browser that can share files; or the wait ran out) | Status "Printing…" and a request to tap again. Built in T9.1: it is the handler's result, `rendering` above is the button label. Where sharing is impossible the tap waits for the blob instead (status "Printing…") and finishes on the first tap |
| `ready` (blob available) | Primary button is instant, status "Receipt ready" |
| `shared` | Success status |
| `cancelled` (`AbortError`) | Silent, no error |
| `downloaded` | Success status |
| `inline` | Show image with "press and hold to save" |
| `failed` (with `reason: 'font' \| 'draw' \| 'blob' \| 'unknown'`) | Error status plus retry (`prerender.retry()`, T9.2) |

**Clipboard:** `copied`, `denied` (show select-and-copy field).

### 1.2 Typed boundaries (shapes only)

```ts
type FieldName = 'groupSize' | 'ngnPerUsd' | 'ngnPerGbp' | `${BucketId}.${'unitPriceNgn' | 'quantity' | 'headcount'}`

type DecodeResult =
  | { ok: true; state: AppState; clamped: FieldName[] }
  | { ok: false; code: 'empty' | 'too_long' | 'bad_chars' | 'bad_version' | 'bad_structure' | 'bad_value' }

type ExportMethod = 'share' | 'download' | 'inline'
type ExportOutcome =
  | { status: 'shared' | 'downloaded' | 'inline'; method: ExportMethod }
  | { status: 'cancelled' }
  | { status: 'failed'; reason: 'font' | 'draw' | 'blob' | 'unknown' }

// what the tap handler returns (T9.1, lib/export). 'not_ready': there is no blob yet, so the
// UI says "Printing…" and asks for another tap. A pre-render 'load' failure (the renderer
// chunk did not import) is reported as reason 'unknown'.
type ExportResult = ExportOutcome | { status: 'not_ready' }

// field draft held by the input component while typing (not in AppState):
// the typed text, or null when the field isn't focused. lastGood is the saved prop value.
interface FieldDraft { text: string | null; lastGood: number }

// parse result for any numeric input (lib/input). value is always safe to write.
type ParseResult =
  | { status: 'ok'; value: number }
  | { status: 'clamped'; value: number; bound: 'min' | 'max' }
  | { status: 'reverted'; value: number; reason: 'empty' | 'invalid' | 'decimals' | 'range' }
// 'decimals' (too many digits after the point) and 'range' (outside min..max when the range says
// onOutOfRange: 'revert') only come from ranges with `decimals`, i.e. the rates (T5.2).
```

`ReceiptView` stays as defined in DATA_MODEL.md §6. The UI never passes raw state to the renderer.

### 1.3 Demo and fixture data needed to make the UI look real

| Fixture | Purpose |
|---|---|
| Default scenario with placeholder prices | First paint (clearly labelled as estimates; real prices wait for your research) |
| `all-zero` state | Empty state, Tier 1 |
| `tier-boundaries` (299,999 / 300,000 / 749,999 / 750,000 …) | Tier reveal and boundary tests |
| `max-values` (₦50,000,000 × 999, group size 100) | Overflow: fields, line items, receipt auto-fit |
| `custom-rates` state | "Custom rates" tag, receipt note |
| `mixed-modes` (headcounts differing from group size) | Partial state |
| Bad-link fixtures | The 20 cases in DATA_MODEL.md §9.1 |

### 1.4 Doc changes applied (so nothing is left dangling)

**ARCHITECTURE.md**
- Flow A, export step: the PNG is **pre-rendered before the tap**, so the share call runs inside the click. Reason below (§2.5).
- Styling decision: Tailwind v4 CSS-first with tokens in `app/globals.css`; `next/font` variables named `--font-bricolage` and `--font-jetbrains`.
- No in-app theme toggle in MVP (system theme only).

**DATA_MODEL.md**
- New §11 "UI contract" with the decode codes, export outcomes, field-draft behaviour and the fixtures above.

---

## 2. Frontend architecture

### 2.1 Server vs client boundaries

| Piece | Boundary | Why |
|---|---|---|
| `app/layout.tsx`, `app/page.tsx` | Server components (rendered once at build) | Static shell, fonts, metadata, OG tags, analytics script |
| `<Calculator />` (everything interactive) | One `'use client'` boundary | All state lives here; still pre-rendered to HTML at build, so first paint shows defaults |
| `lib/*` | Plain TypeScript, no React | Testable, shared by UI and renderer |
| `lib/receipt/*` (the canvas renderer, T7.2) | Loaded with a dynamic `import()` | Keeps first-load JS small. `lib/receipt/view.ts` (the `ReceiptView` builder, T7.1) is the exception: it is small, pure and imported statically by the on-screen receipt |

Keep the client boundary as low as practical: static copy (footer, headings) can stay in server components passed as children.

### 2.2 State

- `useReducer` + context in `state/`. Actions: select preset (also "Reset to preset": the same action with the current preset id), set bucket number (price, quantity, headcount), set bucket mode, set group size, apply group size to shared, set currency, set rate, reset rates, load state (from link or storage; `loadState`, T8.2). `setCurrency` (T5.1) changes only `currency`; an unknown code is ignored and an unchanged value returns the same state object, like the other actions. `setRate` (T5.2) writes one of the two rates, clamped into 50 to 100,000 (so 0 is impossible) and ignores a value that is not finite or has more than 2 decimals; `resetRates` restores `DEFAULT_RATES` and nothing else.
- **Hydration rule:** the first client render must match the server HTML (the default scenario). After mount, an effect applies hash, else localStorage, else leaves the default. Result: link receivers see the defaults for a moment before their numbers swap in. This is a small, known flash; accept it, and mark the results region `aria-busy` for that frame. **Built in T8.2:** the provider holds `{ app, hydrated, linkNotice }` (`state/session.ts`, a reducer that wraps the app reducer). One effect after mount reads `location.hash` and the snapshot, calls `resolveInitialState` and dispatches a single `hydrated` action, so the loaded state, `hydrated` and the notice change in the same render. The context also exposes `hydrated` (use it for `aria-busy`), `linkNotice` and `dismissLinkNotice`. `loadState` sends the state through the codec again (clamping), so a hand-built out-of-range state can never be stored. Saving is `state/useLocalSave.ts` (rules in DATA_MODEL §5). **UI side, built in T8.2:** `ResultsPanel` sets `aria-busy={!hydrated}`; `LinkNotice` reads `linkNotice` and `dismissLinkNotice`; `ShareBar` reads `state` only and builds the link when tapped (DESIGN §5.9, §5.11, §5.16). **Link opened in an open tab (T8.2 fix):** the hydrate effect runs once, so a second link that only changes the hash (WhatsApp reusing the tab) is applied by a `hashchange` listener in the provider through a `linkOpened` session action; the session also holds `baseline`, which the saver compares against so a loaded link is never saved as an edit. The `aria-busy` frame belongs to the first load only.
- Input drafts (`FieldDraft`) live inside the field component, so typing "1,5" never writes a half-parsed number into AppState.

### 2.3 Data fetching and caching

None. No network calls after first load other than the analytics script. No caching layer needed.

### 2.4 Forms and validation

No form library. Each numeric field uses the same `parseNumberInput(text, range, lastGood)` from `lib/input`, returning `ParseResult`. Ranges (`RANGES`) come from DATA_MODEL.md §2.2. On blur or Enter: clamp, revert to `lastGood` if empty or invalid, and show the hint from §9 of DESIGN.md. A range can add `decimals` (a decimal point, rates only) and `onOutOfRange: 'revert'`, which keeps `lastGood` with a hint instead of clamping; the two rate fields use both (`RANGES.rate`). The field only reports the hint (`hint`, `onHintChange`, `hintId` props). The row that holds the fields owns it (`useRowHint`) and draws one hint in a reserved slot below its controls, starting with the field's name (DESIGN §4, §5.2), so a hint never moves a control the user is about to tap.

### 2.5 Export architecture (important)

`navigator.share()` needs transient user activation, and the W3C spec says it rejects with `NotAllowedError` without it. A WebKit bug report also describes iOS losing the gesture after a few seconds of async work before `share()` (a 2022 report on iOS 15.4.1; I can't confirm current iOS behaviour). So the design avoids async work between the tap and the share:

1. When the receipt section nears the viewport (or on first idle), dynamically import the canvas renderer, `lib/receipt/render.ts` (it pulls in `layout.ts`; not `view.ts`, which the page already has).
2. After the user stops editing (about 500ms debounce), render the PNG **blob in the background** and keep the latest one.
3. On tap: the click handler immediately calls `canShare` and `share` with the already-built blob, with no `await` of rendering in between. If the blob isn't ready yet, show "Printing…" and **ask the user to tap again** when it's ready, rather than risking a lost gesture. **Refinement (T9.1):** that applies only where the browser can share files. A browser that can't share files, or where sharing is skipped (every desktop, T2.2 decision 6), has nothing that needs the gesture, so the tap waits for the blob (up to 10 seconds) and then downloads or shows the inline image, so it finishes on the first tap.
4. Fallbacks: download anchor, then inline image with "press and hold to save".
5. **VERIFY** on real iPhone, Android, and in-app browsers (Day 1 spike).

**Built in T9.1 (Part A):** `exportReceipt()` in `lib/export/index.ts` (browser wrappers in `browser.ts`). It is deliberately not `async`: it reads `prerender.getSnapshot()`, builds the `File`, and calls `canShare` then `share()` in the same tick as the tap; only the promise `share()` returns is awaited. Chain: `canShare({ files })` true, then `share()`; `AbortError` gives `cancelled` and does not fall through; any other rejection, a throwing or missing `canShare`, or no `File` support goes to the download anchor; an unsupported or throwing anchor gives `inline` (no URL: the component builds and revokes its own). If the blob is not ready it calls `prerender.start()`, so a tap before the pre-render began cannot wait or say "Printing…" forever; a `load` failure also calls `start()` to retry the import. Then it asks the browser, with an empty PNG `File` and `canShare`, whether sharing is possible (no API, `false` and a throw all mean no). If yes it returns `not_ready` (tap again, because waiting would lose the gesture). If no it subscribes to the pre-render and waits (`WAIT_FOR_BLOB_MS`, 10 seconds) for `ready` or `failed`, then downloads or returns `inline` on that first tap; a timeout is `not_ready`. It always unsubscribes and clears its timer. `browserExportEnv()` leaves `share` and `canShare` undefined unless `(pointer: coarse)` matches (or `matchMedia` is missing), so a desktop goes straight to the download and finishes on the first tap. Nothing throws or rejects. The saved file is named `detty-splitter-receipt.png`. Matching T2.2 decisions 1 to 3 on real devices is checked by the author (see BUILD_PLAN T9.1).

**Built in T9.1 (Part B):** `components/ExportButton.tsx` (client, above `ShareBar` in the sticky column). It reads the pre-render with `useSyncExternalStore` (server snapshot `idle`) only for the button label and the "ready" message; the tap calls `exportReceipt()` with nothing awaited first. `aria-disabled`, not `disabled`, while the PNG is not ready, so the tap still gets the "tap again" answer (or, where sharing is impossible, the wait). While a tap waits the status reads "Printing…" and a second tap is ignored. The result (shared, saved, inline, failed) belongs to one set of numbers and is dropped when they change; a result that arrives after they changed is ignored. The inline image is built from the blob that is ready when the result lands and its object URL is revoked when it is hidden or on unmount. DESIGN §5.1, §5.9, §5.10 and §9 have the look and the copy.

**Built in T9.2 (Part A):** `prerender.retry()` in `lib/receipt/prerender.ts`. It does nothing unless the snapshot is `failed`. After a failed import it imports again and then draws; after a failed draw it draws again at once with no debounce. `start()` and `update()` cannot recover a failed draw, which is why it is needed. `isInAppBrowser(userAgent)` in `lib/export/browser.ts` is a best-effort check used only for the hint; the export chain never branches on it (T2.2 decision 4). The export contract is unchanged.

**Built in T9.2 (Part B):** `components/ExportButton.tsx` now gives every outcome an icon and a line (DESIGN §5.9, §9). A failure names its reason (`font` has its own line; `draw`, `blob`, `unknown` and a renderer that did not load share one) and shows Retry. Retry calls `prerender.retry()` and then the same tap as the Export button, so a browser that cannot share files finishes the export on that press, and one that can ends at "tap again". In an in-app browser (`isInAppBrowser`, read once after hydration through `useSyncExternalStore`, server value `false`), a saved download, the inline image and a failure also show a tip to open the page in the browser. The inline caption follows the pointer (press and hold, or right-click) and the image `alt` restates tier and totals. The cancelled share is still silent. Contract unchanged.

### 2.6 UI testing

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | `lib/calc`, `lib/money`, `lib/rates`, `lib/share` (all 20 bad links, round trip), tier lookup, `parseNumberInput` |
| Component | Vitest + React Testing Library | BucketEditor (mode switch, headcount, clamp hint), CurrencyToggle, ShareBar (copied/denied), ExportButton (not ready, ready, shared, cancelled, downloaded, inline, failed), CtaCard (hidden when flag off or URL invalid). Query by role and label, no snapshots |
| End to end | Playwright, one flow | Default → edit a bucket → switch currency → copy link → open link in a fresh page → numbers match → export triggers a download |
| Accessibility | axe check inside the Playwright flow (**VERIFY** current package/version) plus a manual keyboard pass | No violations on the main page; whole flow by keyboard |
| Devices | Manual | Receipt export on real devices (cannot be automated reliably) |

Versions of Vitest, Playwright and testing libraries: check on install (not verified here).

### 2.7 UI libraries

| Need | Choice | Why |
|---|---|---|
| Styling | Tailwind v4 (CSS-first) | Already in your stack, zero runtime |
| Fonts | `next/font/google`: Bungee + Space Mono (latin + latin-ext, for the ₦ sign) | Self-hosted at build, no runtime request |
| Icons | **Phosphor** (`@phosphor-icons/react`), bold weight, named imports, `experimental.optimizePackageImports` | Your pick. Tree-shakable per its README; not in Next's default optimized list, so check the bundle after install. Icon map in DESIGN.md §2 |
| Animation | CSS only | Only four tiny transitions (DESIGN.md §7) |
| Components | Hand-written | About 8 small components; a library would cost bundle and fight the look |
| Class merging | Optional tiny helper, or template strings | Avoid a dependency unless needed |

First-load JS budget: keep the starting guess of about 150 KB gzipped (REQUIREMENTS §6). **VERIFY** against the `next build` output after Slice 2, and fix early if it's over.

---

## 3. UI slices (paste into BUILD_PLAN.md / Prompt 5)

Ordered so the riskiest work lands first while it's cheap to change course, then by what a first-time visitor sees first. There is no backend, so each slice pairs its UI with the `lib/` logic it needs. **Risky** slices are marked ⚠.

- [ ] **S0 ⚠ Receipt export spike** (about 1.0h)
  - Screens/states: S4 only, throwaway page.
  - Pair: minimal canvas renderer with hard-coded `ReceiptView`; font loading via CSS variable.
  - Acceptance: a mock 1080×1920 receipt exports as PNG on a real iPhone, a mid-range Android, and in WhatsApp, Instagram, TikTok and X in-app browsers; Web Share with file works or falls back to download or inline image; font is correct (not fallback); pre-rendered blob → immediate `share()` works on iOS Safari. Record what fails and decide the fallback now.
  - Cut rule: if canvas fails in in-app browsers, ship the inline "press and hold" path as the main route there.

- [ ] **S1 Scaffold, tokens, fonts, icons, deploy** (about 1.5h)
  - Screens/states: S1 shell, S7 404.
  - Pair: `create-next-app` (no `src/`), `output: 'export'`, tokens and fonts from DESIGN.md, `config/` with SITE_URL and CTA flag, `_headers` stub, Cloudflare deploy of a hello page.
  - Acceptance: live `.pages.dev` URL renders the tokens in light and dark; no console errors; fonts self-hosted; `next build` output checked against the JS budget. **Font test:** `₦1,234,567.89 $ £` renders correctly in Space Mono (swap the mono if not). **Icon test:** list the package's exports and assert every name in DESIGN.md §2 exists (swap any missing); bundle checked after adding Phosphor.

- [ ] **S2 First paint: defaults, read-only results** (about 2.0h)
  - Screens/states: S1 (loading, success), S3 (static).
  - Pair: `lib/calc`, `lib/money`, `data/presets` (placeholder values), reducer skeleton, line-item list, per-person and group totals, tier stamp, header, footer note.
  - Acceptance: the golden example in DATA_MODEL.md §2.5 renders exact numbers; works at 360, 768, 1280px; no layout shift on font load; unit tests for calc, rounding and tier boundaries pass.

- [ ] **S3 Editing: buckets, modes, route plates, group size** (about 3.25h)
  - Screens/states: S1 (all input states: default, focus, error, clamped, empty).
  - Pair: number input with separators and draft handling, stepper (Phosphor Plus/Minus), segmented control, shared/per-person with headcount, **route plates** (presets, with Phosphor icons and a non-colour-only selected state), bucket icon tiles, group-size stepper, "Apply to all shared", "Reset to preset".
  - Acceptance: typing never produces `NaN`; clamp hints appear; iOS doesn't zoom (16px inputs); keyboard-only works; component tests for mode switch and clamping pass.

- [ ] **S4 Currency toggle and rates** (about 1.0h)
  - Screens/states: S1, S2 (inline panel).
  - Pair: currency segmented control, rates panel with "as of" date or "custom rates" tag, "Reset rates".
  - Acceptance: switching ₦/$/£ never changes the tier or the stored ₦ values; the displayed total equals the sum of displayed lines (per the rounding rule); out-of-range rate shows a hint.

- [ ] **S5 Danfo header, damage meter, live receipt** (about 1.75h)
  - Screens/states: S3 (all), sticky mobile results bar, desktop sticky right column.
  - Pair: danfo band header and stripe, **damage meter** sticky bar, printer slot and HTML receipt styled per DESIGN.md §7 (POS header lines, status, balance line, AUTH line), stamp "thump" with reduced-motion fallback, polite live region for totals.
  - Acceptance: matches the export layout bands; screen reader announces totals after a 600ms pause; meter respects the iOS safe area, hides when the receipt's totals are in view and always comes back when they leave, including on iOS Safari after momentum scroll, toolbar collapse and back/forward restore (the observer is backed by a manual re-measure); selected states pass the "not colour alone" check.

- [ ] **S6 ⚠ Canvas receipt renderer, final design** (about 2.25h)
  - Screens/states: S3 → S4 handoff.
  - Pair: `lib/receipt` from `ReceiptView`: danfo bands, POS slip lines, auto-fit large amounts, **seeded ink-stamp texture**, AUTH code, background pre-render with debounce and latest-blob cache.
  - Acceptance: export for the `max-values` fixture has no clipped digits; text ≥ 30px; colours match tokens; renders in under about 1s on a mid-range phone (verified in T7.2: about 200 ms, before the T7.3 texture); pre-rendered blob is ready before the user taps in normal use.

- [ ] **S7 ⚠ Share link, resume, notice** (about 1.75h)
  - Screens/states: S1 (loading swap), S6 (notice), clipboard `copied` / `denied`.
  - Pair: `lib/share` encode/decode per DATA_MODEL.md §4, load precedence (hash → localStorage → default), copy-link with select-and-copy fallback, debounced local save, notice banner.
  - Acceptance: all 20 bad-link cases load the default with the notice and never throw; round trip holds for all presets and the worst case; worst-case link pasted into WhatsApp opens identically on two devices; works with `localStorage` blocked.

- [ ] **S8 ⚠ Export UX and fallbacks** (about 1.25h)
  - Screens/states: S4 (rendering, ready, shared, cancelled, downloaded, inline, failed), in-app browser hint.
  - Pair: `lib/export` fallback chain, status line messages, inline "press and hold to save" image with alt text.
  - Acceptance: share cancel is silent; an unsupported or throwing download falls to the inline image (a refused download cannot be detected); in-app browser hint appears where applicable; every failure shows a retry; the click handler contains no `await` before `share()`.

- [ ] **S9 CTA card, OG/meta, analytics** (about 1.0h)
  - Screens/states: S5 (hidden / shown), page metadata.
  - Pair: flag-controlled `CtaCard` (valid `https:` URL only, `sponsored` rel, disclosure label), static `og-image.png`, title/description, Umami script and `track()` adapter with the events and property rules from DATA_MODEL.md §7.
  - Acceptance: card absent with no leftover gap when flag off or URL invalid; OG preview correct when the URL is pasted into WhatsApp and X; events fire once per action and never carry amounts or the share string.

- [ ] **S10 Polish, accessibility, QA** (about 2.0h)
  - Screens/states: all.
  - Pair: DESIGN.md sleekness checklist walkthrough, axe check, keyboard-only pass, 360/768/1280px and light/dark screenshot pass, CSP in `_headers` (last), final device test.
  - Acceptance: no console errors; no axe violations on the main page; CSP doesn't break fonts, Umami or the page; Lighthouse-style check on a throttled mobile profile (targets in REQUIREMENTS §6, **VERIFY** actual numbers).

**Total about 18.75h** of build time (the creative upgrades added about 1.25h: icons, danfo styling, damage meter, POS copy, ink stamp). Price research (about 1h) and copy refinement (about 1h) sit outside these slices, so the project now lands around 20.75h, **over your 15 to 20h window by about 1h**. The cut list below is how you close that gap; start from the top.

### If time runs out, cut in this order
1. Print-feed animation, Android haptic and the ink-stamp speckle texture (S5/S6). Keep the flat stamp.
2. Debounced local save and resume (S7).
3. "Apply to all shared" and "Reset to preset" (S3).
4. Custom analytics events beyond `receipt_export` (S9).
5. Desktop two-column layout (S5), falling back to the centred single column.
6. Stamp animation (S5), keeping the static stamp.

**Never cut:** S0, the export path (S6, S8), the share link (S7), the shared/per-person split, the estimates label.

### Demo milestones
- After **S2:** screen-record the first paint (defaults, totals, stamp) at 360px.
- After **S4:** record editing and switching currency (the "wow, it's instant" clip).
- After **S7 + S8:** record the full loop: edit → copy link → open in a second device → export a receipt. This is your launch video.