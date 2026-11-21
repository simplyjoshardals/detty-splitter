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

`yarn start` is not used: the site is a static export, so serve `out/` with any static file server.

## Environment variables

Defined in `.env.example` and read only in `config/index.ts`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CTA_ENABLED` | CTA card is shown only when exactly `true` |
| `NEXT_PUBLIC_CTA_URL` | CTA link; must be a valid `https://` URL |

These are public values inlined at build time. Never put secrets in them. Changing them requires a rebuild and redeploy.

## Project structure

```
app/          Next.js routes and global styles
components/   Presentational UI
lib/          Pure logic: calc, money, share, receipt, export, storage, analytics
state/        Reducer, actions, context provider
data/         Presets, tiers, bucket definitions
config/       Site URL, env-driven flags
tests/        Unit and end-to-end tests
public/       Static assets
```

## Docs

[REQUIREMENTS](REQUIREMENTS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATA_MODEL](DATA_MODEL.md) · [DESIGN](DESIGN.md) · [UI_PLAN](UI_PLAN.md) · [BUILD_PLAN](BUILD_PLAN.md)

## Deployment

Cloudflare Pages (or Workers static assets): build command `yarn build`, output directory `out`.
