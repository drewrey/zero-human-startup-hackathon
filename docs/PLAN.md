# Hackathon Plan

Status: draft v1 — Oct 7. Sourcer experience decided (see §3 and `docs/SPEC.md`). Open logistics questions at the bottom.

## 1. Goal

**Phase 1 (today, judging 5 PM):** Idea → Validation → Simple MVP → 3–5 connected agents → Demo.
**Phase 2 (Oct 7–11):** 5+ agents operating as an org → real users → traction → investor pitch with live agent Q&A.

Judged on: product, AI organization, execution, validation, GTM, traction, final pitch.

## 2. Company

| | |
|---|---|
| Working name | TBD — candidates: *Flipwise*, *CompCheck*, *ThriftSense*, *PassOrBuy* (Brand agent to propose + check domains) |
| Problem | Resellers make buy decisions in-store in seconds with no data; bad buys become dead inventory. Pricing knowledge is tribal and fragmented across eBay, Poshmark, Mercari, Depop. |
| ICP | Part-time / side-hustle clothing & household resellers sourcing at thrift stores, Goodwill bins, garage and estate sales. |
| Solution | Describe an item by voice (photo optional) → cross-marketplace sold comps → expected profit after fees → spoken BUY / PASS + best platform. |
| Why now | Multimodal models can identify items from a photo; resale keeps growing; marketplaces only show their own data. |
| Moat / vision | Every scan adds to a cross-marketplace pricing dataset → pricing API for consignment, estate-sale, insurance, and resale platforms. |

## 3. Sourcer experience (decided)

Full detail and business rules in `docs/SPEC.md`.

- **Persona:** side-hustle reseller, apparel first.
- **Input:** voice-first; photo optional (photos are low-signal for pricing but later power listing drafts).
- **Follow-ups:** at most 2 short spoken questions, only for attributes that change price.
- **Output:** spoken verdict through earbuds + result card on screen, from the same result object.
- **Verdict:** BUY / MAYBE / PASS + numbers. Net profit must be positive to BUY; min profit and max days
  to sell are per-user settings (defaults $10 / 30 days). No tag price → "Worth it under $X".
- **Platforms:** compare eBay, Poshmark, Depop, Mercari; recommend the sourcer's home platform unless
  another beats it by a clear margin. Later: personalized "you'd net more on X" suggestions.
- **After the verdict:** see the comps behind it; save to today's haul with trip totals.

## 3a. Phase 1 MVP scope (by 4 PM)

**In:** voice capture, attribute extraction + follow-ups, eBay sold comps, verdict card + spoken answer,
comps view, haul (stored on device), basic settings.
**Stretch:** more platforms, optional photo for identification.
**Out for Phase 1:** accounts, listing drafts from photo, crosslisting, household goods.

## 4. Architecture (proposed)

```
Phone (PWA, earbuds)
  └─ voice (Voiskey; browser speech API as fallback) + optional photo
       └─ API  ──►  Price-check pipeline (Rocket Ride; plain code first if faster)
                      0. Understand          LLM → attributes; ask ≤2 follow-ups if price-relevant gaps
                      1. Identify item       {brand, type, variant, size, gender, condition, tag price}
                      2. Fetch comps         Apify actor(s): eBay sold (+ Poshmark/Mercari/Depop later)
                      3. Normalize + filter  drop outliers / mismatches
                      4. Stats               median, IQR, comp count, sell-speed proxy
                      5. Economics           per-platform fees + shipping → net profit vs. tag price
                      6. Recommend + verdict home-platform bias → BUY / MAYBE / PASS → spoken text + card
       ◄── text-to-speech (Voiskey) + result card
                    Store scans + comps (InstaCloud Postgres/storage) → becomes the pricing dataset
                    Phase 2: price index checked first (BR-18); nightly batch jobs refresh and grow it,
                    so live scraping is only needed for the long tail
Deploy: InstaCloud (container from GitHub, root dir `web`) + its Postgres/storage
Built by: AdaL (Engineer agent), reviewed in Tenki, checked against docs/SPEC.md by Prelint
```

Sell-speed proxy: sold count vs. active listings for the same query over a window (sell-through rate).

## 5. AI founding team

Full roster and handoffs in `agents/README.md`. Phase 1 runs 5 of them; Phase 2 adds the rest.

| Phase 1 (today) | Phase 2 adds |
|---|---|
| CEO/Strategy, Market Research, Product Manager, Engineer, Pricing Data | Growth & Sales, Finance, Customer Success |

Phase 1 must show **real workflows**, not standalone chatbots. Minimum demonstrable chain today:
`Market Research → (BAND) → PM writes SPEC → (BAND) → Engineer builds in AdaL → Prelint checks against SPEC`
and `Pricing Data agent runs the comp pipeline the product calls`.

## 6. Sponsor tools and credits

**Mandatory (hackathon requirement): Kylon, BAND, AdaL, Rocket Ride, Prelint.** Each must do real,
visible work in the company, not a token integration.

### Mandatory tools: what each one does here

