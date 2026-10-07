# Phase 1 demo: verified results and tools per step

Founder's companion to Atlas's script (`phase1-demo-script.md`). Results below were checked against
the live site (`prod-main-web-328bf6-00zgqj4nmxx.compute.instacloud-edge.com`) at 4:05 PM PT on
Oct 7, after PR #20 (profit-based BUY/PASS) deployed.

## The two requests

| | Say (or type) | Live result |
|---|---|---|
| BUY | "Patagonia Synchilla, men's large, nine bucks" | **BUY**: "Buy it. Best on eBay, about $57 profit (estimate)." |
| PASS | "Old Navy fleece, men's large, twenty bucks" | **PASS**: "Pass. You'd lose about $8 on eBay." (26 comps, median $15.60) |

A known brand that resells well versus a cheap brand that loses money even at a thrift price.
Both items are cached, so answers are instant once the site is awake (verified 4:27 PM PT). Open the
site and run one item about 5 minutes before presenting.

## Tools at each step

| Step | What's shown | Tools |
|---|---|---|
| The problem | App capture screen | Flipwise app on **InstaCloud** |
| The phone | Voice in, BUY and PASS cards, comps ("Why?") | **InstaCloud** (app + Postgres price index), **Apify** (eBay sold listings), phone browser speech |
| The team | Agent Log, Decisions, handoffs, reviewed PRs | **Kylon** (agents, Agent Log, Decisions), **BAND** (Flipwise Ops room: Spec → Forge requests, Pipeline's receipt), **AdaL** (Forge's PRs #8, #12, #14, #20), **Prelint** (reviews on every PR, including findings that were fixed), **Rocket Ride** (Pipeline's outlier screen, PR #16) |
| The close | App or one evidence screen | — |

## What "eBay-first" means (say it once, plainly)

"Today every price comes from recent eBay sold listings. Poshmark, Depop, and Mercari are already in
the design: their fees are researched and the app compares platforms. But their sold data isn't
connected yet, so we don't claim them."
