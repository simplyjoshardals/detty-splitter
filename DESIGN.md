# DESIGN.md: "Thermal Receipt, Lagos Edition" (v2)

> Direction A, chosen by Joshua, revised after his review: icons switched to **Phosphor**, and everything generic replaced with Lagos-specific identity.
> Paste this file into every later UI prompt. Supersedes the v1 DESIGN.md.
> Stack: Next.js App Router (static export), TypeScript, Tailwind v4 (CSS-first), `next/font`, `@phosphor-icons/react`.
> Contrast ratios below were computed (WCAG 2.x). **VERIFY** marks anything not confirmed from docs.

---

## 0. The idea

The page is a **POS terminal slip that just printed your December debit alert**, on a **danfo** (the yellow-and-black Lagos bus). Danfo yellow and black for the frame, cream paper for the slip, red rubber-stamp ink for the verdict. Everything the user sees on screen is what they post.

**Principles**
1. **The receipt is the hero.** Protect the numbers and the stamp.
2. **Be Lagos, not "receipt-core".** Cream paper plus monospace alone is a common aesthetic (receipt-styled generators are everywhere). The danfo palette, the POS/debit-alert voice, the damage meter and the route plates are what make it ours.
3. **Paper is a physical object.** The slip stays cream-and-ink in both themes, so exports look identical for everyone.
4. **Flat and fast.** Borders, bands, one hard shadow. No blur, glow, gradients or images.
5. **Creative where it's seen, plain where it's used.** Presets, the meter, the stamp and the receipt copy get personality. Number inputs and steppers stay boringly fast.

---

## 0.1 Generic audit: what changed and why

