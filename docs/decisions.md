# Decision Log

| Date | Decision | Options considered | Why | Owner |
|---|---|---|---|---|
| 2026-10-07 | Voice-first input, photo optional | Photo-first, voice-first, barcode | Photos are low-signal for pricing; hands are busy in-store. Photo later powers listing drafts | Founder |
| 2026-10-07 | Start with apparel, side-hustle resellers | Household, both, niche | Largest segment, rich comps, easy to say brand/model aloud | Founder |
| 2026-10-07 | Cross-platform recommendation with home-platform bias | Home only, eBay only | Cross-marketplace view is our edge; bias respects where the user already sells | Founder |
| 2026-10-07 | Host on InsForge via Instacloud (backend + deploy) | Instacloud vs. InsForge vs. other hosts | Organizers confirmed Instacloud is the hosted InsForge; free tier covers the hackathon | Founder |
| 2026-10-07 | Next.js mobile web app, mobile-first | Native app | Fastest to ship and demo on any phone | Founder |

## Open decisions

| Decision | Owner | Inputs needed | Founder approval | Status |
|---|---|---|---|---|
| Which model powers item understanding in the live flow (Claude via API key, or a model step inside a Rocket Ride pipeline using sponsor credits) | CEO | Engineer: latency per lookup on a phone (target < 2s for this step). Finance: cost per scan. PM: accuracy on 20 real spoken descriptions. | Yes, it spends money | Open. The keyword parser is the fallback meanwhile |
