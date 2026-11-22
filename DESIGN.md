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
| Body and **all numbers and currency symbols** | **Space Mono** (400 and 700) | `Space_Mono`, `weight: ['400','700']`, `subsets: ['latin','latin-ext']`, `variable: '--font-space-mono'` |

Verified: Bungee is a Google Font by David Jonathan Ross, designed around urban signage, a single Regular weight, SIL OFL. From the Next.js docs: multi-word names use underscores; non-variable fonts **need a weight**; fonts are downloaded at build time and self-hosted; the `variable` option feeds Tailwind.

**Two gotchas to check on day 1 (S1):**
1. **The ₦ sign (U+20A6).** On Google Fonts, that character sits in the `latin-ext` range, not `latin`, which is why both subsets are loaded. I believe this from how Google splits subsets, but I haven't confirmed it for these two fonts. **VERIFY** by rendering `₦1,234,567.89 $ £` in both fonts. Rule that limits the risk: **every number and currency symbol is set in Space Mono**, never Bungee, so only one font has to carry ₦.
2. **Space Mono's availability and glyphs** (₦, digits). If Space Mono fails the test, swap in another monospace (JetBrains Mono was the v1 choice and is a one-line change).

Two fonts total, no italics. `display: 'swap'`, automatic fallback adjustment left on. The canvas renderer reads the family from the CSS variable and waits for the fonts to load before drawing (**VERIFY** in the spike).

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
| Export receipt | `ReceiptIcon` | Page exists (found in search) |
| Copy link | `CopyIcon` | Confirmed |
| Success status | `CheckIcon` | Confirmed |
| See receipt (meter jump) | `ArrowDownIcon` | Confirmed |
| Reset to preset / rates | `ArrowCounterClockwiseIcon` | Confirmed |
| "Open in browser" hint | `DoorOpenIcon` | Confirmed |
| Steppers | `PlusIcon`, `MinusIcon` | Not confirmed from the sources I could read: confirm |
| Error / clamp hint | `WarningIcon` | Not confirmed: confirm |

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
1. **Danfo band header:** full-width yellow band, wordmark "DETTY DEC 2026" in Bungee, currency control (3 Phosphor currency icons with text labels), a black danfo stripe (`--stripe`) underneath.
2. **Route plates:** "Pick your route" label and three plates (see §5.3).
3. **Group row:** group-size stepper plus "Apply to all shared" text button.
4. **Bucket list:** 5 line items, each with a 32px icon tile.
5. **Rates:** collapsed "Rates" row; opens inline.
6. **Printer slot and receipt section:** a black slot bar, then the live receipt hanging from it.
7. **Actions:** Export receipt (primary), Copy link (secondary), status line.
8. **CTA card** ("Next stop"): only when enabled and valid.
9. **Footer:** estimates note, disclosure when relevant, "Built in Lagos by <name>" (config-driven, hidden if unset).

Rules:
- **Damage meter** (mobile and tablet) is the sticky bottom bar. Respects the iOS safe area. Hidden when the receipt section is on screen.
- No modal dialogs in the core flow. Rates and export result expand inline.
- Touch targets at least 44×44px. Inputs 48px tall, **16px minimum text** (prevents iOS focus zoom).

---

## 5. Components

### 5.1 Button
| Variant | Look |
|---|---|
| Primary | `--danfo` fill, `--danfo-ink` text, 2px ink border, `--shadow-hard`, Bungee uppercase label with a Phosphor icon |
| Secondary | `--surface` fill, 2px ink border, ink text |
| Text | underlined, no border |

Pressed: translate 2px, shadow collapses (80ms). Disabled: 50% ink, no shadow, `aria-disabled`. Loading: label "Printing…", no spinner.

### 5.2 Number input
`inputMode="numeric"`, `type="text"`, 48px tall, 2px `--border`, `--surface` fill, Space Mono 16px right-aligned, currency prefix as a non-editable label. Separators as you type; caret stable. Empty or invalid reverts on blur. States: default, focus, error (`--danger` border plus hint with icon, `aria-describedby`), clamped (hint, not error), disabled. **Deliberately plain.**

**Draft and commit (T4.1).** The text being typed is held in the field, never in app state. It is written to state only on blur or Enter, as a parsed, clamped integer, so a half-typed value never gets out. Enter commits and keeps focus. Digits are regrouped with commas as you type and the caret stays after the digit it was after; deleting a comma removes the neighbouring digit so the caret never sticks. A comma is a thousands separator, so "1,5" is 15, and "1.5" is invalid (nothing is rounded).

**Hint (T4.1).** One line under the field: `WarningIcon` (16px, bold) plus 12px text, in a `role="status"` region that is always in the page so the hint is announced when it appears. The field points to it with `aria-describedby` while it shows. An empty or invalid revert uses `--danger` text and border; a clamp uses `--ink` text and keeps the normal border. The hint clears when the field is focused again, or when the saved number changes some other way (for example a preset switch). The hint is in normal flow, so it pushes the content below it down by one line. Re-check this in T4.4 if a button ever sits directly under a field.

