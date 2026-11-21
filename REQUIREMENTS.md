# REQUIREMENTS.md: Detty December 2026 Survival & Group Splitter

> Status: Prompt 1 output (requirements and scope only). Architecture, data and design decisions come in later prompts.
> Launch target: **Tuesday, Nov 24, 2026**. Budget: **$0**. Time: **15–20 hours**.

---

## 1. Problem statement

**Who it's for**
- Nigerians in Lagos and diaspora visitors ("IJGBs") planning December 2026 nightlife, concerts and travel, usually as a group chat of 3–10 people.
- Secondary audience: recruiters and clients viewing this as a portfolio piece.

**The problem**
- Planning a Detty December trip means pricing short-lets, concerts, tables, transport/security and food, then agreeing in a WhatsApp group who pays what.
- Existing options are blog-post calculators (solo budgets, no splitting, no sharing) or bill-splitting apps (download, account, built for settling after the fact, not budgeting before).
- Groups end up with screenshots and voice notes, and people drop out when they see the real number late.

**What this does**
- A zero-signup, mobile-first web page that gets from "vibe" to "cost per person" in under a minute, in the user's currency.
- The result can be shared to a group chat as a link that reopens the same calculation.
- It can also be exported as a funny "damage receipt" image for X, TikTok and WhatsApp Status.

**What success looks like**
1. Shipped and live by Tue Nov 24, 2026, at $0.
2. A first-time visitor on a mid-range Android phone goes from landing to receipt in **under 60 seconds** without instructions.
3. Receipts and links circulate organically (measured, see §6).
4. If the CTA is enabled, some visitors click it (measured). The CTA may legitimately be hidden at launch (see D5).
5. Works as a portfolio piece: polished, fast, with a clear README story.

*Starting-guess targets, to be recalibrated after the first 48 hours (these are guesses, not benchmarks):*
- At least 15% of sessions that finish a calculation export a receipt or copy a link.
- If the CTA is enabled: at least 2–3% of those sessions click it.

---

## 2. Honest market check

| Question | Answer |
|---|---|
| Is the calculator itself differentiated? | **No.** Detty December budget calculators and blog templates already exist. Cost-per-person math is a commodity. |
| Is splitting differentiated? | **Partly.** Splitwise, Tricount and similar do group splitting well, but need installs or accounts and aren't Lagos-specific. |
| What is worth building? | The combination: **zero friction + Lagos-realistic presets + shareable link + a receipt people want to post.** The receipt and the group link are the product. The calculator is the delivery vehicle. |
| Biggest weakness | Virality is not guaranteed. The window is short (Dec 2026). The receipt's humor and design must carry it. |
| Biggest monetization weakness | There is no confirmed offer behind the CTA yet (the Selar guide is dropped). A CTA with nothing behind it earns nothing, so it stays hidden until a real link exists (see Risk 4). |
| Hosting/commercial note | I originally stated that Vercel's free Hobby tier is restricted to non-commercial use. I could not confirm that wording on Vercel's Hobby and fair-use pages, so treat it as unverified. Cloudflare Pages is the decision; its general terms show no ban on commercial use of free plans (its service-specific terms were not reviewed). Check the current terms before relying on either. |

---

## 3. Decisions and assumptions locked in

**Your answers**
| # | Decision |
|---|---|
| D1 | Presets use round-number estimates with a visible "estimates — tap any number to edit" label. You sanity-check baseline Lagos prices before launch. |
| D2 | Each bucket is either **shared** (own split headcount) or **per-person**. There is also one global **group size** (people on the trip), added in DATA_MODEL.md. Group total = per-person total × group size. An optional "apply group size to all shared items" shortcut sets every shared headcount to the group size. |
| D3 | Each bucket is **unit price × quantity** (e.g., nightly rate × nights). |
| D4 | One static site-wide OG image. No dynamic per-link OG in MVP. |
| D5 | **Not using Selar.** The promo/CTA card is controlled by **one config flag plus one URL** (`NEXT_PUBLIC_CTA_URL`). The URL can be any link (a Paystack link, an affiliate URL, your dev portfolio). If the URL is empty or the flag is off, the card is hidden and nothing else on the page changes. Default at launch: hidden unless a link is ready. Any guide or product is a separate track, not counted in the sprint hours. |
| D6 | Hosted on Cloudflare Pages, static export, free `.pages.dev` subdomain at launch. Watermark/site URL lives in a **single config constant** so a custom domain is a one-line swap. |
| D7 | Cloudflare Web Analytics, cookieless, no consent banner, plus lightweight tracking of receipt exports, link copies and CTA clicks. **See Risk/Open item O3: custom events need verification.** |
| D8 | Standard English with light Nigerian Pidgin flavor. 5 draft tiers and taglines are in §7. You refine the copy. |