| Element (v1) | Why it was generic | v2 replacement |
|---|---|---|
| Orange accent | A default "warm brutalist" accent with no tie to Lagos | **Danfo yellow `#FFC400`** (fills) + black ink + **red stamp ink `#C4271B`** |
| Bricolage Grotesque + JetBrains Mono | Both are very common picks; JetBrains Mono reads as a developer tool | **Bungee** (sign-painter display) + **Space Mono** (POS-slip feel). Bungee is built around urban signage (per its designer's notes) |
| Unicode glyphs for icons | Default and inconsistent | **Phosphor** icon set, bold weight, one system (§2) |
| Plain segmented preset control | Looks like every settings toggle | **Route plates**: three destination-board plates (danfo route-board style) with icons |
| Plain sticky bottom bar | Generic app chrome | **Damage meter**: black fare-meter bar, yellow digits, label "DAMAGE METER" |
| Dashed rules and a stock "receipt" | A trope on its own | **POS slip + debit alert** copy: merchant line, "STATUS: APPROVED", "AVAIL BAL" per tier, "CUSTOMER COPY: keep your receipt, your account won't" |
| Orange rotated stamp | Clean vector stamp felt digital | **Red rubber-stamp ink** with a speckled, imperfect texture on the canvas |
| Torn paper edges, barcode | Decorative cliché, extra work | **Danfo stripe bands** top and bottom of the receipt; barcode replaced by a funny **AUTH code** line |
| Floating status text | Standard | Status line **with Phosphor icons** and conductor-style copy |
| Footer | Empty legal text | **"Built in Lagos by <name>"** link (config-driven), which also feeds your portfolio |
| Static OG image | Often an afterthought | The OG image **is** a sample danfo debit-alert receipt: the thing everyone sees first in WhatsApp |
| 404 | "Page not found" | "Wrong bus. This page no dey here." |

**Kept conventional on purpose:** number inputs, steppers, native radio semantics, visible labels. In the fastest-use controls, novelty slows people down.

---

## 1. Fonts

| Role | Font | `next/font` setup |
|---|---|---|
| Display: words only (wordmark, route plates, stamp, section labels, button labels) | **Bungee** (one weight, Regular) | `Bungee`, `weight: '400'`, `subsets: ['latin','latin-ext']`, `variable: '--font-bungee'` |
| Body and **all numbers and currency symbols** | **Space Mono** (400 and 700), except the ₦ glyph itself (next row) | `Space_Mono`, `weight: ['400','700']`, `subsets: ['latin','latin-ext']`, `variable: '--font-space-mono'` |
| The **₦ sign** (U+20A6) only | A one-glyph subset of **Space Grotesk** (400 to 700), `app/fonts/naira.woff2`, about 1 KB | `localFont`, `declarations: [{ prop: 'unicode-range', value: 'U+20A6' }]`, `variable: '--font-naira'`, placed before Space Mono in the font stack |

**Why the ₦ comes from another font (T5.2 review).** Space Mono's own ₦ is drawn short and squat, with heavy bars, so at 12px (the rate labels, the hint prefix, the "₦1,050,000 total ÷ 4" notes) and 14px (line totals) it read like a "#". Space Grotesk descends from Space Mono, and its ₦ is full cap height, so the N and both bars stay readable at every size. It is about 0.12em wider than a mono digit, which is fine for a sign that is never lined up in a column. The file is a subset (one code point, both weights), and the licence (SIL OFL 1.1) sits beside it in `app/fonts/`. Bungee still never draws a currency symbol. Anything that draws text outside the page DOM (the PNG receipt, T7) has to load this font as well, or the ₦ falls back to Space Mono's.

Verified: Bungee is a Google Font by David Jonathan Ross, designed around urban signage, a single Regular weight, SIL OFL. From the Next.js docs: multi-word names use underscores; non-variable fonts **need a weight**; fonts are downloaded at build time and self-hosted; the `variable` option feeds Tailwind.

**Two gotchas to check on day 1 (S1):**
1. **The ₦ sign (U+20A6).** On Google Fonts, that character sits in the `latin-ext` range, not `latin`, which is why both subsets are loaded. I believe this from how Google splits subsets, but I haven't confirmed it for these two fonts. **VERIFY** by rendering `₦1,234,567.89 $ £` in both fonts. Rule that limits the risk: **every number and currency symbol is set in Space Mono**, never Bungee, so only one font has to carry ₦.
2. **Space Mono's availability and glyphs** (₦, digits). If Space Mono fails the test, swap in another monospace (JetBrains Mono was the v1 choice and is a one-line change).

Two fonts total, no italics. `display: 'swap'`, automatic fallback adjustment left on. The canvas renderer reads the family from the CSS variable and waits for the fonts to load before drawing (verified in the spike, T2.2). Built in T7.2: it loads the first family only of `--font-bungee`, `--font-space-mono` and `--font-naira` (the naira face with the `₦` sample, because its `unicode-range` only downloads for that character), and draws numbers with the stack `naira, space-mono, monospace`, the same order as the page.

---

## 2. Icons: Phosphor

- Package: `@phosphor-icons/react`. Verified from its README: named imports, props `size`, `weight` (`thin`, `light`, `regular`, `bold`, `fill`, `duotone`), `color` (accepts `currentColor`), `mirrored`, plus standard SVG props; tree-shakable; the README recommends adding the package to `experimental.optimizePackageImports` for Next.js 13+. It is **not** in Next's default optimized list (checked), and Next's docs mark that flag experimental, so check the bundle after install.
- **Naming:** current README examples use an `Icon` suffix (`HeartIcon`). Older names without the suffix may be deprecated aliases. **VERIFY** at install.
- **Server vs client:** icons here live inside client components, so normal imports work. In a server component, use the `/ssr` submodule (the README gives both `/ssr` and `/dist/ssr`; check the installed package's exports). SSR icons can't read `IconContext`.
- **Style rules:** weight **`bold`** by default (matches the 2px borders), **`fill`** for selected states, **never `duotone`** (extra opacity layer, contrast risk). Sizes: 20 inline, 24 controls, 32 bucket tiles. Colour is always `currentColor`.
- **Accessibility:** decorative icons are `aria-hidden`; icon-only buttons carry an `aria-label`; meaning is never carried by an icon alone.
- **No icons on the canvas receipt.** The type, bands and stamp carry it (drawing icon paths adds work for no gain).

### Icon map

| Use | Icon | Status |
|---|---|---|
| Short-let bucket | `BedIcon` | Confirmed in Phosphor's Bold list |
| Concerts and raves | `TicketIcon` | Page exists (found in search) |
| Club tables | `ChampagneIcon` | Confirmed |
| Transport / SUV / security | `CarIcon` | Confirmed |
| Food and drinks | `BeerBottleIcon` | Confirmed (alternative: a fork-and-knife icon, to confirm) |
| Preset: Outside on a Budget | `BusIcon` (danfo) | Confirmed |
| Preset: Soft Life Standard | `ConfettiIcon` | Confirmed |
| Preset: Full IJGB / Baller Mode | `CrownSimpleIcon` | Confirmed |
| Currency control | `CurrencyNgnIcon`, `CurrencyDollarIcon`, `CurrencyGbpIcon` | Confirmed |
| Export receipt | `ReceiptIcon` | Used in T9.1 (`ExportButton`); confirm with `yarn check:icons` |
| Copy link | `CopyIcon` | Confirmed |
| Success status | `CheckIcon` | Confirmed |
| Export status: printing, tap again | `PrinterIcon` | Added in T9.2; checked by `yarn check:icons` |
| Export status: saved (download) | `DownloadSimpleIcon` | Added in T9.2; checked by `yarn check:icons` |
| Export status: inline image | `ImageIcon` | Added in T9.2; checked by `yarn check:icons` |
| See receipt (meter jump) | `ArrowDownIcon` | Confirmed |
| Reset to preset / rates, Retry export (T9.2) | `ArrowCounterClockwiseIcon` | Confirmed |
| Rates panel toggle | `CaretDownIcon` | Confirmed at install (`yarn check:icons`), added in T5.2; turned upside down while the panel is open |
| "Open in browser" hint | `DoorOpenIcon` | Confirmed |
| Steppers | `PlusIcon`, `MinusIcon` | Confirmed at install (`yarn check:icons`) |
| Mode switch: Shared / Per person | `UsersThreeIcon`, `UserIcon` | Confirmed at install (`yarn check:icons`), added in T4.2 |
| Error / clamp hint | `WarningIcon` | Confirmed (T4.4) |
| Dismiss (notice banner) | `XIcon` | Added in T8.2; checked by `yarn check:icons` |
| CTA button (opens a new tab) | `ArrowSquareOutIcon` | Added in T10.1; checked by `yarn check:icons`; imported from `@phosphor-icons/react/ssr` because the card is a server component |

**Install-time check (S1):** after installing, list the package's exports and assert every name above exists. Swap any missing one for the nearest icon on phosphoricons.com. I couldn't finish confirming the last three rows and the alternates because some lookups were blocked.

---

## 3. Design tokens

### 3.1 CSS variables (`app/globals.css`)

```css
:root {
  /* light */
  --paper:      #F4F1EA;  /* page background */
  --surface:    #FFFFFF;  /* inputs, raised rows */
  --ink:        #111111;  /* text, strong borders (16.7:1 on paper) */
  --muted:      #5C584F;  /* secondary text (6.3:1) */
  --border:     #77726A;  /* control borders (4.2:1) */
  --rule:       #B9B3A5;  /* decorative dashed rules only */
  --danfo:      #FFC400;  /* fills: header band, plates, primary button */
  --danfo-ink:  #111111;  /* text on danfo (11.8:1) */
  --stamp:      #C4271B;  /* red stamp ink, text (5.1:1 on paper) */
  --danger:     #B3261E;  /* error text (5.8:1) */
  --ok:         #1B6E3A;  /* success text (5.6:1) */
  --focus:      var(--ink);
  --meter-bg:   #111111;  /* damage meter */
  --meter-fg:   #FFC400;  /* meter digits (11.8:1) */

  /* receipt: fixed in both themes (a paper object) */
  --receipt-paper: #F4F1EA;
  --receipt-ink:   #111111;
  --receipt-muted: #5C584F;
  --receipt-stamp: #C4271B;
  --receipt-danfo: #FFC400;

  /* space (4px base) */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  /* shape */
  --r-sm: 2px;  --r-md: 4px;
  --bw: 2px;                 /* control border */
  --stripe: 6px;             /* danfo stripe height */
  --shadow-hard: 3px 3px 0 var(--ink);

  /* motion */
  --ease: cubic-bezier(.2, .8, .2, 1);
  --dur-fast: 80ms;
  --dur-base: 180ms;

  /* type scale */
  --t-xs: 12px; --t-sm: 14px; --t-base: 16px;
  --t-lg: 20px; --t-xl: 28px; --t-2xl: 40px; --t-3xl: 56px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper:     #0E0E0C;
    --surface:   #1A1A17;
    --ink:       #F4F1EA;   /* 17.1:1 */
    --muted:     #A29E93;   /* 7.2:1 */
    --border:    #8C887D;   /* 5.5:1 */
    --rule:      #4A473F;
    --danfo:     #FFC400;   /* 12.1:1 on dark paper */
    --danfo-ink: #111111;
    --stamp:     #FF6B5E;   /* 6.9:1 on paper, 6.2:1 on surface */
    --danger:    #FF7B6E;   /* 7.7:1 */
    --ok:        #5FD38D;   /* 10.3:1 */
    --focus:     var(--danfo);
    --meter-bg:  #000000;
  }
}
```

- Theme follows the system. **No in-app toggle in MVP** (saves a script and a flash of wrong theme).
- Dark mode is designed, not inverted: yellow stays yellow (it looks better on dark), the stamp lightens for contrast, focus switches from ink to yellow, and the **receipt stays cream**.
- **Selected state never relies on colour alone.** Yellow vs paper is only 1.4:1 as a fill, so selected plates also get the hard shadow, a thicker border, a `fill`-weight icon and a check mark.
- Focus: 3px solid `--focus`, 2px offset.
- **On-danfo scope (T6.1).** The header band carries the class `.on-danfo`, which sets `--ink` and `--muted` to `--danfo-ink`, `--surface` to `#FFFFFF` and `--focus` to `--danfo-ink`. The band is a light island in both themes. Without it, dark mode puts cream segment borders on yellow, 1.7:1 label text (`--muted` is 4.4:1 even in light) and a yellow focus ring on a yellow band. With it: labels and borders 11.8:1, segment text on white 18.9:1, focus ring 11.8:1 on yellow. Any future component placed on a danfo fill (a plate, a button) uses the same class instead of local overrides.
- **On-meter scope (T6.2).** The damage meter bar carries the class `.on-meter`, which sets `--ink` and `--muted` to `--meter-fg` and `--focus` to `--receipt-paper` (the fixed cream). The bar is black with yellow digits in both themes. Without the scope the ink focus ring (#111) is invisible on the bar in light mode, and the yellow dark-mode ring sits on the yellow "See receipt" button. With it: the ring is 16.7:1 on #111 and 18.6:1 on #000; digits and the button label are 11.8:1 (light) and 13.1:1 (dark); the dark-mode yellow top border is 12.1:1 against the page. The meter's own text and fill read `--meter-fg` and `--meter-bg` directly. `tests/meter-contrast.test.ts` reads these values from `globals.css`, so a colour change there is checked.
- **On-receipt scope (T6.3).** The on-screen receipt carries the class `.on-receipt`, which sets `--ink`, `--muted` and `--stamp` to the fixed `--receipt-*` values and `--rule` to the light `#B9B3A5`, so the paper looks the same in both themes, like the export. Without it the dark-mode stamp (`#FF6B5E`) and muted text (`#A29E93`) are about 2.5:1 on cream. With it: ink 16.7:1, muted 6.3:1, stamp 5.1:1. `--focus` is deliberately not remapped: the receipt's focus ring is drawn outside the paper, on the page. The danfo bands inside it use `--danfo` and `--danfo-ink`, which do not change with the theme. `tests/receipt-css.test.ts` reads these from `globals.css`.

### 3.2 Tailwind v4 (CSS-first, no config file)

Verified: Tailwind's Next.js guide (v4.3) uses `@import "tailwindcss";` in `app/globals.css` and no config file; Next's font docs map font variables with `@theme inline`. **VERIFY** the colour/radius token syntax on Tailwind's "Theme variables" page (not read).

```css
@import "tailwindcss";

@theme inline {
  --font-display: var(--font-bungee);
  --font-mono:    var(--font-space-mono);
  --font-sans:    var(--font-space-mono);

  --color-paper:     var(--paper);
  --color-surface:   var(--surface);
  --color-ink:       var(--ink);
  --color-muted:     var(--muted);
  --color-border:    var(--border);
  --color-rule:      var(--rule);
  --color-danfo:     var(--danfo);
  --color-danfo-ink: var(--danfo-ink);
  --color-stamp:     var(--stamp);
  --color-danger:    var(--danger);
  --color-ok:        var(--ok);
  --color-meter-bg:  var(--meter-bg);
  --color-meter-fg:  var(--meter-fg);

  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
}
```

`next/font` variables must be named `--font-bungee` and `--font-space-mono` (not `--font-display`), so the mapping isn't circular.

`next.config`: `output: 'export'`, unoptimized images, and `experimental.optimizePackageImports: ['@phosphor-icons/react']` (README recommendation; check the bundle after).

---

## 4. Layout rules

| Breakpoint | Behaviour |
|---|---|
| **360px (base)** | Single column, 16px gutters, no horizontal scroll, sticky damage meter at the bottom |
| **768px** | Single column centred, max 560px |
| **1280px** | Two columns: calculator (max 480px) left; **sticky live receipt hanging from a printer slot** (max 380px) right; 48px gap, centred |

Top to bottom on mobile:
1. **Danfo band header:** full-width yellow band, wordmark "DETTY DEC 2026" in Bungee, currency control (3 Phosphor currency icons with text labels, §5.5), a black danfo stripe (`--stripe`, always `--danfo-ink`) underneath. The band is an `.on-danfo` scope (§3.1). Below 560px the control stacks under the wordmark at full column width; from 560px they share one row (wordmark left, control 240px right, wordmark centred on the segments), the same breakpoint as the group total row. The control's label row is one line with or without the "Prices stay in ₦" note, so switching currency never changes the band's height. **The stripe is visible in light only (decided after the T6.1 screenshots).** It is always `--danfo-ink`, which is 1.02:1 against dark paper, so in dark mode the yellow-to-near-black edge of the band does the job and no cream hairline is added (a cream line under yellow looked busy). The wordmark stays `--t-lg` (20px) at every width: the page column is 560px at all widths from 560px up, and a larger wordmark would not fit beside the 240px control.
2. **Route plates:** "Pick your route" label and three plates (see §5.3).
3. **Group row:** group-size stepper, then "Apply to all shared" and "Reset to preset" text buttons, then a status line (§5.9).
4. **Bucket list:** 5 line items, each with a 32px icon tile.
5. **Rates:** collapsed "Rates" row; opens inline. It sits between the bucket list and the receipt (until T6.3 it sat above the totals, which now live on the receipt).
6. **Printer slot and receipt section:** a black slot bar, then the live receipt hanging from it. **Built in T6.3:** it holds the per-person and group totals and the tier stamp, so the calculator above it has the lines and the rates only (§5.13).
7. **Actions:** Export receipt (primary), Copy link (secondary), status line. **Built in T8.2:** only Copy link and its own status line, in `ShareBar`, directly under the receipt and inside the sticky column (16px below it, at most 380px wide and centred like the receipt), so from 1280px it stays on screen with the receipt. **Built in T9.1:** `ExportButton` sits above Copy link in the same column (16px under the receipt, same width), with its own status slot and, only when needed, the inline image panel (§5.10). **Built in T9.2:** the status slot also holds the in-app tip, and a failure adds a Retry row under it (§5.9).
8. **CTA card** ("Next stop"): only when enabled and valid. **Built in T10.1** (§5.12): it follows `main`, outside the grid, so the sticky column's range ends with the grid and can never overlap it. The gap from the Copy link button is the status slot (32px) plus `main`'s 24px bottom padding, about 56px, close to the Export to Copy link gap. From 1280px it sits 24px under the grid (the same gap below the Copy link status slot as on mobile) and lines up with the right column's edge (380px wide, under the receipt column). Hidden, it leaves nothing in the page.
9. **Footer:** estimates note, "Built in Lagos by <name>" (config-driven, hidden if unset).

Rules:
- **Damage meter (T6.2)** (mobile and tablet) is the sticky bottom bar (§5.7). It is `sticky bottom-0` and the last child of the page, after the footer, so nothing above it moves and the footer stays readable at the end of the page. It pads itself by the iOS safe-area insets on the left, right and bottom (the section takes `env(safe-area-inset-*)`, with `max(8px, …)` at the bottom, and the inner 560px column takes the 16px gutters, so its text lines up with `main` and the footer at every width), which needs `viewportFit: "cover"` in `app/layout.tsx` (page-wide). `html` has `scroll-padding-bottom` (6rem plus the bottom inset) so a focused field never lands under the bar. It is hidden while the receipt's **totals** (id `receipt-totals`: PER PERSON and GROUP) are on screen above the bar's own strip (a 100px bottom clearance: the bar's 68px, 84px in the empty state, plus about 34px of home-indicator inset), with `visibility: hidden` and not `display: none`, so the bar keeps its height and the layout never shifts. It used to hide as soon as any of the receipt (id `receipt`) showed; the receipt is taller than a phone screen and its totals sit in the middle, so there was a stretch with neither the bar nor the totals in view (T6.3 review). The jump still targets the whole receipt. **iOS Safari fix (26 Nov 2026):** on a real iPhone the bar sometimes hid and did not come back. iOS Safari delivers `IntersectionObserver` callbacks late or not at all around momentum scrolling, toolbar collapse and expand, and back/forward restores, and the bar had no second signal to correct a stale "in view". The bar now also measures the totals by hand (`getBoundingClientRect` against the visible viewport minus the same 100px) on `scroll`, `resize`, `visualViewport` resize and scroll, `pageshow` and `visibilitychange`, one measurement per frame, and follows the newest answer; the observer stays as the main signal. The bar's `<section>` also has `transform-gpu` (its own compositing layer), because toggling `visibility` on a `position: sticky` element can leave it unpainted in WebKit. Android Chrome was not reproduced. **Built in T6.3:** the receipt carries `id="receipt"` and `tabIndex={-1}` (the jump moves focus to it, so focus is not lost when the bar hides), so "See receipt" is drawn from the first client render, and the bar's `<section>` has `min-[1280px]:hidden`: from 1280px the receipt is the sticky right column and always on screen, so the bar is not drawn there (its live region is a sibling and keeps announcing). The jump is a button that calls `scrollIntoView`, not a `#receipt` link, because the page hash is reserved for share links (DATA_MODEL §4).
- **Receipt column (T6.3).** The receipt is one element, so its id is unique at every width. It is at most 380px wide and centred at every width (below 1280px it is not stretched to the 560px column: a receipt is narrow). From 1280px `main` is a grid of 480px and 380px with a 48px gap (`max-w-[940px]`, which with the 16px gutters is exactly that), and the receipt's wrapper is `sticky top-6`. **Tall column (T6.3 review).** The receipt is about 890px tall, so on a screen shorter than about 940px a plain `sticky top-6` column cuts off its bottom (the balance line, AUTH and the URL band) until the page ends; at 1280×720 about a third of it was out of reach. `StickyColumn` (client) therefore sets `top` to `min(24px, screen height − column height − 24px)`: on a tall screen nothing changes, on a short one the column scrolls up until its bottom is 24px above the screen's bottom and stays there, so the totals, stamp, balance line and URL stay in view and the top bands (slot, danfo band, POS lines) scroll away. It re-measures on resize and when the receipt's height changes.
- No modal dialogs in the core flow. Rates and export result expand inline.
- Touch targets at least 44×44px. Inputs 48px tall, **16px minimum text** (prevents iOS focus zoom).
- **One hint per row (T4.4).** A number field never draws its own hint. The row that holds the fields draws one hint, in one reserved slot **below every control in the row**, so a hint appearing never moves a control the user is about to tap. The latest commit wins. A bucket's slot is two lines (32px, 16px line height) and holds the formula line when there is no hint, so the hint *replaces* the formula. The group row's slot is its status line, also two lines; an action's status replaces a hint. Every hint starts with its field's name in bold (§5.2), because it is not under the field. Any new row of fields (T5.2 rates) follows this, with the slot last.
- **Group total row (T5.1 review, changed in T6.3).** The group total moved onto the receipt: `GROUP (n)` (14px, muted) and the amount (16px, bold, right) share one row at every width, with `flex-wrap` as the safety net. At 320px the 264px text box holds the label (about 77px for `GROUP (4)`) and an amount of up to about 17 characters, so only extreme totals wrap. The T5.1 reason for the stacked row (the stamp moving when ₦ and $ amounts wrapped differently) no longer applies: the stamp is below the row and the row does not wrap for any realistic total.
- **Per-person total size (T4.4, changed in T6.3).** The total is on the receipt now, sized by `totalSizeToken` in `totalSize.ts`: `--t-2xl` (40px) for 10 characters or fewer, `--t-xl` (28px) for 11 to 15, `--t-lg` (20px) for 16 or more. The receipt's text box is 24px narrower than the old results column (12px of paper padding each side), so at 320px it is 264px. Space Mono is about 0.61em wide: 10 characters at 40px are about 244px (11 would be 269px), 15 at 28px about 256px (16 would be 273px), and the longest amounts (`$4,995,000,000.00` at a rate of 50 with the maximum prices, `₦249,750,000,000`) are about 207px at 20px. `whitespace-nowrap` plus `overflow-wrap: anywhere` are a safety net only: under `nowrap` an over-long amount overflows rather than splitting its digits.

---

## 5. Components

### 5.1 Button
| Variant | Look |
|---|---|
| Primary | `--danfo` fill, `--danfo-ink` text, 2px ink border, `--shadow-hard`, Bungee uppercase label with a Phosphor icon |
| Secondary | `--surface` fill, 2px ink border, ink text |
| Text | underlined, no border |

Pressed: translate 2px, shadow collapses (80ms). Disabled: 50% ink, no shadow, `aria-disabled`. Loading: label "Printing…", no spinner.

**Secondary, as built (T8.2, Copy link).** Full width of its column, 48px tall, 2px `--ink` border, `--surface` fill, Bungee 14px label with a 20px bold Phosphor icon, no shadow. Pressed: `--danfo` fill with `--danfo-ink` text, like the other controls (nothing to translate, because there is no shadow to collapse). Focus: the standard ring (§3.1).

**Primary, as built (T9.1, Export receipt).** Full width of its column (at most 380px), 48px tall, `--danfo` fill, `--danfo-ink` text, 2px `--ink` border, `--shadow-hard`, Bungee 16px label with a 20px bold `ReceiptIcon`. While the PNG is not ready (pre-render idle, waiting or rendering) the label reads "Printing…" and the button is `aria-disabled` (fill and border at 50%, no shadow; the label stays at full ink so "Printing…" stays readable), not `disabled`, so a tap still reaches the handler and is answered with "tap again". A failed pre-render does not dim it: the tap reports the failure. Pressed: the shadow drops to 1px and, unless the user asked for reduced motion, the button moves 2px (80ms). Focus: the standard ring (§3.1). The label changes with the pre-render, so it flips to "Printing…" after every edit until the new PNG is ready; the button's size never changes.

### 5.2 Number input
`inputMode="numeric"` (`"decimal"` for a range with decimals, the rates, T5.2), `type="text"`, 48px tall, 2px `--border`, `--surface` fill, Space Mono 16px right-aligned, currency prefix as a non-editable label in ink and bold (it was muted until the T5.1 review: next to $ and £ amounts a faint ₦ was easy to miss). Separators as you type; caret stable. Empty or invalid reverts on blur. States: default, focus, error (`--danger` border plus hint with icon, `aria-describedby`), clamped (hint, not error), disabled. **Deliberately plain.**

**Draft and commit (T4.1).** The text being typed is held in the field, never in app state. It is written to state only on blur or Enter, as a parsed, clamped integer, so a half-typed value never gets out. Enter commits and keeps focus. Digits are regrouped with commas as you type and the caret stays after the digit it was after; deleting a comma removes the neighbouring digit so the caret never sticks. A comma is a thousands separator, so "1,5" is 15, and "1.5" is invalid (nothing is rounded).

**Hint (T4.1, moved to the row in T4.4).** `WarningIcon` (16px, bold) plus 12px text, drawn by the row and not by the field (§4, "One hint per row"), inside a `role="status"` slot that is always in the page so the hint is announced when it appears. The text starts with the field's name in bold and a colon ("Price: Max is ₦50,000,000, so we adjusted it."), because the hint is below the whole row and a clamp has no red border to point at its field. Names: "Price", the line's quantity label ("Nights", "Days"), "Split", "Group size". The field points to the slot with `aria-describedby` only while its hint shows. The rule is one sentence: red means what you typed was thrown away, ink means it was adjusted and kept. So a revert (empty, invalid, and for the rates out of range or more than 2 decimals) uses `--danger` text and border; a clamp (a price, quantity or headcount above its maximum) uses `--ink` text and keeps the normal border. The hint clears when any field in the row is focused, when another field in the row reports a newer hint, or when the saved number it was about changes some other way (for example a preset switch). Fields take `hint`, `onHintChange` and `hintId` props; `useRowHint` (`numberHint.ts`) holds the one hint per row and `HintMessage` draws it.

**Accessible name.** The visible label (for example "Price per day") comes first, followed by the bucket heading, so two fields with the same label can still be told apart ("Price per day Daily Food & Drinks").

### 5.3 Route plates (presets)
Three plates in a row (stack on very narrow screens), each styled like a danfo destination board: 2px ink border, Bungee label, Phosphor icon (Bus / Confetti / CrownSimple), small caption. Implemented as native radio inputs with custom visuals. Selected plate: `--danfo` fill, `fill` icon weight, check mark, hard shadow, 3px border. Unselected: paper fill, `bold` icon.
Labels: "Outside on a Budget", "Soft Life Standard", "Full IJGB / Baller Mode". Group has `legend` "Pick your route".

**Built in T4.3.** A `fieldset` with a Bungee `legend`. Under 480px the plates stack, each a row (icon on the left, label and the preset's blurb on the right); from 480px they sit in a row of three, icon above the text. Selected and unselected plates have the same outer size: the selected 3px border is balanced by 1px less padding, so nothing shifts. Selected: `--danfo` fill, `fill` icon, hard shadow, 3px border, and a small ink square with a check mark at the top right, so it still reads in greyscale. Tapping a plate runs the same action as "Reset to preset" for that preset: all five buckets, the group size and every edit are replaced, and currency and rates are kept. There is no undo, so the status line says what happened. Tapping the plate that is already picked does nothing (a radio can't change to itself); "Reset to preset" is the way back to its values.

**Group row (T4.3).** The group size is the §5.6 stepper ("Group size", suffix "people"), range 1 to 100. Changing it only changes the group total; shared splits stay as they are until "Apply to all shared" sets every shared line's split to the group size (per-person lines are left alone). "Apply to all shared" and "Reset to preset" are text buttons (§5.1, 44px tall); only reset has an icon (`ArrowCounterClockwiseIcon`).

### 5.4 Line item (bucket)
```
[ICON]  SHORT-LET                    ₦262,500   (your share, Space Mono 700)
        Price per night              Nights
        ₦ [150,000]              ×   [ − 7 + ]
        Cost split
        [ Shared | Per person ]
        Split between                              (only when Shared)
        [ − 4 + ] people
        ₦1,050,000 total ÷ 4                       (muted mono; a hint takes this line's place)
```
Dashed-rule separated, not boxed. Icon in a 32px black-bordered tile. Label in Bungee 14px. Padding is 16px above and 8px below: the reserved last row (below) already adds space under a one-line formula.

**Price and quantity row (T4.2).** Side by side from 480px up, stacked below it. The quantity column is a fixed 144px (the stepper's own width), so it never changes size. (Until T4.4 it also had to hold the stepper's hint, which wrapped to four lines in it; hints are now drawn by the row, see §5.2.) At 360px the content column is about 284px, too narrow for a 10-digit price beside a stepper. Each control has its own small label above it (12px muted). The "×" is decoration (`aria-hidden`) and only shows when the two sit side by side.

**Headcount (T4.2).** A separate "Split between" stepper row under the mode control, shown only when the line is Shared, so the stepper is never inside a radio's label. It is hidden, not reset, when the mode is Per person: switching back restores the old split. Switching mode adds or removes one row, so the content below moves by that row's height; this only happens on the user's own tap.

**Formula and hint line (T4.2, T4.4).** The last row of the line, a reserved 32px slot (two 16px lines). Muted mono. Normally the formula: it never repeats the price or quantity, which are visible in the controls above. Shared: `{line total} total ÷ {headcount}`, in the display currency (`₦1,050,000 total ÷ 4`, `$700.00 total ÷ 4`; converted from the stored naira since T5.1). Per person: `Each person pays this`. Only the price field and its hints stay in naira, because that is what is stored and typed. When a field in the line has a hint, the hint takes the slot and the formula is hidden until the hint clears. The slot is reserved, so neither the controls above it nor the next line move. At 320px the longest hint ("Table nights: That number no make sense. We kept your old one.") wraps to three lines and grows the slot by one line; this is known and left, since it only moves content below it.

### 5.5 Segmented control (currency, mode)
Native radios, 44px, 2px ink border. The selected segment has a thick inner ink frame (3px inset, so 5px in all), bold text and its Phosphor icon in `fill`; it stays on a `--surface` fill. Group has a label.

**Built in T4.2.** A `radiogroup` with a visible 12px label and an accessible name that also includes the bucket heading ("Cost split Short-lets / Accommodation"). Each segment is a native radio, so the group is one tab stop and the arrow keys move the selection. Unselected: surface fill, 2px frame, icon in `bold`. Selected: surface fill, 5px frame (2px border plus 3px inner ring), bold text (Space Mono is monospace, so bold does not change the width), icon in `fill`, raised above its neighbour so the frame is not cut by the 2px overlap. Focus: the 3px ring on the focused segment. Mode segments: `UsersThreeIcon` "Shared", `UserIcon` "Per person". The component is generic, so the currency control (T5.1) reuses it. **Segment widths (T5.1 review):** columns are `minmax(max-content, 1fr)`, so each segment is at least as wide as its icon and label and the rest is shared equally; "Per person" used to wrap to two lines at 320px, where equal thirds of 244px gave it 122px of the 134px it needs, and now "Shared" gives it the width (99px + 134px fit in 244px). Labels are `whitespace-nowrap`. The three currency segments are equal, as before.

**Built in T5.1 (currency).** `CurrencyControl`: group label "Currency" (12px, as "Cost split"), three segments `CurrencyNgnIcon` "NGN", `CurrencyDollarIcon` "USD", `CurrencyGbpIcon` "GBP", in `CURRENCY_CODES` order. Three-letter codes, not names, so the segments fit a 288px column at 320px (names like "Dollar" are about 99px each against 96px). It dispatches `setCurrency` and changes display only: every amount (lines, totals, formula lines) is converted from the stored naira, price fields stay in naira, and the tier never changes. **Built in T6.1:** it sits in the header band (§4), inside the `.on-danfo` scope, so its borders, label, note and focus ring are `--danfo-ink` and its segments white in both themes. While the display currency is not naira, a muted note "Prices stay in ₦" shows on the label row, right-aligned (`SegmentedControl` takes an optional `note`, tied to the group with `aria-describedby`). It lives on the label row, which is one line high with or without it, so switching moves nothing. The damage meter's live region (§5.7, T6.2) announces the new totals once the edit has settled.

**Changed in T4.4.** The selected segment used to be a solid ink block. Five of them in the bucket list were the heaviest thing on the page and outweighed the totals (seen in the 360px screenshots), so the selection now uses a thick frame, bold text and the `fill` icon instead. It still does not rely on colour alone.

### 5.6 Stepper
`MinusIcon` / value / `PlusIcon`, each 44×44px, square with 2px border. Value is a real input. Deliberately plain.

**Built in T4.2.** Visible 12px label above. The value box is 44px tall and 56px wide, centred, Space Mono 16px, and commits like the number input (blur or Enter, same hint copy for empty, invalid and clamped text; for headcount the clamp hint reads "Min is 1, so we adjusted it."). A button press (minus or plus) and ArrowUp / ArrowDown in the box commit at once. At a bound the button is `aria-disabled` with 50% ink (as §5.1), not `disabled`, so keyboard focus stays on it. Buttons are named "Decrease" / "Increase" followed by the label and the bucket heading ("Decrease Nights Short-lets / Accommodation"). Ranges: quantity 0 to 999, headcount 1 to 100. An optional muted suffix ("people") follows the buttons and is hidden from screen readers.

**Built in T4.4.** The value box takes `hint`, `onHintChange` and `hintId` like the number input (§5.2) and draws nothing under itself. The focused box is raised above the two buttons (`focus-visible:z-10`): flex items paint in order, so the later plus button used to cover the right edge of the 3px focus ring.

### 5.7 Damage meter (sticky bar)
Black bar (`--meter-bg`), 2px yellow top border in dark mode, `--meter-fg` digits in Space Mono 700 (large), label "DAMAGE METER" small, "per person" caption, `ArrowDownIcon` button "See receipt". No count-up animation. A visually hidden live region announces changes (debounced).

**Built in T6.2.** `DamageMeter` (client) with its pure text in `meterText.ts` and its hooks in `meterHooks.ts`; it reads the state and runs `calculate` itself, so `ResultsPanel` is unchanged. Placement and hiding rules are in §4; colours in §3.1. `useTargetInView(id, rootMargin?, recheckClearancePx?)`: the meter passes both (a bottom root margin and the same clearance in pixels, from one constant, `BAR_CLEARANCE_PX`), which turns on the manual re-measure described in §4; the receipt pre-render passes only a root margin and stays observer only.
- **Bar.** A `region` named "DAMAGE METER". The top border is 2px and transparent in light mode and `--meter-fg` in dark mode. Content is centred in the 560px column with 16px gutters on that column (not on the bar), like `main` and the footer, so the text lines up with the page content at every width. A label line (Bungee 12px) holds "DAMAGE METER" and the caption, then the digits. The caption is "per person"; when per-person is 0 the §9 empty line replaces it, and on a narrow bar it wraps below the label, so the bar grows by one line in that state only (nothing above moves, because the bar is the last element).
- **Digits.** 28px (`--t-xl`) up to 13 characters, 20px (`--t-lg`) from 14 (`meterSizeToken`). At 320px the digits have 232px (288 minus the 44px button and the 12px gap): 13 characters at 28px are about 223px, 14 would be about 240px, and the longest amount (17 characters, `$4,995,000,000.00`) is about 208px at 20px. They show the current value on every render, with no animation.
- **"See receipt".** 44px tall, yellow fill with `--meter-bg` icon and text, no hard shadow (it would vanish on black), cream (`--receipt-paper`) while pressed. Icon only (44×44) below 480px and icon plus text from 480px; the accessible name is "See receipt" at every width. It is drawn only while the receipt exists. Smooth scroll unless `prefers-reduced-motion: reduce`.
- **Live region.** A visually hidden `role="status"` sibling of the bar (outside it, so hiding the bar cannot silence it). Empty until the first announcement. After the totals have stayed the same for 600ms it says "Per person ₦1,347,500. Group total ₦5,390,000 for 4 people." (§9), once per settled edit; nothing on first load; edit and revert inside the window says nothing. The tier is left out to keep it short.

### 5.8 Tier stamp
Red (`--stamp`) double-border stamp, Bungee uppercase, rotated −4° (static), badge name inside. On-screen: crisp vector. On the canvas: speckled ink texture (see §7). Tagline beneath in mono.

**Built in T6.3.** `TierStamp` lives in the receipt (the calculator no longer draws one) and is a client component: it remembers the last badge and, when the badge changes, remounts the stamp with `data-thump` and the class `.stamp-thump` (scale 1.15 to 1 with an opacity lift, 180ms, `--ease`). Nothing runs on first paint or for an edit that stays in the same tier, and the badge is the key, so the receipt contract needs no tier id. The animation is defined only inside `@media (prefers-reduced-motion: no-preference)` and uses the individual `scale` property so it composes with the stamp's `rotate`; under reduce there is no animation rule at all and the stamp keeps its static −4°. `tests/receipt-css.test.ts` checks both facts from `globals.css`. The block reserves two lines, so a tier change never moves the page.

### 5.9 Status line
One `role="status"` line under the actions, with an icon: `CheckIcon` for success, `WarningIcon` for errors. No floating toasts.

**Group row status (T4.3, T4.4).** The same pattern under the group row's buttons: always in the page, two lines high (`min-h-8`, 16px lines) even when empty so the list below never shifts, 12px text with `CheckIcon`. It says what a plate tap, "Apply to all shared" or "Reset to preset" just did, and says so when "Apply to all shared" had nothing to change (copy in §9). It clears after 6 seconds. Since T4.4 it also holds the group size hint ("Group size: Min is 1, so we adjusted it."), so the hint never pushes the two buttons down while the user is reaching for one. The latest message wins: an action's status replaces the hint (the status names the number that was kept), and a hint replaces the status. The row's bottom padding is 4px, because this slot supplies the space.

**Share status (T8.2).** The Copy link status sits 4px under the button, always in the page and two lines high (`min-h-8`) even when empty, 12px text, so a message appearing never moves what is below it. Copied: `CheckIcon`, ink, cleared after 2 seconds (a second tap restarts the 2 seconds). Blocked: `WarningIcon`, `--danger`, and it stays until a later tap succeeds, because the link field under it (§5.16) is what the person is using. Copy: §9.

**Export status (T9.1).** The same slot, 8px under the Export button (the 3px hard shadow sits in the first 3 of those), always in the page and two lines high, 12px text. "Printing…" while a tap waits for the PNG (a browser that can't share files finishes on that tap; a second tap meanwhile is ignored); "Printing… tap again in a moment." when a tap came before the PNG was ready in a browser that can share files, or the wait ran out; it turns into "Receipt ready. Go and post am." (`CheckIcon`) when the PNG arrives, and only then, so nobody who did not tap is told anything on every edit. Every outcome has its own icon (T9.2): `PrinterIcon` for both "Printing…" lines, `CheckIcon` for "ready" and "shared", `DownloadSimpleIcon` for saved, `ImageIcon` for the inline image, `WarningIcon` in `--danger` for a failure. A cancelled share is silent and clears the line. Every message except the two "Printing…" ones is about one set of numbers, so it clears as soon as any number changes. Copy: §9. **Retry and the in-app tip (T9.2).** A failure names its reason (the font, or anything else, §9) and shows a Retry button under the status slot, outside the `role="status"` region: a text button (§5.1), 44px tall, `ArrowCounterClockwiseIcon` 20px bold, 14px bold ink, underlined, 4px under the status text. It appears only on a failure, so the slot grows by 44px once, after a tap, and not on load. Retry runs `prerender.retry()` and then the same tap as the Export button, so where the browser cannot share files it finishes the export on that press; where it can, it ends in "Printing… tap again in a moment." and then "Receipt ready." (a share needs a fresh tap). While a retry runs the Retry button stays, dimmed (`aria-disabled`, `--muted`), so nothing under it jumps up and down, and focus moves to the Export button. It leaves when the receipt is ready or saved. The in-app tip (§9, `DoorOpenIcon` 16px, 12px `--muted`, 4px under the status line, inside the `role="status"` region so it is announced with it) is added only after a saved download, the inline image or a failure, in a browser whose user agent looks like an in-app browser (`isInAppBrowser`). It is not shown after a successful share, and nothing is shown before a tap.

### 5.10 Inline panel (rates, export result)
Expands in place with a dashed top rule. Rates: two inputs ("₦ per $1", "₦ per £1"), "as of <date>" or a "Custom rates" tag, "Reset rates" with `ArrowCounterClockwiseIcon`.

**Built for rates (T5.2).** A section under the bucket list with a dashed top rule. Its toggle is a full-width row, 44px high, inside an `h3`: "Rates" in Bungee on the left, and on the right the tag and `CaretDownIcon` (upside down while open), with `aria-expanded` and `aria-controls`. The tag is always visible, closed or open: plain muted "as of 23 Nov 2026" for the config defaults, or a framed bold "Custom rates" (2px ink border, shape and weight, not colour alone) as soon as either rate differs from the default; it is derived, so editing a rate back to its default brings the date back. The panel opens instantly, with no height animation (so nothing to turn off for reduced motion), and stays in the page while closed (`hidden`). Inside: the two fields side by side (`grid-cols-2`, 16px gap, which fits the 136px halves at 320px: the longest text, `100,000.00`, is about 126px with its padding and border), then "Reset rates" as a text button, then one reserved two-line status slot (`role="status"`, 32px) that holds the field's hint or the reset status, the latest one winning, like a bucket line. Rates take up to 2 decimals (`inputMode="decimal"`). A number outside 50 to 100,000 (0 included) or with more than 2 decimals does not clamp: the old rate stays and an error hint says so. Closing the panel clears the hint and status.

**Built for the export image (T9.1).** Shown only when sharing and the download both fail (`inline` outcome). It sits 8px under the export status line, with a dashed `--rule` top rule and 12px of padding, and holds the PNG as an `<img>` 240px wide (centred, at most the column width) in a reserved 9:16 box with a 2px `--ink` border, so decoding never shifts the page. The caption is the status line above it: "Press and hold the picture to save." where the primary pointer is a finger, "Right-click the picture to save it." for a mouse or trackpad (T9.2; the same `(pointer: coarse)` rule as the share sheet). The picture comes from the blob that is ready when the result lands and gets `alt` text restating the tier and the key numbers ("Detty December 2026 receipt, SOFT LIFE: ₦1,347,500 per person, ₦5,390,000 for 4 people.", singular "1 person"; final in T9.2). It disappears, and its object URL is freed, when any number changes or the page unmounts. Saving the picture saves the full 1080×1920 file, not the 240px preview.

### 5.11 Notice banner
Full-width, dashed border, `--muted` text, dismiss button. For the bad-link notice. `role="status"`.

**Built in T8.2.** `LinkNotice` is the first thing in the calculator column, so it is as wide as that column (480px from 1280px, otherwise the page column), above the route plates, with 24px under it. The `role="status"` wrapper is always in the page and empty until a link is rejected, so the text is announced when it appears; empty, it has no height and no margin. The banner arrives in the same render as the fresh numbers (one `hydrated` action), so the page shifts once, at the swap, and never after. Frame: 2px dashed `--border` (not `--rule`, which is for decorative dividers; this frame holds a button), 12px padding all round and an 8px gap between the text and the button row, 14px `--muted` text (6.3:1) with `text-balance` so a wrapped line never ends on a lone word. The padding and gap keep the Dismiss focus ring (3px, 2px offset) clear of the frame and the text (T8.2 screenshot review). Dismiss is a text button in the §5.1 text style with `XIcon` (20px, bold, decorative), 44px tall, right-aligned; on a narrow screen it wraps under the text. Dismissing hides the banner for this visit and leaves the URL alone. Copy: §9.

### 5.12 CTA card ("Next stop")
A yellow route-board plate: small label "NEXT STOP" (Bungee), config-driven title and button text, optional disclosure line. Rendered only when the flag is on and the URL is a valid `https:` link.

**Built in T10.1.** `CtaCard` is a server component (no state, so it is in the static HTML and nothing shifts on load) and renders `null`, with no wrapper, unless `CTA_ENABLED` is exactly `true`, the URL parses as `https:` (checked again inside the component) and the title and button text are not blank (a blank one would be an unnamed link). It is a `section` named by its title. The plate is an `.on-danfo` scope (§3.1), so ink, the focus ring and contrast are the same in both themes: `--danfo` fill, 2px `--ink` border, 16px padding, at most 380px wide and centred, no shadow. In dark mode the border is `--danfo` (a `#111` border is invisible on the dark page), so the plate's outer edge lines up with the buttons above it instead of sitting 2px inside them. Top to bottom: "NEXT STOP" (Bungee 12px), the title as an `h2` (Bungee 20px, `text-balance`, 4px below), then the link-button 12px below. The button is an `<a>` styled as the secondary button (§5.1): full width, 48px tall, `--surface` fill (white in the scope), 2px ink border, Bungee 14px label, a 20px bold `ArrowSquareOutIcon`, and an `aria-label` that adds "(opens in a new tab)" to the button text. Pressed: ink fill with `--danfo` text (the secondary's `--danfo` pressed fill would vanish on the plate). Focus: the standard ring, which is `--danfo-ink` inside the scope. The link has `target="_blank"` and `rel="noopener noreferrer"`. A non-empty `CTA_DISCLOSURE` shows its text under the button (8px, 12px, `--muted`, which is ink in the scope, with `text-balance` so it never ends on a lone word, as in §5.11) and adds `sponsored` to `rel`; the link is `aria-describedby` that line. Empty means neither, for your own link. Both rules live in the card, so a missing disclosure on an affiliate link would also drop `sponsored`: set `CTA_DISCLOSURE` whenever the link is paid. **Placement (changed after the T10.1 screenshot review):** the card is rendered between `main` and the footer, not inside the grid. Chrome bounds a sticky grid item by the whole grid container and not by its row, so with the card in a second grid row the sticky receipt column slid down over it at 1280px. The card's own outer div (the 560px page column, 940px from 1280px, with the 380px plate pushed to the right edge, under the receipt column) goes with it when it is hidden, so no gap is left. **Added in T10.3:** the link is `CtaLink`, a small client component that sends `cta_click` on a click (a middle-click is not counted); the card itself stays a server component, and the link still works without JavaScript.

### 5.13 Printer slot and receipt (on screen)
A black bar (4px radius, 10px high) with the HTML receipt hanging below it (cream paper, 1px shadow only). On desktop the receipt column is sticky.

**Built in T6.3.** `Receipt` (client) reads the state, calls `buildReceiptView` (`lib/receipt/view.ts`, T7.1) and draws only what the view says, so it does no maths and cannot disagree with the PNG. It is a `section` named "Receipt" (visually hidden `h2`) with `id="receipt"` and `tabIndex={-1}`, in the `.on-receipt` scope (§3.1). Top to bottom, as the §7 bands: the slot (10px high, 4px radius, `--receipt-ink`, with a 1px `--rule` border so it shows on the dark page); the paper, inset 8px each side, edged by a 1px `--rule` ring (no blur) because in light mode the paper and the page are the same cream; danfo band with "DETTY DECEMBER 2026" (Bungee 16px) and the black stripe; the four POS header lines (12px); the five lines (label 14px and your share 16px bold on one row while the label has about 10rem, otherwise the share drops under the label, right-aligned; the formula 12px muted below; dashed rules); a double rule; PER PERSON (Bungee 14px) and the amount (§4 sizes); `GROUP (n)`; `STATUS: APPROVED`; the stamp; the balance line (14px bold), `AUTH: <code>`, the customer-copy line and the rates note (12px muted); the danfo band with the site URL (12px bold mono, no stripe, as in §7). The 12px floor replaces the canvas's 30px floor on screen. No icons (§7). The totals block is `id="receipt-totals"`, which the meter watches (§4). The customer-copy line and the stamp tagline use `text-balance`, so a wrapped line never leaves one word alone. It is not a live region: the damage meter announces the totals. Fixed copy (POS lines, status, customer-copy line) is `RECEIPT_COPY` in `lib/receipt/view.ts`, shared with the canvas.

**Lines.** The formula is always in naira (`₦150,000 × 7 ÷ 4`; `₦100,000 × 3` when each person pays), because prices are stored and typed in naira (§5.4); only your share and the totals follow the display currency, and the rates note says which rates were used. A shared line with a split of 1 still reads `÷ 1`, like the calculator's formula line. **Empty state:** all-zero lines show ₦0, the first tier and `STATUS: APPROVED` (the meter carries the "Meter never start" line). **AUTH:** 8 upper-case hex characters from a 32-bit FNV-1a hash of `tier:perPersonMinor:currency`; decoration only (§7.2).

### 5.14 Skeleton
One: a reserved 9:16 paper block with dashed lines where the generated PNG appears, so nothing shifts. The page itself paints real defaults, so it needs no skeleton.

### 5.15 Footer
12px muted: "Estimates only, not quotes. Tap any number to edit." Then "Built in Lagos by <name>" (link, optional).

**Built in T6.1.** The credit is a second line, 4px under the note. It shows only when `authorCredit(AUTHOR_NAME, AUTHOR_URL)` is not null (non-blank name, `https:` URL); otherwise the footer is the note alone. "Built in Lagos by" is muted; the name is the link, in ink and underlined (not colour alone), with a 44px tall tap area and the standard focus ring. The footer takes an optional `credit` prop so tests do not mock config.

### 5.16 Read-only link field
Shown only when the clipboard refuses Copy link (the permission-denied row in §6). It sits 8px under the share status line (§5.9). A visually hidden `<label>` "Share link" and a `readOnly` `<input type="text">`: 48px tall, 2px `--border`, `--surface` fill, Space Mono 16px (the iOS no-zoom floor), left-aligned, standard focus ring, described by the share status line. It is focused and selected when it appears and selected again on every focus or tap, so one long-press copies the whole link. Its value is rebuilt from the current numbers on every render, so an edit after the refusal never leaves an old link in it. A long link scrolls inside the box; it never wraps or widens the column. An input and not a textarea: the link is one unbroken token and a textarea would grow tall.

---

## 6. Screens and states (inventory)

| State | S1 Calculator | S2 Rates | S3 Receipt | S4 Export result | S5 CTA | S6 Link notice | S7 404 |
|---|---|---|---|---|---|---|---|
| Loading | ✔ defaults at once; swap after hydration | – | ✔ reserved height | ✔ "Printing…" | – | – | – |
| Empty | ✔ all zero → ₦0, tier 1, nudge | – | ✔ zero lines | – | – | – | – |
| Error | ✔ bad input reverts with hint | ✔ out-of-range rate | ✔ draw failed → retry | ✔ export failed → retry plus fallback | – | ✔ (is the error) | – |
| Success | ✔ live totals | ✔ saved, "Custom rates" | ✔ stamp reveal | ✔ shared / saved / copied | ✔ opens link | – | – |
| Partial | ✔ some zero, mixed modes | ✔ one rate custom | ✔ "Custom rates" note | – | – | – | – |
| Offline | ✔ fully works | ✔ | ✔ | ✔ local | ✔ link fails in browser | – | – |
| Permission-denied | ✔ storage blocked: no resume | – | – | ✔ clipboard denied → select-and-copy; share cancelled → silent; download blocked → inline image | – | – | – |

Product-specific: value clamped (hint, snap); custom rates active (tag replaces date); tier changed (stamp "thump"); CTA hidden (no gap); in-app browser detected (`DoorOpenIcon` tip only, after a saved download, the inline image or a failure; the export chain does not change, T2.2 decision 4); Web Share unsupported (download, then inline image); export in progress ("Printing…", disabled); link copied (status line about 2s).

**S7 (404):** "Wrong bus. This page no dey here." plus a primary button back to `/`.

---

## 7. The receipt (canvas export): POS slip and debit alert

One portrait format, **1080 × 1920**, drawn from `ReceiptView` (see DATA_MODEL.md §6). Always light paper (`--receipt-*`). The on-screen HTML receipt (§5.13) is styled the same way and reads the same `ReceiptView` and `RECEIPT_COPY` (`lib/receipt/view.ts`); the exported PNG is shown in S4 so users see exactly what they post.

| Band (top to bottom) | Content |
|---|---|
| Safe margin | About 140px top margin for story/reel overlays. **VERIFY** against current Instagram and TikTok safe zones |
| **Danfo band** | Yellow band (120px) with Bungee "DETTY DECEMBER 2026" (64px, shrinks to fit), black stripe (12px) below |
| **POS header** | Mono lines: `*** DEBIT ALERT ***`, `MERCHANT: DETTY DEC, LAGOS`, `TXN: DAMAGE CALCULATION`, `CARD: **** SAPA` |
| Dashed rule | |
| Line items ×5 | Label (mono 34px), formula (mono 30px, muted), amount right-aligned (mono 700, 40px) |
| Double rule | |
| Totals | `PER PERSON` and amount (mono 700, large, **auto-shrinks to fit width**), `GROUP (n)` total |
| Status | `STATUS: APPROVED` |
| **Ink stamp** | Tier badge, rotated −4° (as on screen), red, double border, **speckled texture** (§7.1, T7.3), tagline beneath |
| Balance line | `AVAIL BAL: <tier line>` (mono 700, 30px) |
| Footer lines | `AUTH: <code>`, `CUSTOMER COPY. KEEP YOUR RECEIPT. YOUR ACCOUNT WON'T.`, rates note |
| **Danfo band (bottom)** | Yellow band (100px) with the **site URL** (Space Mono 700, 34px): maximum contrast watermark |
| Safe margin | About 140px; the URL band sits above it |

Rules:
- Any essential text on the canvas is at least **30px**. Auto-fit steps down in 2px steps and stops at 30px; text that still does not fit is a render failure, never a clipped PNG.
- Colours come from `--receipt-*` tokens, resolved once (a canvas can't read CSS variables directly).
- All fonts loaded before drawing. All amounts pre-formatted in `ReceiptView`; the renderer does no maths.
- Use **only fictional, generic** merchant and card text. No real bank or brand names, formats or logos.

**Built in T7.2** (`lib/receipt/layout.ts` and `render.ts`). The layout is a flow, not fixed y positions: each band follows the one above, so a wrapped badge, tagline or customer-copy line pushes everything below it down, and the renderer refuses to draw if the last baseline would come within 24px of the bottom band. The vertical steps are sized for the worst case (two-line badge, two-line tagline, two-line customer copy); when a receipt is shorter, the spare height is spread out (up to 28px at each of four spots: below the lines, above the stamp, above the tagline, above the balance line, always keeping 32px free above the bottom band) so there is no dead band above the URL. Alignment follows the screen: the POS header, status, stamp, balance line and footer lines are centred; line items and the totals have the label on the left and the amount on the right. The five line amounts share one size, the smallest (from 40px down to 30px) at which every row fits beside its label, so the right-hand column is not ragged; if it still does not fit it drops under the label, right-aligned, like the on-screen receipt. The per-person amount starts at 92px and the group amount at 44px; the step from the "PER PERSON" label to the amount grows with the amount's size, so a large amount never crowds its label. Wrapped text (badge, tagline, customer-copy line) is balanced so a line never ends on one word. The stamp is one flat `stamp` operation (badge in Bungee 44px, double border, −4°).

**Built in T7.3** About 200 speckles (radius 1 to 4px) are erased from the stamp with destination-out on an offscreen layer the size of the stamp box plus a 4px margin; the layer is then drawn rotated onto the receipt, so the paper is never punched through. The positions come from a seeded generator (mulberry32) whose seed is the receipt's AUTH code, so the same receipt always gets the same texture. renderReceipt(view, { texture: false }) draws the flat stamp (the fallback if the texture is ever too slow). The PNG is pre-rendered in the background: the renderer loads when the receipt is within about 800px of the viewport, renders about 500 ms after the last edit, and the latest blob is kept; the blob is cleared the moment the view changes.

### 7.3 Link preview image and favicon (T10.2)

One static `public/og-image.png`, **1200 × 630**, under 300 KB (WhatsApp is commonly reported to skip larger images; not verified, so `tests/metadata.test.ts` enforces it). It is a *sample danfo debit alert*, drawn from the real default receipt (`buildReceiptView(createInitialState())`), so its numbers, badge and copy come from the app and cannot drift. The source was a throwaway `app/og-source` page, captured at device pixel ratio 1 and then deleted; to redraw, rebuild that page from this spec.

| Part | Content |
|---|---|
| Card | `--danfo` yellow, fixed in both themes. Flat, no gradient or blur (§0 principle 4) |
| Left | `DETTY / DEC / 2026` in Bungee 116px, then the tagline from §9 in Space Mono 700 28px, all `--danfo-ink` |
| Bottom bar | 84px `--danfo-ink` with the site host in `--danfo`, Space Mono 700 30px (the damage-meter pairing, §5.7) |
| Slip | Cream `--receipt-*` paper, 480px wide, tilted 3°, 3px ink border and one hard shadow (10px), running off the bottom edge. Danfo band + stripe, `*** DEBIT ALERT ***`, the five lines (label, 2px dotted leader on the text baseline, amount; labels and amounts `nowrap`), `PER PERSON` total, the speckled stamp (the same seeded `makeSpeckles` as §7.1, rotated −4°, but 45 speckles at half radius, because full-size speckles on a stamp this small punched out letters), the balance line |

Rules: keep everything that matters inside the middle 1200 × 600 and away from the outer ~60px, because X crops to 2:1 and thumbnails crop edges. Text is at least 17px on the 1200px card (decorative detail; the readable parts are the wordmark, the per-person total and the stamp). The Bungee wordmark carries no currency symbol (§1). The slip text uses the ₦ from the naira subset, so the page that is captured must have the fonts loaded.

**Favicon.** A black ₦ on a danfo-yellow square, **kept** after the 16px check (the fallback of a yellow block with a black stripe was not needed). A ₦ with its two bars drawn inside the N turned to mush at 16px; the shipped geometry has a bolder N (stems 12/64 wide) and bars that run edge to edge, and the 16px frame in `favicon.ico` is pixel-snapped so each bar is exactly one crisp pixel row. The ₦ is drawn as paths, not text, because an SVG favicon cannot load web fonts. Files: `app/icon.svg` (the source), `app/favicon.ico` (16, 32, 48px), `app/apple-icon.png` (180px, full-bleed; iOS rounds the corners). Next adds the `<link>` tags by file name.

**Browser chrome.** `theme-color` is `--danfo` (`THEME_COLOR` in `config/`, checked against `globals.css`), so a phone's toolbar continues the header band. The band is yellow in both themes, so one value covers light and dark. The page also declares `<link rel="canonical" href="/">` (resolved against `SITE_URL`), so share links and `?v=` test URLs all name one page.

### 7.1 Ink-stamp texture (canvas)
Draw the stamp text and border, then erase a few hundred tiny speckles with `destination-out` using a **seeded** random sequence derived from the total, so the same receipt always gets the same stamp. About 200 speckles, radius 1 to 4px. Optional: slight rotation jitter. Keep the text legible (stamp contrast above is 5.1:1).

### 7.2 AUTH code
A short pseudo-code (e.g. 8 characters) derived from the total and tier so it's stable for the same input. It is decoration, not a real transaction identifier.

---

## 8. Motion

| What | Animation | Duration / easing |
|---|---|---|
| Button press | translate 2px, shadow collapses | 80ms, `--ease` |
| Stamp reveal on tier change (T6.3: not on first paint, not within a tier) | scale 1.15 → 1, small opacity lift | 180ms, `--ease` |
| **Print feed** (optional) | receipt reveals top to bottom via clip-path when export is tapped | about 400ms, `--ease` |
| Status line | fade in | 180ms |
| Inline panels | height auto | 180ms (or instant) |
| Numbers (incl. the damage meter) | **none** (no count-up) | instant |
| Jump to receipt (meter button) | smooth scroll | browser default; instant (`auto`) under reduced motion |

`prefers-reduced-motion: reduce`: remove scale, translate, clip and height transitions (state changes are instant). The stamp keeps its static rotation. Optional Android haptic (`navigator.vibrate`) when the receipt is ready: iOS Safari doesn't support it, so treat it as a bonus and **VERIFY** before relying on it. Cut first if short on time.

---

## 9. Microcopy voice

Standard English with light Nigerian Pidgin, one Pidgin phrase per message at most. **All lines are drafts for you to refine.**

| Moment | Draft copy |
|---|---|
| Tagline | "Plan the damage before December plans you." |
| Route label | "Pick your route" |
| Route picked | "Route set to {preset}." |
| Apply to all shared | "Set {n} shared items to {size} people." (singular: "1 shared item", "1 person") |
| Apply, nothing to change | "Shared items already split {size} ways." / "No shared items to change." |
| Reset to preset | "Reset to {preset}." |
| Meter label | "DAMAGE METER" |
| Estimates note | "Estimates only, not quotes. Tap any number to edit." |
| Empty (all zero) | "Meter never start. Add a number, oya." |
| Meter caption | "per person" |
| Meter jump | "See receipt" |
| Meter announcement | "Per person {amount}. Group total {amount} for {n} people." (singular: "1 person"). Amounts are in the display currency, as on screen. No tier. |
| Empty input | "Nothing there, so we kept your old number." |
| Invalid number | "That number no make sense. We kept your old one." |
| Value clamped (max) | "Max is ₦50,000,000, so we adjusted it." |
| Value clamped (min) | "Min is {x}, so we adjusted it." |
| Rate out of range (kept) | "Use 50 to 100,000. We kept your old number." |
| Rate too many decimals (kept) | "Max 2 decimals. We kept your old number." |
| Rates reset | "Rates reset to the defaults." |
| Rates, nothing to reset | "Rates already at the defaults." |
| Hint prefix | "{Field}: {hint}", for example "Nights: Max is 999, so we adjusted it." Field is Price, the line's quantity label, Split or Group size, or on the rates panel "₦ per $1" or "₦ per £1". |
| Bad share link | "We couldn't read that link, so here's a fresh calculation." |
| Link copied | "Link copied. Drop it in the group chat." |
| Clipboard blocked | "Copy blocked. Press and hold the link below to copy." |
| Export in progress | "Printing…" |
| Export ready | "Receipt ready. Go and post am." |
| Export failed (font) | "The receipt font didn't load. Check your connection and try again." |
| Export failed (draw, blob, unknown, or the renderer did not load) | "Receipt no gree print. Try again." |
| Retry button | "Retry" (there is no picture to hold when drawing failed, so the failure lines do not mention one) |
| Export tapped too early | "Printing… tap again in a moment." |
| Export shared | "Receipt shared." |
| Export saved (download) | "Receipt saved. Check your downloads." |
| Export inline image (finger) | "Press and hold the picture to save." |
| Export inline image (mouse) | "Right-click the picture to save it." |
| In-app browser | "Tip: open this page in your browser for the best save and share." |
| Custom rates tag | "Custom rates" |
| Default rates tag | "as of {date}", for example "as of 23 Nov 2026" (day without a leading zero, three-letter month) |
| Receipt rates note | "Rates as of 23 Nov 2026" (same date format), or "Custom rates" once either rate differs |
| CTA label | "NEXT STOP" |
| CTA title (placeholder until C1) | "Still planning the trip?" |
| CTA button (placeholder until C1) | "Take me there" |
| CTA disclosure (empty unless the link is affiliate or paid) | for example "Sponsored link. We may earn a commission." |
| Footer credit | "Built in Lagos by <name>" |
| 404 | "Wrong bus. This page no dey here." |

Tier badges and taglines live in `data/`, with the new **balance lines** (draft, REQUIREMENTS §7). Playful, never mocking any group.

---

## 10. Accessibility rules

- Body text at least 4.5:1, UI borders and focus at least 3:1 (computed, §3.1). Re-check any colour you change.
- Visible focus on everything interactive; logical tab order; radios use native arrow keys.
- Selected states use shape plus icon plus shadow, never colour alone. The mode control uses a thick inner frame, bold text and a `fill` icon.
- The damage meter and totals are announced through a visually hidden `role="status"` (polite) region after edits settle (600ms with no change), not on every keystroke. Nothing is announced on first load; a burst of edits is announced once, with the last totals; an edit that is reverted inside the window announces nothing. The region sits outside the bar, so it keeps working while the bar is hidden. A route plate, Apply or Reset also sets the group status line (§5.9), so those actions give two polite messages: the status, then the totals.
- On-screen receipt is real text, a named region ("Receipt") that takes focus from the meter's jump with a visible ring outside the paper; the exported image has `alt` text restating the key numbers. The stamp is text, not an image.
- Reduced motion respected (§8). Errors carry text and an icon.

---

## 11. Sleekness checklist

1. **First paint.** Real numbers, yellow band and stamp appear at once; no layout shift when fonts swap. *Cheap if:* skeletons or a visible font flash.
2. **Typing numbers.** Separators as you type, caret stable, numeric keyboard, no iOS zoom. *Cheap if:* caret jumps or the page zooms.
3. **Route plates.** Tapping one fills all five buckets instantly and the meter updates. *Cheap if:* delay, or the selected plate is only a colour change.
4. **The stamp.** One crisp thump on tier change, with believable ink texture on the export. *Cheap if:* it animates on every keystroke, or the texture looks like a filter.
5. **Currency toggle.** Instant, columns stay aligned because digits are monospace.
6. **Export.** The tap reaches the share sheet with no wait, and the image matches the page. *Cheap if:* a blank image, wrong font in the PNG, or clipped digits on big totals.
7. **The image.** Readable at phone size, strong yellow URL band, funny POS lines. This is the thing that gets posted.
8. **Hints.** Type something bad into any field and tap the next control straight away. The tap lands, nothing under your finger moves, and the hint names its field. *Cheap if:* a button jumps 16 to 33px when the field loses focus, or "Max is 999" does not say which number.

---

## 12. Open design items

- Confirm the ₦ glyph renders in Bungee-free text (Space Mono) and fix the font if not (§1).
- Confirm remaining Phosphor icon names at install (§2).
- Final badge names, taglines and balance lines (your copy).
- Print-feed animation and Android haptic (optional, cut first).
- ~~Design the **OG image** as a sample danfo debit-alert receipt (S9).~~ Done in T10.2, see §7.3, and checked in WhatsApp and X.
- ~~Favicon: a black ₦ on a danfo-yellow square (confirm ₦ renders at 16px, or use a simple yellow block with a black stripe).~~ Done in T10.2: ₦ kept, pixel-snapped at 16px (§7.3).