| Tool | Credits | Its job in the company | How it shows up for judges |
|---|---|---|---|
| **Kylon** | $100 | The office: Atlas, Scout, Spec, and Comp live here as workspace members with roles, memory, rooms, the Agent Log and Decisions tables. Also the model proxy for the app's Claude calls | Agent profiles, room threads, Agent Log and Decisions tables |
| **BAND** | Free account (live Oct 7) | The wire between agents that run in *different* tools: Kylon agents, Forge running in AdaL on the founder's computer, and the Rocket Ride pipeline. All cross-tool handoffs (spec → build, build → spec check, data issues → pipeline) go through one BAND room with @mentions | BAND room transcript of handoffs and delegations |
| **AdaL** | (no credit info) | Forge's workbench: Forge runs as an AdaL agent that writes, tests, and ships the app; its browser agent does end-to-end checks on the live site | Commits and PRs authored through AdaL, browser test runs |
| **Rocket Ride** | Cloud code (first job live Oct 7: `ops/rocketride/`) | Comp's machinery: the price-check pipeline (query → Apify → match/filter → stats → index write) and the scheduled batch jobs (index refresh, growth, pre-warm) | Pipeline definitions in the repo, run history |
| **Prelint** | $250 (this repo) | Spec's enforcer: checks every PR against `docs/SPEC.md` business rules (`BR-n`) and blocks spec drift | PR checks citing BR rules |

### Other tools

| Tool | Credits | Use | Owner | Phase |
|---|---|---|---|---|
| InstaCloud (from the InsForge team) | Free tier | Hosts the app as a container (GitHub deploy, root dir `web`), plus Postgres for scans and the price index. Services scale to zero when idle | Engineer | 1 |
| Apify | $100 | Sold and active listings for comps (called by the Rocket Ride pipeline) | Pricing Data | 1 |
| Tenki | $200 | Sandboxes, CI runners, PR review for agent-written code | Engineer | 1–2 |
| Querit | $100 | Web search for market, competitor, and fee research; trend checks | Market Research | 1 |
| Glasser.ai | $10 | A few targeted lookups only: reseller creators and communities for outreach | Growth | 2 |
| Ask the W | 30-day trial | TBD: what it does is unclear | — | ? |
| Voiskey | None found | Fallback: browser speech. Ask their booth about an API | Engineer | — |
| Paritok | None found | Fallback: summarize long context ourselves | — | — |
| Finch | None found | Check whether submitting a skill is free | Pricing Data | 2 |

**InsForge vs. InstaCloud** (same team, different products): InstaCloud runs our app container,
Postgres, and storage, and is what we use. InsForge is a backend-as-a-service (auth, database APIs,
model gateway, frontend hosting); we'd only add it if we need user sign-in quickly.

### Budget guardrails

- **Apify ($100):** the largest real cost, ~$0.16 per new lookup. Every lookup checks the price index
  first (fresh for 7 days, BR-18/19), live lookups stop at $3/day (BR-21), and pre-warming popular
  segments costs ~$3.50 per full refresh. Pricing Data reports spend daily. If spend passes $50
  before Oct 10, the CEO decides what to cut.
- **Glasser ($10):** roughly a handful of queries. Growth proposes each one; the CEO approves.
- **Kylon ($100), Tenki ($200), Prelint ($250), Querit ($100):** no cap expected this week; Finance tracks totals.
- **Model calls:** not covered by any sponsor. See the open decision in `docs/decisions.md`.

## 7. Phase 1 timeline (today)

| Time | Work |
|---|---|
| 11:30–12:00 | Repo, plan, decide sourcer experience; sign up for sponsor tools (Kylon, BAND, AdaL, Apify, Querit) |
| 12:00–1:00 | Agents set up in Kylon + BAND. Research agent: competitors + fee table. PM: finalize SPEC. Engineer: scaffold app |
| 1:00–3:00 | Comp pipeline end-to-end for one category; result card UI |
| 3:00–4:00 | Deploy, test on phones at a real item or two, landing page stub with waitlist |
| 4:00–5:00 | Demo script, capture agent work evidence (BAND/Kylon logs), 2-min pitch |

## 8. Phase 2 outline (Oct 8–11)

- **Oct 8:** Rocket Ride pipeline + Voiskey voice input; more marketplaces; start outreach (r/Flipping, FB reseller groups, reseller TikTok/YouTube via Glasser).
- **Oct 9:** 10–30 real resellers testing in stores; feedback pipeline; Finance model from measured per-scan cost.
- **Oct 10:** Ship feedback fixes (Tenki + Prelint); marketing assets; deck; rehearse voice Q&A.
- **Oct 11:** Final demo.

## 9. Risks

- Scraping ToS → cache, low volume, prefer official APIs (eBay Browse API for active listings).
- Latency in-store → target <10s; show identification first, stream comps in.
- Bad identification → always let the user confirm/correct before comps.
- Incumbent AI (eBay, Poshmark) → they only see their own marketplace and help *after* purchase; we help *before*.

## 10. Open questions

- Team: solo or 2? Who owns what?
- Ask the W: what is it, and is it useful here?
- Voiskey, BAND, Paritok, Finch: any free tier or hackathon access?
- Do we have access to real resellers to test with this week?
- Default thresholds ($10 min profit, 30 days) — validate with the first few users.