**Assumptions (confirmed)**
- A1. Exchange rates are hardcoded defaults with an "as of" date and are user-editable. No live-rate API.
- A2. No accounts, no database, no backend. State lives in the shared link and the user's own browser.
- A3. Share links open an **editable copy**. There is no live sync between friends.
- A4. Receipt export is client-side only; mobile uses the native share sheet where available, with a download fallback.
- A5. Single-page app, no complex navigation.
- A6. No per-person names and no "who owes whom" settlement. The app shows cost per person only.
- A7. Audience is mostly mobile on mid-range Android and iOS, on variable networks.
- A8. UI is English-only.
- A9. Build over the weekend, test and deploy by Monday night, launch Tuesday.
- A10. Standalone scope, no dependencies on other projects.

**Additional assumptions I'm making (flag any you disagree with)**
- A11. The default scenario on load is a 7-night trip for a group of 4. Exact defaults are tuned during price research.
- A12. Tier badges are computed from the **per-person total converted to ₦**, so toggling currency never changes the tier.
- A13. Preset ("starting point") names are separate from result badges (§7). A user can pick "Outside on a Budget" and still end up with a high-tier badge after edits.
- A14. The receipt uses a single portrait format (≈1080×1920) in MVP.
- A15. No real artist, venue, club or brand names appear in the app or on receipts (trademark and ratio risk). Use generic labels.

---

## 4. User stories

### MUST have (the project is broken without these)

| ID | Story | Acceptance criteria |
|---|---|---|
| M1 | As a visitor, I pick one of 3 vibe presets so I get a realistic baseline in one tap. | Presets: *Outside on a Budget*, *Soft Life Standard*, *Full IJGB / Baller Mode*. Selecting one fills all 5 buckets. Results appear immediately with no form first. |
| M2 | As a visitor, I edit any number in the 5 buckets so it matches my real plans. | Buckets: Short-lets/Accommodation, Concerts & Raves, Club Tables, Transport/SUV/Security, Daily Food/Drinks. Each has unit price and quantity. Totals update live. |
| M3 | As a group member, I mark each bucket shared or per-person and set the split headcount so I see exact cost per person. | Shared buckets divide by their own headcount; per-person buckets don't. Headcount must be at least 1. A grand per-person total and group total are always visible. Math handles remainders without showing a misleading rounding error. |
| M4 | As a diaspora user, I switch between ₦, $ and £ and edit the exchange rates so everyone sees the same budget in their currency. | Toggle is instant. Rates show an "as of" date and are editable. Inputs are stored in ₦ internally, so switching currencies never compounds rounding. |
| M5 | As an organizer, I copy a link, paste it in WhatsApp, and friends open the exact same calculation without an account. | Link restores presets, edits, shared/per-person modes, headcounts, currency and rates. A corrupted or tampered link falls back to a safe default instead of crashing. |
| M6 | As a user, I export a "damage receipt" image to post. | One tap generates a high-contrast receipt: line items, per-person total, group size, currency, tier badge and tagline, "Detty December 2026" stamp, watermark URL at the bottom. On mobile it opens the share sheet; otherwise it downloads. Readable at phone size. |
| M7 | As the owner, I can show or hide a non-intrusive promo/CTA card below the receipt using one config flag and one URL (`NEXT_PUBLIC_CTA_URL`), so I can drop in any link later or keep it hidden at launch. | Card renders only when the flag is on **and** the URL is a valid `https://` URL; otherwise nothing renders and no empty space is left. The URL is read from config, never hardcoded in components. Link text and disclosure label are also config-driven. If the link is an affiliate or paid promotion, it is disclosed near the card. Card never blocks the calculator or the export. |
| M8 | As a mobile user, everything works one-handed at 360px width with no signup. | No login, no modals blocking first use, numeric keyboards on number fields, tap targets of at least 44px. |
| M9 | As a visitor, I understand the numbers are estimates. | A visible "estimates — tap any number to edit" label near the results. |
| M10 | As someone who receives the link, I see a good preview in chat apps. | One static OG image and title/description are set for the site. |

