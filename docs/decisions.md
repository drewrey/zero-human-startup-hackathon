# Decision Log

| Date | Decision | Options considered | Why | Owner |
|---|---|---|---|---|
| 2026-10-07 | Voice-first input, photo optional | Photo-first, voice-first, barcode | Photos are low-signal for pricing; hands are busy in-store. Photo later powers listing drafts | Founder |
| 2026-10-07 | Start with apparel, side-hustle resellers | Household, both, niche | Largest segment, rich comps, easy to say brand/model aloud | Founder |
| 2026-10-07 | Cross-platform recommendation with home-platform bias | Home only, eBay only | Cross-marketplace view is our edge; bias respects where the user already sells | Founder |
| 2026-10-07 | Host on InstaCloud (app container, Postgres, storage) | InstaCloud vs. InsForge Sites vs. other hosts | Sponsor credit; InstaCloud (from the InsForge team) runs our Next.js app as a container and gives us Postgres + storage for the price index | Founder |
| 2026-10-07 | Kylon, BAND, AdaL, Rocket Ride, Prelint are mandatory and each gets a real job (see PLAN §6) | Optional use with fallbacks | Hackathon requirement | Founder |
| 2026-10-07 | Next.js mobile web app, mobile-first | Native app | Fastest to ship and demo on any phone | Founder |
| 2026-10-07 | Rebrand deferred: keep "Flipwise" for the Phase 1 demo; voice-led positioning ("Spot it. Say it. Know whether to buy it.") recorded as a draft in `docs/brand/positioning-draft.md` | Rebrand before today's demo; adopt the draft now; defer | A rebrand can't land before the demo without displacing verdict and fee-safety work, and the copy is untested with resellers. Revisit after the demo, without expanding Oct 11 scope | Founder (on Spec's recommendation) |

## Open decisions

| Decision | Owner | Inputs needed | Founder approval | Status |
|---|---|---|---|---|
| Which model powers item understanding in the live flow: Claude through Kylon's Anthropic-compatible proxy (Kylon credits, supported in code via `ANTHROPIC_BASE_URL`), a direct Claude API key, or a model step inside a Rocket Ride pipeline | CEO | Engineer: latency per lookup on a phone (target < 2s for this step). Finance: cost per scan. PM: accuracy on 20 real spoken descriptions. | Yes, it spends money | Open. The keyword parser is the fallback meanwhile |