**Accessible name.** The visible label (for example "Price per day") comes first, followed by the bucket heading, so two fields with the same label can still be told apart ("Price per day Daily Food & Drinks").

### 5.3 Route plates (presets)
Three plates in a row (stack on very narrow screens), each styled like a danfo destination board: 2px ink border, Bungee label, Phosphor icon (Bus / Confetti / CrownSimple), small caption. Implemented as native radio inputs with custom visuals. Selected plate: `--danfo` fill, `fill` icon weight, check mark, hard shadow, 3px border. Unselected: paper fill, `bold` icon.
Labels: "Outside on a Budget", "Soft Life Standard", "Full IJGB / Baller Mode". Group has `legend` "Pick your route".

### 5.4 Line item (bucket)
```
[ICON]  SHORT-LET                    ₦262,500   (your share, Space Mono 700)
        ₦ [150,000] × [ − 7 + ] nights
        (•) Shared ÷ [ − 4 + ]    ( ) Per person
```
Dashed-rule separated, not boxed. Icon in a 32px black-bordered tile. Label in Bungee 14px. Formula in muted mono.

### 5.5 Segmented control (currency, mode)
Native radios, 44px, 2px ink border, selected segment filled with ink (text `--paper`) plus its Phosphor icon in `fill`. Group has a label.

### 5.6 Stepper
`MinusIcon` / value / `PlusIcon`, each 44×44px, square with 2px border. Value is a real input. Deliberately plain.

### 5.7 Damage meter (sticky bar)
Black bar (`--meter-bg`), 2px yellow top border in dark mode, `--meter-fg` digits in Space Mono 700 (large), label "DAMAGE METER" small, "per person" caption, `ArrowDownIcon` button "See receipt". No count-up animation. A visually hidden live region announces changes (debounced).

### 5.8 Tier stamp
Red (`--stamp`) double-border stamp, Bungee uppercase, rotated −4° (static), badge name inside. On-screen: crisp vector. On the canvas: speckled ink texture (see §7). Tagline beneath in mono.

### 5.9 Status line
One `role="status"` line under the actions, with an icon: `CheckIcon` for success, `WarningIcon` for errors. No floating toasts.

### 5.10 Inline panel (rates, export result)
Expands in place with a dashed top rule. Rates: two inputs ("₦ per $1", "₦ per £1"), "as of <date>" or a "Custom rates" tag, "Reset rates" with `ArrowCounterClockwiseIcon`.

### 5.11 Notice banner
Full-width, dashed border, `--muted` text, dismiss button. For the bad-link notice. `role="status"`.

### 5.12 CTA card ("Next stop")
A yellow route-board plate: small label "NEXT STOP" (Bungee), config-driven title and button text, optional disclosure line. Rendered only when the flag is on and the URL is a valid `https:` link.

### 5.13 Printer slot and receipt (on screen)
A black bar (4px radius, 10px high) with the HTML receipt hanging below it (cream paper, 1px shadow only). On desktop the receipt column is sticky.

### 5.14 Skeleton
One: a reserved 9:16 paper block with dashed lines where the generated PNG appears, so nothing shifts. The page itself paints real defaults, so it needs no skeleton.

### 5.15 Footer
12px muted: "Estimates only, not quotes. Tap any number to edit." Then "Built in Lagos by <name>" (link, optional).

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

Product-specific: value clamped (hint, snap); custom rates active (tag replaces date); tier changed (stamp "thump"); CTA hidden (no gap); in-app browser detected (`DoorOpenIcon` hint, inline image first); Web Share unsupported (download, then inline image); export in progress ("Printing…", disabled); link copied (status line about 2s).

**S7 (404):** "Wrong bus. This page no dey here." plus a primary button back to `/`.

---

## 7. The receipt (canvas export): POS slip and debit alert

One portrait format, **1080 × 1920**, drawn from `ReceiptView` (see DATA_MODEL.md §6). Always light paper (`--receipt-*`). The on-screen HTML receipt is styled the same way; the exported PNG is shown in S4 so users see exactly what they post.

| Band (top to bottom) | Content |
|---|---|
| Safe margin | About 140px top margin for story/reel overlays. **VERIFY** against current Instagram and TikTok safe zones |
| **Danfo band** | Yellow band with Bungee "DETTY DECEMBER 2026", black stripe below |
| **POS header** | Mono lines: `*** DEBIT ALERT ***`, `MERCHANT: DETTY DEC, LAGOS`, `TXN: DAMAGE CALCULATION`, `CARD: **** SAPA` |
| Dashed rule | |
| Line items ×5 | Label (mono 34px), formula (mono 30px, muted), amount right-aligned (mono 700, 40px) |
| Double rule | |
| Totals | `PER PERSON` and amount (mono 700, large, **auto-shrinks to fit width**), `GROUP (n)` total |
| Status | `STATUS: APPROVED` |
| **Ink stamp** | Tier badge, rotated about −5°, red, double border, **speckled texture** (§7.1), tagline beneath |
| Balance line | `AVAIL BAL: <tier line>` (mono 700, 30px) |
| Footer lines | `AUTH: <code>`, `CUSTOMER COPY. KEEP YOUR RECEIPT. YOUR ACCOUNT WON'T.`, rates note |
| **Danfo band (bottom)** | Yellow band with the **site URL** (Space Mono 700, 34px): maximum contrast watermark |
| Safe margin | About 140px; the URL band sits above it |