### SHOULD have

| ID | Story |
|---|---|
| S1 | "Apply group size to all shared items" shortcut (D2). |
| S2 | "Reset to preset" button, so edits can be undone without reloading. |
| S3 | Remember the user's last calculation in their own browser when they return. |
| S4 | Track receipt exports and link copies, plus CTA clicks when the CTA is shown (D7), subject to O3. |
| S5 | Thousand-separators and currency symbols in all number fields and on the receipt. |
| S6 | Copy-link confirmation feedback and a clear export loading/error state. |
| S7 | Exchange-rate "as of" label is also printed on the receipt in small text. |
| S8 | Keyboard and screen-reader support for the full core flow (see §6). |
| S9 | Tier badge appears live on screen before the user exports, so the reveal is part of the fun. |

### COULD have (later)

| ID | Story |
|---|---|
| C1 | Dynamic per-link OG images showing the user's per-person total. |
| C2 | Extra receipt formats (square, 4:5) and receipt visual themes. |
| C3 | Named participants and a "who owes whom" settle-up. |
| C4 | Live exchange-rate fetch with fallback to defaults. |
| C5 | Trip-day itinerary breakdown or a "compare two scenarios" view. |
| C6 | Optional full-Pidgin language toggle. |
| C7 | Extra presets (e.g., Calabar, Abuja, Ghana). |
| C8 | Email/WhatsApp capture for launch updates. This needs a backend or a third-party form. |
| C9 | Installable/offline mode. |

---

## 5. MVP definition

**The smallest version still worth showing to someone:** pick a vibe, tweak numbers, split with friends, switch currency, share a link, export a funny receipt. The promo/CTA card is built and flag-controlled, and may be hidden at launch.

### In
- 3 presets, 5 buckets, unit price × quantity
- Shared/per-person toggle with per-bucket headcount, cost per person and group total
- ₦/$/£ toggle with editable rates and "as of" date
- Shareable link that restores full state
- Receipt export (one portrait format) with tier badge, tagline and watermark URL
- 5 tiers with draft taglines (§7)
- Promo/CTA card controlled by one flag and `NEXT_PUBLIC_CTA_URL` (hidden when unset), with a disclosure label when relevant
- Static OG image, estimates label, mobile-first layout
- Basic analytics (subject to O3)
- Deployed on Cloudflare Pages

### Out (explicitly)
- Accounts, database, backend, live sync
- Dynamic OG images
- Participant names, settle-up, payments of any kind
- Live exchange rates
- Writing any paid guide or product, and any Selar integration
- Multiple CTA links or a CTA-management UI (one flag, one URL)
- Additional cities, presets, languages, receipt formats or themes
- Offline/PWA, email capture, user-generated free-text fields (also a privacy decision, see §6)
- Real venue, artist or brand names

---

## 6. Non-functional requirements

**Privacy**
- No personal data collected or stored. No names, emails, phone numbers or free-text input in MVP.
- Share links contain only numbers and choices, nothing identifying. Anyone with the link can read it, which is fine because it contains no personal data.
- Analytics are cookieless and collect no personal identifiers. Verify before claiming "no banner needed" (O3).

**Security**
- No secrets in the client; there is no backend.
- Treat every share link as untrusted input. Parse defensively, validate and clamp numbers, ignore unknown fields, never render link content as HTML.
- `NEXT_PUBLIC_CTA_URL` is public by design (it ships in the client bundle), so it must never contain a secret or tokenized URL. Only render it when it is a valid `https://` URL.
- Outbound links use `rel="noopener noreferrer"`, and affiliate or paid-promo links also use `sponsored`.
- Dependencies kept minimal and pinned.

