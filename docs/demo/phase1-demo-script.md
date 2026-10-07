<!-- Atlas's Phase 1 demo script, exported verbatim from Kylon #hq file phase1-demo-script.html (id 696d05265c78), Oct 7 2026. Edits go through PRs. -->

Founder’s spoken script · October 7 · 5–6 PM PT

## One thrift find. One honest answer.

Target: about three minutes with two genuine requests, subject to deployment and phone rehearsal. Read the quoted lines; stage directions are not spoken. Founder presents throughout. If either verdict is not actually verified, use the fallback instead of calling it a live BUY or PASS.

**0:00–0:25**

## The problem

“Imagine you’re at a thrift rack. You find a Patagonia fleece for nine dollars. You have seconds to decide whether it is worth buying, but sold prices, fees and demand are scattered across marketplaces. Flipwise is a voice-first sourcing assistant for side-hustle apparel resellers. Let me show the first working slice.”

Show the phone on the app’s capture screen. Do not claim user traction.

Plan: customer, problem, Phase 1 scope · Live app

**0:25–1:40**

## The phone

“I describe the find instead of typing a listing.”

First request: tap the mic and say “Patagonia Synchilla, men’s large, nine bucks.” Show the returned eBay card. This cached item is intended to return BUY with about $60 estimated profit, but do not announce either as a verified result before the new profit-only BR-5/14 rule is reviewed, deployed and rehearsed. Second request: say the exact low-value item and tag price that Comp confirms and caches for a real PASS; its wording is pending Comp’s receipt. Do not substitute a fabricated example. A live request can spend lookup credits on a cache miss; confirm cost/scope before rehearsal.

“Here is the first result. Now I will try a low-value item at a tag price that leaves no estimated profit. The two outcomes are BUY and PASS only if the live cards actually return those verdicts.”

Show only the result that actually appeared. If sound works, let it speak. If not, read the visible verdict yourself. Do not narrate a specific price, count or BUY before seeing it.

“This is a guide, not a guaranteed resale outcome. For Phase 1, the call is based on estimated profit: BUY at or above the user’s minimum, PASS at or below zero, and MAYBE between. Demand speed returns in Phase 2 once the counts are comparable. These profit numbers are estimates using fee and shipping assumptions, not guaranteed proceeds.”

PR #14: speed-unknown safety fix merged, not deployed at last check · Forge’s read-only eBay data trace · Open fee-base PR #4

**1:40–2:35**

## The team behind it

“The other part of this demo is the organization that built it. In Kylon, agents keep an Agent Log and a decision record. Spec turned the product rules into a handoff through BAND. Forge built an engineering change using AdaL; Prelint reviewed the pull request. You can trace the work from decision to reviewed code rather than taking our word for it.”

Show the Agent Log, Decisions, Spec → Forge BAND handoff, and PR #8. Move briskly; do not open extra tabs if the clock is tight.

“Rocket Ride screened 40 indexed Synchilla sold prices in a separate batch check. Its IQR detector and the app’s BR-12 rule disagreed on one borderline outlier, so the app remains authoritative. This batch job is real evidence, but Rocket Ride is not wired into the live lookup.”

Plan: tool roles and proof · AdaL work and Prelint review · Rocket Ride batch receipt; run link pending

**2:35–3:00**

## The close

“This is an eBay-first MVP, not yet the full cross-marketplace vision. This is an eBay-first MVP. For Phase 1, the verdict is profit-based; demand speed comes back in Phase 2 once the data is comparable. We still need clearer fee inputs, live reseller testing, and to connect the separate Rocket Ride batch step to the app. Thank you—happy to take questions.”

Stop on the app or one proof screen. Do not say the founder’s new 90-day formula or cutoff is live; The founder’s later dated profit-only direction supersedes the 90-day cutoff request for this demo. Spec’s BR-5 spec PR #17 is open; Forge is waiting for it to merge and for the BAND implementation handoff. PR #14 is merged but not deployed at last report, and Forge cannot deploy with current access. The item-only fee-input rule may still prevent a genuine Synchilla BUY; that policy requires a separate founder decision. Do not call the planned two-verdict behavior live without release and rehearsal receipts.

Founder’s revised BR-10 direction · Plan: Phase 1 and next proof

## If something fails, use one line and keep moving

- Mic unavailable: “The mic is not cooperating in this room, so I’ll type the same find.” Enter Patagonia Synchilla fleece, nine bucks only if the intended lookup/demo path is approved.
- Voice output unavailable: “The spoken answer is unavailable here; I’ll read the on-screen result.” Read only what appears.
- Lookup/network unavailable: “The live lookup failed, so I’m switching to a labeled recording of a prior working pass.” If none exists, show the capture screen and engineering proof instead; never fabricate comps or a verdict.
- Speed/profit or BUY challenged: “That on-screen recommendation uses incomplete matching and fee inputs. The intended Phase 1 verdict uses estimated profit, not speed. Fee and shipping inputs remain a separate accuracy gate; this is not guaranteed after-fees profit.” If the old speed-gated build appears, say the new rule is not deployed rather than claiming a BUY. Do not stage a result. Founder decision
Do not run a paid comp lookup without founder approval. The human phone rehearsal, spoken output, two live verdicts, review/merge of spec PR #17, new BR-5/14 implementation, and deployment were unverified at this update. Demo-mode data is separate and must be labeled. The BUY and PASS thresholds are founder-set product rules, not an apparel industry benchmark.

