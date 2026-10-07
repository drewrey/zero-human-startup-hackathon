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
                    Store scans + comps (InsForge DB/storage) → becomes the pricing dataset
                    Phase 2: price index checked first (BR-18); nightly batch jobs refresh and grow it,
                    so live scraping is only needed for the long tail
Deploy: InsForge on Instacloud (backend + hosting)
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

Credits confirmed Oct 7. Tools without credits stay in the plan only if they turn out to have a free
tier; until then each has a fallback.

| Tool | Credits | Use | Owner | Phase |
|---|---|---|---|---|
| Kylon | $100 | Hosts the 5 agents, roles, task ownership; agent handoffs until BAND is available | CEO | 1 |
| InsForge on Instacloud | Free tier | Backend (Postgres, auth, storage, functions) + hosting the app. Free tier includes $1 of model-gateway credit; free projects pause after a week idle | Engineer | 1 |
| Apify | $100 | Sold and active listings for comps, and nightly index refreshes | Pricing Data | 1 |
| Prelint | $250 (this repo) | Check code against `docs/SPEC.md` before each deploy | PM | 1 |
| Rocket Ride | Cloud code | Price-check pipeline, nightly batch jobs, feedback pipeline | Pricing Data | 1–2 |
| Tenki | $200 | Sandboxes, CI runners, PR review for agent-written code | Engineer | 1–2 |
| AdaL | (no credit info) | Primary build/execution platform | Engineer | 1 |
| Querit | $100 | Web search for market, competitor, and fee research; trend checks | Market Research | 1 |
| Glasser.ai | $10 | A few targeted lookups only: reseller creators and communities for outreach | Growth | 2 |
| Ask the W | 30-day trial | TBD: what it does is unclear | — | ? |
| Voiskey | None found | Fallback: browser speech. Ask their booth about an API | Engineer | — |
| BAND | None found | Fallback: Kylon task threads for handoffs. Worth asking: $500 cash prize | CEO | — |
| Paritok | None found | Fallback: summarize long context ourselves | — | — |
| Finch | None found | Check whether submitting a skill is free | Pricing Data | 2 |

### Budget guardrails

- **Apify ($100):** the largest real cost. Cache every query for 24h (index for 7 days per BR-19),
  cap live fetches per day, and have Pricing Data report spend daily. If spend passes $50 before
  Oct 10, the CEO decides what to cut.
- **Glasser ($10):** roughly a handful of queries. Growth proposes each one; the CEO approves.
- **Kylon ($100), Tenki ($200), Prelint ($250), Querit ($100):** no cap expected this week; Finance tracks totals.
- **Model calls:** not covered by any sponsor beyond InsForge's $1. See the open decision in
  `docs/decisions.md`.

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
