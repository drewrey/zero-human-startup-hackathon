# Hackathon Plan

Status: draft v0 — Oct 7, 11:30 AM. Open questions at the bottom; sourcer-experience decisions pending.

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
| Solution | Snap or speak an item → cross-marketplace sold comps → expected profit after fees → BUY / PASS. |
| Why now | Multimodal models can identify items from a photo; resale keeps growing; marketplaces only show their own data. |
| Moat / vision | Every scan adds to a cross-marketplace pricing dataset → pricing API for consignment, estate-sale, insurance, and resale platforms. |

## 3. Phase 1 MVP scope (by 4 PM)

The smallest thing an investor can try on their phone:

1. Open a mobile web page.
2. Take/upload a photo (+ optional typed or spoken detail and the tag price).
3. Item is identified (brand, category, size, condition) — user can correct it.
4. Sold comps are pulled for that item.
5. Result card: price range, median sold, # comps, est. sell speed, profit after fees vs. tag price, **BUY / PASS**.

**In:** one category to start (see open questions), one marketplace's sold data (eBay) if time is short.
**Out for Phase 1:** accounts, inventory, listing generation, crosslisting, multiple marketplaces, offline mode.

## 4. Architecture (proposed)

```
Phone (PWA)
  └─ photo / voice (Voiskey) / text
       └─ API  ──►  Price-check pipeline (Rocket Ride; plain code first if faster)
                      1. Identify item       vision LLM → {brand, type, size, condition, keywords}
                      2. Fetch comps         Apify actor(s): eBay sold (+ Poshmark/Mercari/Depop later)
                      3. Normalize + filter  drop outliers / mismatches
                      4. Stats               median, IQR, comp count, sell-speed proxy
                      5. Economics           fees + shipping → net profit vs. tag price
                      6. Verdict             BUY / PASS + one-line reason
                    Store scans + comps (InsForge DB/storage) → becomes the pricing dataset
Deploy: Instacloud (confirm vs. InsForge with organizers)
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

## 6. Sponsor tool map

| Tool | Use | Phase |
|---|---|---|
| Kylon | Hosts the agent team, roles, task ownership | 1 |
| BAND | Agent-to-agent handoffs | 1 |
| AdaL | Primary build/execution platform | 1 |
| Apify | Sold/active listing data | 1 |
| Querit | Market + competitor research, fee verification | 1 |
| Prelint | Check code against `docs/SPEC.md` | 1 |
| Rocket Ride | Price-check, feedback, and lead pipelines | 1–2 |
| Voiskey | Voice input in-store; voice investor Q&A | 1–2 |
| InsForge / Instacloud | Backend / deploy | 1 |
| Glasser.ai | Reseller creator + lead discovery, competitor intel | 2 |
| Tenki | Sandbox + PR review of agent-written code | 2 |
| Paritok | Compress scraped comps + long research context | 2 |
| Finch | Package "secondhand price check" as a reusable skill | 2 |

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

Sourcer experience (being decided now):
- Primary input: photo, voice, barcode/tag, or photo + voice?
- Verdict style: hard BUY/PASS, score, or price range only?
- Starting category: apparel, household, or both?
- What happens after a scan: save to haul, draft listing, nothing?

Logistics:
- Team: solo or 2? Who owns what?
- Instacloud vs. InsForge — which counts for the prize/requirement?
- Do we have access to real resellers to test with this week?
