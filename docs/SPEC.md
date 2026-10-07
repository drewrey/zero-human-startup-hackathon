# Product Spec — Sourcing Copilot (v0)

Owner: Product Manager agent. This file is the source of truth that Prelint checks the implementation
against. Business rules have IDs (`BR-n`) so checks and PRs can cite them.

Status: draft v0 — Oct 7. Values marked **TBD (Research)** are assigned to the Market Research agent.

## 1. User

**Primary persona: side-hustle reseller.** Thrifts on weekends, ~50–300 active listings, sells apparel
on one "home" platform (often Poshmark, eBay, or Depop). Lacks the price instincts of a full-timer.
Shopping with a cart, hands busy, phone in pocket, earbuds in.

**Job to be done:** "Standing at the rack, tell me fast whether this item is worth buying and where
I'd sell it."

## 2. Core experience

Voice-first. Photo is optional (and later powers listing drafts).

```
🎤  "Patagonia Synchilla, nine bucks"
🔊  "Snap-T or quarter-zip? And what size?"          ← ≤ 2 follow-ups, only price-relevant
🎤  "Snap-T, large"
🔊  "Buy it. Best on eBay, about 32 profit."
📱  ┌──────────────────────────────┐
    │ ✅ BUY        +$32 on eBay ⭐ │
    │ Sold $38–$52 · median $45    │
    │ 24 matched sold comps       │
    │ eBay $32 · Posh $29 · Depop $28
    │ [why? → comps]  [+ haul]     │
    └──────────────────────────────┘
```

### 2.1 Flow

1. **Capture.** Sourcer taps once (or uses a hands-free trigger later) and describes the item by voice.
   Optional: attach a photo.
2. **Understand.** Extract attributes: brand, item type, model/variant, size, gender/department,
   condition, notable flaws, era/vintage, tag price.
3. **Follow up (if needed).** Ask at most 2 short spoken questions, only for attributes that materially
   change price (BR-6).
4. **Price.** Fetch sold comps and active listings per platform; compute stats and per-platform net
   profit.
5. **Answer.** Speak a short verdict and show the result card at the same time.
6. **Act.** Sourcer can tap **why?** to see the comps, or **+ haul** to save the item to today's trip.

### 2.2 Screens

| Screen | Contents |
|---|---|
| Capture | Big mic button, live transcript, optional camera button, settings gear |
| Result card | Verdict (BUY / MAYBE / PASS / NOT ENOUGH DATA), best platform + net profit, sold range + median, comp count, per-platform net row, assumptions made, buttons: why?, + haul, new item; any speed shown is informational only and must have verified comparable coverage |
| Comps | Sold listings used: platform, title, sold price, sold date, link; excluded listings hidden behind a toggle |
| Haul | Today's items: name, tag price, expected net, best platform; trip totals (spent, expected revenue, expected profit) |
| Settings | Home platform, min profit per item, sales tax rate; desired sale window (`max_days`) is retained but does not affect the Phase 1 verdict |

## 3. Business rules

### Pricing

- **BR-1 Expected sale price** for a platform = median sold price of matched comps on that platform
  in the last 90 days, after outlier removal (BR-12).
- **BR-2 Net profit** for a platform =
  `expected_sale_price − platform_fees(expected_sale_price) − seller_shipping_cost − purchase_cost`,
  where `purchase_cost = tag_price × (1 + sales_tax_rate)`.
- **BR-3 Platform fees and seller shipping costs** live in a config table (platform, fee formula,
  shipping assumption for apparel, source URL, as-of date). They are never hardcoded inside
  business logic. Values: **TBD (Research)**.

### Verdict

- **BR-4 Hard rule:** a verdict is never BUY when net profit on the recommended platform is ≤ $0.
  A positive item-price-only estimate is not evidence that the complete after-fees profit is
  positive when required buyer shipping/tax inputs are missing; see the unresolved BR-2/BR-3
  proposal in PR #4. Do not silently treat missing fee inputs as zero to manufacture BUY.
