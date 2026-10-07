# Sourcing copilot (web)

Mobile-first Next.js app. A reseller describes an item by voice (or types it), answers up to two
follow-up questions, and gets a spoken + on-screen BUY / MAYBE / PASS with profit per platform.

Spec: [`../docs/SPEC.md`](../docs/SPEC.md). Business rules are referenced as `BR-n` in code and tests.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 — open on your phone via your LAN IP, or use the phone-size view in browser devtools
npm test           # business-rule tests
```

Voice uses the browser's Web Speech API (works best in Chrome and Safari; mic access needs
`localhost` or HTTPS). There's always a text box as a fallback.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Enables Claude for understanding speech. Without it, a simple keyword parser is used. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5-5`. |
| `UNDERSTAND_MODE` | `auto` (default), `claude`, or `heuristic`. |
| `APIFY_TOKEN` | Enables live eBay sold comps. |
| `COMPS_SOURCE` | Set to `demo` to force demo data even with a token (saves credits while working on UI). |

## What's real vs. placeholder

| Part | Status |
|---|---|
| Pricing, verdict, platform recommendation (`src/lib/pricing`) | Implemented and tested against SPEC |
| Speech understanding (`src/lib/understand`) | Claude with structured output; keyword fallback |
| Sold comps (`src/lib/comps`) | **Live eBay** sold listings via Apify when `APIFY_TOKEN` is set (~$0.16 and ~10–20s per uncached lookup, cached 24h in memory). Otherwise labeled demo data. Poshmark/Depop/Mercari not yet |
| Fees (`src/lib/config.ts`) | **Unverified placeholders** until Market Research fills `docs/research/fees.md` |
| Voice | Browser speech; Voiskey to replace it |
| Haul + settings | Stored on the device (localStorage) |
| Scan storage (BR-16) | Not yet; waiting on backend choice |

## Deploy (InstaCloud)

The app ships as a container (`Dockerfile`, Next.js standalone output, port 8080).

- **GitHub deploy:** in the InstaCloud console, connect this repo with **root directory `web`**. Pushes to
  `main` redeploy.
- **From a terminal:** `cd web && npx insta deploy .` (after `npx insta login` and `npx insta project link <id>`).
- **Secrets:** set `APIFY_TOKEN` (and `ANTHROPIC_API_KEY` if used) as project secrets, never `NEXT_PUBLIC_*`.
- `npx insta build . --explain` checks locally whether it will build.

## Layout

```
src/app/page.tsx              entry
src/app/api/check/route.ts    conversation → follow-up or price check
src/components/               SourcerApp (voice screen), ResultCard, Panels (comps, haul, settings)
src/lib/pricing/              engine.ts (BR-1…BR-15), stats.ts, tests
src/lib/understand/           claude.ts, heuristic.ts, schema.ts
src/lib/comps/                demo.ts provider (live provider goes here)
src/lib/config.ts             fees, thresholds, bias (BR-3)
```