**Performance**
- Targets on mid-range Android over 4G: LCP under about 2.5s, no layout shift while numbers update, input response feels instant.
- Heavy image-export code loads only when the user exports.
- Initial JS stays small. Set a budget in the architecture step (starting guess: under about 150 KB gzipped for first load; verify at build time).

**Cost**
- Strictly $0. No paid APIs, no paid hosting tier. Verify Cloudflare Pages and analytics free-tier limits against official docs before launch. A custom domain is optional spend, not required.

**Accessibility**
- Text contrast meets WCAG AA. Every input has a visible label. Full flow works by keyboard. Focus is visible. Reduced-motion respected.
- Dynamic totals are announced politely to screen readers.
- Receipt image has descriptive alt text, and the numbers are also available on screen as text.

**Compatibility**
- Safari iOS (recent two major versions), Chrome Android, and **in-app browsers** (WhatsApp, Instagram, TikTok, X), which is where many visitors will actually land. In-app browsers often restrict file downloads and sharing.

**Content and legal**
- Estimates are never presented as quotes or guarantees.
- Affiliate relationships are disclosed near the links.
- No real artist/venue/brand names or logos.

**Measurement (subject to O3)**
- Events: `receipt_export`, `link_copy`, and `cta_click` (only fires when the CTA is shown). Optional: `preset_selected`.

---

## 7. Draft receipt tiers (to refine)

Tier is computed from the **per-person total in ₦** (A12). Thresholds are placeholders and must be tuned after price research so the middle tiers hold most users and the extremes feel rare and shareable.

| Tier | Placeholder threshold (per person, ₦) | Badge | Draft tagline |
|---|---|---|---|
| 1 | under 300k | **Certified Sapa Survivor** | "Outside on a budget. Jollof and gist dey carry me." |
| 2 | 300k–750k | **Budget Baddie / Budget Boss** | "I go enter every party. I no go enter debt." |
| 3 | 750k–1.5M | **Soft Life Certified** | "Soft life no be luck, na planning." |
| 4 | 1.5M–3M | **Detty December Professional** | "Table don reserve. Account balance? Private." |
| 5 | above 3M | **IJGB Final Boss** | "Dollar dey talk. Lagos dey listen." |