Rules:
- Any essential text on the canvas is at least **30px**.
- Colours come from `--receipt-*` tokens, resolved once (a canvas can't read CSS variables directly).
- All fonts loaded before drawing. All amounts pre-formatted in `ReceiptView`; the renderer does no maths.
- Use **only fictional, generic** merchant and card text. No real bank or brand names, formats or logos.

### 7.1 Ink-stamp texture (canvas)
Draw the stamp text and border, then erase a few hundred tiny speckles with `destination-out` using a **seeded** random sequence derived from the total, so the same receipt always gets the same stamp. About 200 speckles, radius 1 to 4px. Optional: slight rotation jitter. Keep the text legible (stamp contrast above is 5.1:1).

### 7.2 AUTH code
A short pseudo-code (e.g. 8 characters) derived from the total and tier so it's stable for the same input. It is decoration, not a real transaction identifier.

---

## 8. Motion

| What | Animation | Duration / easing |
|---|---|---|
| Button press | translate 2px, shadow collapses | 80ms, `--ease` |
| Stamp reveal on tier change | scale 1.15 → 1, small opacity lift | 180ms, `--ease` |
| **Print feed** (optional) | receipt reveals top to bottom via clip-path when export is tapped | about 400ms, `--ease` |
| Status line | fade in | 180ms |
| Inline panels | height auto | 180ms (or instant) |
| Numbers (incl. the damage meter) | **none** (no count-up) | instant |

`prefers-reduced-motion: reduce`: remove scale, translate, clip and height transitions (state changes are instant). The stamp keeps its static rotation. Optional Android haptic (`navigator.vibrate`) when the receipt is ready: iOS Safari doesn't support it, so treat it as a bonus and **VERIFY** before relying on it. Cut first if short on time.

---

## 9. Microcopy voice

Standard English with light Nigerian Pidgin, one Pidgin phrase per message at most. **All lines are drafts for you to refine.**

| Moment | Draft copy |
|---|---|
| Tagline | "Plan the damage before December plans you." |
| Route label | "Pick your route" |
| Meter label | "DAMAGE METER" |
| Estimates note | "Estimates only, not quotes. Tap any number to edit." |
| Empty (all zero) | "Meter never start. Add a number, oya." |
| Empty input | "Nothing there, so we kept your old number." |
| Invalid number | "That number no make sense. We kept your old one." |
| Value clamped (max) | "Max is ₦50,000,000, so we adjusted it." |
| Value clamped (min) | "Min is {x}, so we adjusted it." |
| Bad share link | "We couldn't read that link, so here's a fresh calculation." |
| Link copied | "Link copied. Drop it in the group chat." |
| Clipboard blocked | "Copy blocked. Press and hold the link below to copy." |
| Export in progress | "Printing…" |
| Export ready | "Receipt ready. Go and post am." |
| Export failed | "Receipt no gree print. Try again, or press and hold the picture to save." |
| In-app browser | "Tip: open this page in your browser for the best save and share." |
| Custom rates tag | "Custom rates" |
| CTA label | "NEXT STOP" |
| Footer credit | "Built in Lagos by <name>" |
| 404 | "Wrong bus. This page no dey here." |

Tier badges and taglines live in `data/`, with the new **balance lines** (draft, REQUIREMENTS §7). Playful, never mocking any group.

---

## 10. Accessibility rules

- Body text at least 4.5:1, UI borders and focus at least 3:1 (computed, §3.1). Re-check any colour you change.
- Visible focus on everything interactive; logical tab order; radios use native arrow keys.
- Selected states use shape plus icon plus shadow, never colour alone.
- The damage meter and totals are announced through a visually hidden `aria-live="polite"` region after edits settle (about 600ms), not on every keystroke.
- On-screen receipt is real text; the exported image has `alt` text restating the key numbers. The stamp is text, not an image.
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

---

## 12. Open design items

- Confirm the ₦ glyph renders in Bungee-free text (Space Mono) and fix the font if not (§1).
- Confirm remaining Phosphor icon names at install (§2).
- Final badge names, taglines and balance lines (your copy).
- Print-feed animation and Android haptic (optional, cut first).
- Design the **OG image** as a sample danfo debit-alert receipt (S9).
- Favicon: a black ₦ on a danfo-yellow square (confirm ₦ renders at 16px, or use a simple yellow block with a black stripe).
