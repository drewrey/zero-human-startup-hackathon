# Zero Human Startup Hackathon — Secondhand Economy

An AI-native startup, run by a team of AI agents, building tools for secondhand resellers.

**Wedge:** an in-store sourcing copilot. A reseller snaps a photo (or speaks) while thrifting and gets
sold comps across marketplaces, expected profit after fees, and a BUY / PASS call in seconds.

**Vision:** the pricing data layer for the secondhand economy ("Kelley Blue Book for used goods").

## Repo layout

| Path | What |
|---|---|
| `docs/PLAN.md` | Hackathon plan: timeline, MVP scope, architecture, sponsor tool map |
| `docs/SPEC.md` | Product spec + business rules (the source of truth Prelint checks against) |
| `agents/` | The AI founding team: roster, handoffs, and per-agent role prompts |
| `web/` | The MVP: mobile-first Next.js app (see `web/README.md`) |
| `ops/band/` | BAND setup, Kylon ↔ BAND relay, and CLI for local agents |

## How changes land

Every change is a pull request reviewed by Prelint against `docs/SPEC.md` (plus CI). See `AGENTS.md`.

## Event

- Phase 1 build day: Oct 7, judging 5–6 PM
- Phase 2: Oct 7–11, final demos Oct 11
- Submit: https://hackathons.crewbasecollective.com