**Draft balance lines** (the receipt's "AVAIL BAL" joke, one per tier, your copy to refine):

| Tier | Draft balance line |
|---|---|
| 1 | `AVAIL BAL: ₦0.00 (SAPA LOADING)` |
| 2 | `AVAIL BAL: STILL BREATHING` |
| 3 | `AVAIL BAL: STABLE. DON'T CHECK.` |
| 4 | `AVAIL BAL: CLASSIFIED` |
| 5 | `AVAIL BAL: IN DOLLARS, OGA.` |

The receipt is styled as a fictional POS slip and debit alert (generic text only, no real bank or brand names or formats), per DESIGN.md.

Rules: one badge per receipt, one tagline per tier in MVP (a rotating pool of 2–3 per tier is a COULD). Tiers must never change when only the display currency changes. Keep tone playful, not mocking any group.

---

## 8. Top 5 risks and unknowns (with early tests)

| # | Risk | Quick early test |
|---|---|---|
| 1 | **Preset prices aren't credible.** Fake-precise or wrong numbers get ratioed and kill trust. | Spend about 1 hour collecting roughly 10 public data points (short-let nightly rates, ticket ranges, table minimums, ride/security day rates). Round them. Show the 3 presets to 3 people in Lagos and ask "does this feel real?" before building polish. |
| 2 | **Receipt export fails on real phones**, especially iOS Safari and in-app browsers (fonts, sizing, blank images, share/download blocked). | **Day 1 spike, before any other polish:** render a mock receipt and export it on a real iPhone, a mid-range Android, and inside WhatsApp, Instagram and TikTok in-app browsers. Compare 1–2 candidate export libraries if the first fails. If it fails in in-app browsers, decide on a fallback (e.g., "open in browser" prompt or long-press-to-save). |
| 3 | **Share link breaks or gets too long.** WhatsApp may truncate or mangle long URLs. Old links may break after changes. | Encode a worst-case state (all buckets edited, all modes, all currencies) and check URL length. Paste it into WhatsApp and open it on 2 devices. Test a corrupted link and an empty link. |
| 4 | **There may be nothing real behind the CTA on launch day.** Selar is dropped, and no Paystack link, affiliate approval or other offer is confirmed yet. | The card is flag-controlled (`NEXT_PUBLIC_CTA_URL`), so this risk is contained: if no real link exists by Monday night, launch with the card hidden and turn it on later with a config change and redeploy. Don't ship a "coming soon" card that goes nowhere. Before enabling any link, confirm the destination works on mobile and that any affiliate/paid terms are met and disclosed. Verify those terms yourself. |
| 5 | **No distribution.** Nobody shares it, or the launch window is missed. | Seed a pre-launch version to 10–20 people in 3–4 real group chats on Monday. Watch whether anyone exports a receipt unprompted. If not, fix the receipt humor and design before posting publicly. Prepare 2–3 launch posts in advance. |

**Open items to resolve (not top-5, but real)**
- **O1.** Final tier thresholds and the tuned preset numbers (depends on Risk 1).
- **O2.** Custom domain: yes or no, and if yes, bought before launch? (Watermark URL should be short and memorable.)
- **O4.** `NEXT_PUBLIC_*` variables are inlined into the JavaScript at build time. With a static export, changing `NEXT_PUBLIC_CTA_URL` or the flag means **updating the variable in Cloudflare Pages and triggering a new deploy**, not a live toggle. That's fine for this project. Just plan for a quick rebuild when you're ready to turn the CTA on. If you ever want a live toggle without redeploying, that needs a runtime-fetched config file, which is out of MVP scope.
- **O3.** **Analytics claim needs verification.** Cloudflare Web Analytics, as far as I know, tracks page views and web-vitals but not custom events. My earlier suggestion of "plus custom events" may not work. Verify in Cloudflare's docs. If it doesn't, the options are a different free cookieless tool with event support (check its free-tier limits and cookie behavior), or measure only CTA clicks through the destination's own dashboard and UTM tags and give up on measuring exports and link copies. Decide this in the architecture step.

---

## 9. Scope vs. time budget

**Rough effort estimate (to be refined in BUILD_PLAN):**

| Area | Hours |
|---|---|
| Project setup, deploy pipeline to Cloudflare Pages | 1.5 |
| Calculation logic and state (buckets, shared/per-person, currency) | 3 |
| Main UI: presets, 5 bucket editors, results, mobile layout | 3.5 |
| Currency toggle and rate editing | 1 |
| Share link (encode/restore/validate) | 1.5 |
| Receipt design and image export, including device testing | 4 |
| Flag-controlled CTA card, OG image, analytics | 1.5 |
| Copy: tiers, taglines, labels | 1 |
| Cross-device QA and bug fixes | 2 |
| **Total** | **≈19 hours** |

**Verdict:** the full MVP is right at the top of your 15–20h budget, with almost no buffer. If the playbook's remaining planning steps (architecture, data model, design, build plan) come out of the same 15–20 hours, subtract roughly 2 hours, and you are over. Cut as follows.

**Too big, so cut or move out of the sprint**
1. **Writing any paid guide or product** (an earlier estimate for the Plug List was 6–10 hours). Separate track, already out of scope.
2. **Dynamic OG images**: already deferred.
3. **Participant names and settle-up**: already out. This is where scope tends to creep.
4. **Live exchange rates**: out. Hardcoded rates remove a failure mode.
5. **Extra receipt formats or themes**: one format only.
6. **A heavy custom design system.** Use a small set of tokens and components. Spend the polish budget on the receipt and the first screen.

**If you fall behind, cut in this order**
1. Custom analytics events (keep only basic page analytics).
2. Local "remember my last calculation".
3. "Apply group size to all" shortcut.
4. Reset-to-preset button.
5. Live tier badge preview (the badge still appears on the receipt).

**Never cut:** the receipt export, the share link, the shared/per-person split and the estimates label. Those are the product.

**Protect your time:** do the receipt-export spike on real phones first (Risk 2). It is the single most likely thing to blow up the schedule.

---

## 10. Next step

Proceed to **Prompt 2: Architecture and tech decisions**, pasting this file as input. Items for that step: analytics tool choice (O3), share-link state strategy, receipt export approach, and static-export constraints.
