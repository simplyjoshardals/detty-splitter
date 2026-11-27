# Detty December 2026 Survival & Group Splitter

A zero-signup, mobile-first web page that takes a group from "vibe" to "cost per person" for a Lagos Detty December trip in under a minute. Pick a preset, tweak the numbers, switch currency (₦ / $ / £), then share the calculation as a link or export it as a "damage receipt" image.

> Status: in development. Launch target: Tue 24 Nov 2026.

## How it works

- **No backend, no database.** Everything runs in the browser; Cloudflare only serves static files.
- **Share links** keep the state in the URL hash (`#v1-…`), so it is never sent to a server and every link previews with the same static OG image.
- **Receipt export** draws directly on a Canvas 2D and shares the PNG with the Web Share API, falling back to a download, then to an inline image.

## Stack

Next.js (App Router, static export) · TypeScript (strict) · Tailwind CSS v4 · Yarn

## Getting started

```bash
yarn install
cp .env.example .env.local   # optional, see below
yarn dev                     # http://localhost:3000
```

| Command | What it does |
|---|---|
| `yarn dev` | Start the dev server |
| `yarn build` | Static export to `out/` |
| `yarn lint` | Run ESLint |
| `yarn test` | Unit and component tests (Vitest) |
| `yarn test:e2e` | One end-to-end flow plus axe checks (Playwright, Chromium); builds the site and serves `out/` itself |

`yarn start` is not used: the site is a static export, so serve `out/` with any static file server.

Before the first `yarn test:e2e`, run `yarn playwright install chromium` once.

## Environment variables

Defined in `.env.example` and read only in `config/index.ts`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CTA_ENABLED` | CTA card is shown only when exactly `true` |
| `NEXT_PUBLIC_CTA_URL` | CTA link; must be a valid `https://` URL |

These are public values inlined at build time. Never put secrets in them. Changing them requires a rebuild and redeploy.

### Analytics

Umami Cloud, off until you paste the website ID (a UUID, public by design) into `ANALYTICS_SITE_ID` in `config/index.ts`; it is a plain constant, not an env var. With it empty no script is added and nothing is sent. It sends only `receipt_export` (tier, currency, method), `link_copy` and `cta_click`, never amounts, headcounts, rates or the share link, and only from the host of `SITE_URL`, so local runs and previews do not count. The tracker script and its events go through this site's own origin (Cloudflare Pages Functions in `functions/`, relaying to Umami), so a DNS block or ad blocker on Umami's hostnames does not stop them. Visitors whose browser sends Do Not Track are not counted. The relay only exists on the deployed Pages site: `yarn dev` and `yarn serve out` have no `functions/`, so the script request 404s there, which is harmless (nothing is sent from other hosts). Check it on the deployed site in Umami's Realtime view.

## Project structure

```
app/          Next.js routes and global styles
components/   Presentational UI
lib/          Pure logic: calc, money, input, share, receipt, export, storage, analytics, umami-proxy
functions/    Cloudflare Pages Functions: the analytics relay (tracker script and events)
state/        Reducer, actions, context provider
data/         Presets, tiers, bucket definitions
config/       Site URL, env-driven flags
tests/        Unit and component tests (Vitest)
e2e/          End-to-end flow and axe checks (Playwright)
public/       Static assets
```

## Docs

[REQUIREMENTS](REQUIREMENTS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATA_MODEL](DATA_MODEL.md) · [DESIGN](DESIGN.md) · [UI_PLAN](UI_PLAN.md) · [BUILD_PLAN](BUILD_PLAN.md)

## Deployment

Cloudflare Pages: build command `yarn build`, output directory `out`. Use Pages (connected to the repo), not Workers static assets: the `functions/` folder is the analytics relay and only Pages deploys it. Requests to those two routes count toward the Workers Free limit of 100,000 a day; static files do not.