- **BR-5 Phase 1 verdict logic (founder-set, effective 2026-10-07 through the Oct 11, 2026 demo)**
  uses net profit on the recommended platform (BR-8), **not** sell speed:
  - **NOT ENOUGH DATA:** fewer than 3 matched sold comps across all platforms; check this first.
  - **PASS:** `net_profit <= 0`.
  - **BUY:** `net_profit >= min_profit` and `net_profit > 0`, using the user's
    `min_profit` (default $10). A minimum of $0 still cannot override BR-4. This is the
    speed-independent verdict branch, not a waiver of incomplete fee inputs: when the
    BR-2/BR-3 fee-base contract in PR #4 is approved/effective, an estimate missing its
    required inputs must not produce BUY under that contract. Do not merge or implement
    PR #4 by implication from this Phase 1 speed change.
  - **MAYBE:** `0 < net_profit < min_profit`, or a positive estimate missing fee inputs
    required by an approved/effective BR-2/BR-3 contract. The latter must carry its
    ESTIMATE label and assumptions rather than pass as complete after-fees profit.
  - The user setting `min_profit` defaults to $10 (to be checked with users). Retain
    `max_days = 30` for later research but **ignore it** in Phase 1 verdicts. Unknown,
    missing or low speed never changes BUY/PASS/MAYBE. This is a Phase 1 scope decision,
    not a claim of validated market demand; revisit speed gating only after comparable
    data and a separately approved Phase 2 rule exist.
- **BR-6 Follow-up questions:** at most 2 per item. Only ask about attributes that change price
  (model/variant, size, gender, condition, era). Otherwise proceed and state assumptions on the card
  ("Assumed: men's, good condition").
- **BR-7 Missing tag price:** if the sourcer gives no tag price, output a **max buy price** instead of
  BUY/PASS: the highest whole-dollar tag price at which net profit still clears `min_profit` (and stays
  > $0). Spoken as "Worth it under $X." Do not change the max price or verdict based on speed
  in Phase 1. If no tag price would clear `min_profit`, the verdict is PASS ("Even free, only
  about $N profit").
- **BR-13 Low confidence:** with 3–5 matched comps, the verdict shows a "low confidence" label and the
  spoken answer says so.

### Platform recommendation

- **BR-8 Home-platform preference:** compute net profit on every platform with comps. Recommend the
  sourcer's home platform unless another platform beats it by at least
  `max($5, 15% of home net)` (constant `HOME_PLATFORM_BIAS`, tunable). The card always shows every
  platform's net so the sourcer can see the alternative.
- **BR-9 Cross-platform suggestions (Phase 2):** track how often a non-home platform wins for a user's
  scans; after enough evidence, suggest "You'd net more on Depop for vintage tees."

### Sell speed

- **BR-10 Phase 1 speed handling (effective through the Oct 11, 2026 demo):** speed is
  informational only and never gates the BR-5 verdict. Hide it when comparable, complete
  marketplace sold and active counts for the same segment and window are unavailable;
  otherwise a speed signal may be shown with its numerator, denominator, window and
  as-of date, clearly labeled as market demand and not an individual sale-date forecast.
  For eBay, broad-keyword or capped/90-day-averaged counts do **not** establish comparable
  coverage; the fail-closed Speed unknown behavior from PR #14 remains in force. Do not
  invent a rate, convert a 90-day average into 30-day matched sales, or relax coverage to
  make a demo item look faster. No BUY threshold for sell speed is set for Phase 1.
  In Phase 2, define a separately reviewed formula, comparable data contract and
  founder-approved threshold before reintroducing speed into verdicts.
### Comps

- **BR-11 Matching:** a comp matches if brand and item type match and, when known, size, gender, and
  model/variant match. Condition mismatches are allowed but weighted lower (Phase 2).
- **BR-12 Outliers:** drop sold prices outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` before computing the
  median. Lots/bundles ("lot of 5") are excluded.

### Voice

- **BR-14 Spoken answer** is ≤ 20 words, in this order: verdict, best platform, net profit (rounded
  to the dollar). A verified informational speed signal is optional; otherwise omit speed.
  Numbers and any signal on the card and in speech must match; never state a per-item
  days-to-sell prediction from BR-10.
- **BR-15** The card and the spoken answer are produced from the same result object.

### Data

- **BR-16** Every scan is stored: transcript, photo (if any), extracted attributes, assumptions, comps
  used, per-platform results, verdict, and the sourcer's action (saved to haul / dismissed).
  This is the pricing dataset.
- **BR-17** Haul totals: `spent = Σ purchase_cost`, `expected_profit = Σ net_profit on recommended platform`.

### Price index (Phase 2)

- **BR-18 Index first:** a lookup first checks the price index for the item's segment
  (brand × item type × model × size × gender × platform). If a fresh entry exists with at least
  `MIN_COMPS` comps, the answer comes from the index without a live fetch.
- **BR-19 Freshness:** an index entry is fresh for 7 days (`INDEX_TTL_DAYS`, tunable). A stale entry
  can still answer, labeled with its as-of date, and a refresh is queued in the background. The card
  shows the data's as-of date either way.
- **BR-20 Fallback and growth:** on an index miss, fetch live, answer, and add the segment to the index.
  Scheduled batch jobs keep the index fresh and grow it from scan history (see
  `agents/pricing-data.md`). Index and live answers use the same rules (BR-1 to BR-12).
- **BR-21 Spend cap:** live marketplace lookups stop for the day once spend reaches
  `APIFY_DAILY_BUDGET_USD` (default $3). Index answers keep working; a new item gets a clear
  "lookups paused for today" message instead of a verdict. Batch jobs run under their own per-run cap.

## 4. Phase 1 scope (today)

| In | Stretch | Out (Phase 2+) |
|---|---|---|
| Voice capture + transcript | Second/third platform comps (Poshmark, Depop, Mercari) | Photo → listing draft |
| Attribute extraction + ≤2 follow-ups | Optional photo used for identification | Accounts / sync across devices |
| eBay sold comps + stats | Hands-free trigger | Cross-platform suggestions (BR-9) |
| Verdict card + spoken answer | | Listing posting / crosslisting |
| Comps view, haul (local to device) | | Household goods |
| Settings: home platform, min profit, max days, tax | | |

If only one platform is live, BR-8 still runs; it simply has one candidate.

## 5. Result object (shared by card + speech)

```json
{
  "item": { "brand": "Patagonia", "type": "fleece pullover", "variant": "Synchilla Snap-T",
            "size": "L", "gender": "men", "condition": "good", "tag_price": 9.0 },
  "assumptions": ["condition: good", "Fee scenario: item-price-only; buyer shipping and buyer tax unknown"],
  "platforms": [
    { "platform": "ebay", "comps_used": 24, "median": 45, "p25": 38, "p75": 52,
      "fees": 6.0, "shipping": 0, "net_profit": 32.0,
      "speed": { "signal": "unknown", "coverageComplete": false } }
  ],
  "recommended_platform": "ebay",
  "verdict": "MAYBE",
  "confidence": "normal",
  "max_buy_price": null,
  "spoken": "Maybe. eBay, about $32 estimated profit; buyer shipping and tax unknown."
}
```

## 6. Acceptance checks (for Prelint / QA)

- A result with negative net profit on the recommended platform is never BUY (BR-4).
- With at least 3 matched sold comps and *complete* profit inputs, a $10 minimum profit:
  net profit $10 or more → BUY, $0 or less → PASS, $0.01–$9.99 → MAYBE,
  regardless of `speed.signal` (including `unknown`) or `max_days` (BR-4, BR-5, BR-10).
  An incomplete fee-base input is never converted into an explicit zero for this test.
- Changing `min_profit` changes the next verdict; changing `max_days` does not change
  a Phase 1 verdict (BR-5).
- No tag price → show "Worth it under $X", not BUY/PASS; speed does not change X (BR-7).
- Never more than 2 follow-up questions per item (BR-6).
- Fewer than 3 matched sold comps → NOT ENOUGH DATA before profit classification (BR-5).
- Broad-keyword, capped or window-inferred eBay counts remain Speed unknown; hide an
  unverified rate. An unknown speed must not downgrade a profitable BUY (BR-5, BR-10).
- Neither card nor speech promises an individual days-to-sell value (BR-10, BR-14).
- Spoken numbers equal card numbers (BR-14, BR-15).
- Home platform is recommended when it is within the bias threshold of the best platform (BR-8).
- Fee values come from config with a source and as-of date (BR-3). Until PR #4 is
  approved, show the eBay Synchilla example as a directional item-only ESTIMATE, not a
  guaranteed or complete after-fees BUY: the current engine only has sale/item price,
  tag price and the user's purchase-tax setting; it does not collect actual buyer-paid
  shipping, buyer sales tax or an explicit seller shipping discount/label choice. A
  complete-input eBay BUY needs those required values (including verified explicit
  zero/not-applicable values) and the effective fee rule; they cannot be supplied by the
  current item-only result. This is a product-policy decision, not part of the speed fix.
