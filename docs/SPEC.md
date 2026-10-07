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
🔊  "Buy it. Best on eBay, about 32 profit. Recent demand meets your pace."
📱  ┌──────────────────────────────┐
    │ ✅ BUY        +$32 on eBay ⭐ │
    │ Sold $38–$52 · median $45    │
    │ 24 comps · 150% sold/active  │
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
| Result card | Verdict (BUY / MAYBE / PASS / NOT ENOUGH DATA), best platform + net profit, sold range + median, comp count, 30-day sold/active rate and speed signal (or speed unknown), per-platform net row, assumptions made, buttons: why?, + haul, new item |
| Comps | Sold listings used: platform, title, sold price, sold date, link; excluded listings hidden behind a toggle |
| Haul | Today's items: name, tag price, expected net, best platform; trip totals (spent, expected revenue, expected profit) |
| Settings | Home platform, min profit per item, desired sale window (`max_days`), sales tax rate |

## 3. Business rules

### Pricing

- **BR-1 Expected sale price** for a platform = median sold price of matched comps on that platform
  in the last 90 days, after outlier removal (BR-12).
- **BR-2 Net profit** for a platform =
  `expected_sale_price + seller_received_shipping − platform_fees(fee_inputs, fee_rule) − seller_shipping_cost − purchase_cost`,
  where `purchase_cost = tag_price × (1 + sales_tax_rate)`. The fee inputs are the expected item
  price, buyer shipping charge (even when a platform collects it for a label), applicable buyer sales
  tax, and any other charge included by that platform's rule. Buyer sales tax is a fee-base input,
  **not** seller revenue. `seller_received_shipping` is only a shipping payment that actually reaches
  the seller; it is zero for a platform-managed buyer-paid label. `seller_shipping_cost` is actual
  postage/label cost or seller-funded shipping discount/upgrade, not the buyer's shipping charge.
  Count a buyer-paid shipping amount in revenue only when the seller receives it, and count its
  actual postage cost separately. For a buyer-pays-label baseline, seller shipping cost is zero,
  but any buyer shipping charge still enters a fee base when the platform requires it.
  If a required fee-base or shipping input is unavailable, use an explicit item-price-only scenario,
  display **ESTIMATE: item-only fee base, buyer-paid shipping, no seller discount** on the result,
  retain the missing-input assumption in the result object, and do not output BUY from that
  incomplete profit estimate. This temporary scenario is not a substitute for collecting the inputs.
  Each platform result MUST include `fee_estimate` with typed `status` (`"complete"` or
  `"estimate"`), `fee_base_mode` (`"full"` or `"item_only"`), `missing_inputs` (an array of
  required fee/shipping input identifiers), and `assumptions` (user-readable scenario text).
  `status = "complete"` only when every input required by the selected effective-dated fee
  rule is known, including an explicit zero or not-applicable value; a missing value is never
  treated as zero. Otherwise set `status = "estimate"`, `fee_base_mode = "item_only"`, and
  name every missing input and the scenario on the card. `complete` describes input coverage,
  not guaranteed realized proceeds. Keep these fee assumptions separate from item-attribute
  `assumptions`. The recommended platform's `fee_estimate.status` governs whether a BUY claim
  is allowed; a complete estimate on another platform does not clear an incomplete one.
- **BR-3 Platform fees and seller shipping costs** live in a versioned config table with platform,
  effective date, fee formula and its base (item price, buyer shipping, applicable buyer tax and
  other applicable amounts), fixed-fee thresholds/exceptions, shipping mode, seller-funded
  discount/label assumption, source URL and as-of date. They are never hardcoded in verdict logic.
  Use the rate effective on the scan date, not a future published schedule. For an ordinary US
  apparel order, the buyer-pays-shipping baseline has zero seller-paid postage, **not** zero postage
  in the order or necessarily zero shipping in the fee base. The current verified branches and
  exceptions are in [US apparel marketplace fees](research/fees.md) (checked 2026-10-07):
  [eBay fee base](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822),
  [Depop processing base](https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges),
  [Mercari fee base](https://www.mercari.com/us/help_center/article/169/).

### Verdict

- **BR-4 Hard rule:** a verdict is never BUY when net profit on the recommended platform is ≤ $0.
- **BR-5 Verdict logic** (using the recommended platform, BR-8):
  - **NOT ENOUGH DATA:** fewer than 3 matched sold comps across all platforms; check this first.
  - **PASS:** `net_profit ≤ 0`; or net profit is positive but below `min_profit` AND known
    sell-through fails the speed threshold in BR-10.
  - **BUY:** `net_profit ≥ min_profit` AND a known sell-through rate meets the BR-10 speed threshold
    AND the recommended platform has `fee_estimate.status = "complete"` (BR-2). An incomplete
    fee estimate cannot produce BUY, regardless of the estimated profit or speed signal.
  - **MAYBE:** remaining positive-profit cases (one threshold fails, speed is unknown, or the
    recommended platform's fee estimate is incomplete).
    Unknown speed cannot produce BUY or PASS solely for being unknown.
  - `min_profit` and `max_days` are per-user settings. Defaults: `min_profit = $10`,
    `max_days = 30` (to be checked with users). `max_days` is a desired sale window for a
    market-level demand threshold, **not** a per-listing time-to-sale prediction.
- **BR-6 Follow-up questions:** at most 2 per item. Only ask about attributes that change price
  (model/variant, size, gender, condition, era). Otherwise proceed and state assumptions on the card
  ("Assumed: men's, good condition").
- **BR-7 Missing tag price:** if the sourcer gives no tag price, output a **max buy price** instead of
  BUY/PASS: the highest whole-dollar tag price at which net profit still clears `min_profit` (and stays
  > $0). Spoken as "Worth it under $X." If known sell-through misses the BR-10 speed threshold,
  the verdict is MAYBE with the max price ("Slower market. Worth it under $X."). If speed is
  unknown, say so and use MAYBE with the max price; never imply an individual sale time.
  An incomplete fee estimate on the recommended platform also produces MAYBE with an estimated
  max price and its assumptions, never BUY_UNDER (BR-2). If no tag price would clear
  `min_profit`, the verdict is PASS ("Even free, only about $N profit").
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

- **BR-10 Sell speed (v0 market signal):** per platform, count comparable sold listings in
  the trailing 30 days and comparable active listings at lookup time, using the same item
  attributes/filters (BR-11), marketplace and de-duplication rules. When both searches have
  complete, trustworthy coverage, `sold_last_30d >= 3` and `active_listings > 0`, set
  `sell_through = sold_last_30d / active_listings` (the reseller **sold/active** convention;
  it may exceed 100%). Otherwise `sell_through = null` and `speed_signal = "unknown"`;
  do not replace a zero active count with one or treat an incomplete/capped result as a count.
  For a known rate, `speed_threshold = 30 / max_days`. A rate at least the threshold is
  `"meets_target"`, otherwise `"below_target"`. Speak/show “Recent demand meets your pace”
  for the first or “Slower than your target” for the second, not a universal “fast” label;
  show “Speed unknown” when neither count is trustworthy. This is a heuristic market-demand
  comparison for the user's desired sale window, **not** a probability or a prediction
  that this specific listing will sell within that many days. Show the lookback, numerator,
  denominator, rate (rounded for display only) and plain-language signal on the card;
  speech names the signal, never “sells in N days.” Use the unrounded rate for the verdict.
  Sold-in-30-days and today's active snapshot are different windows, so seasonality,
  listing price and matching quality can distort the signal. Recalibrate against our own
  outcome data later. Method/caveats: [sold/active conventions and data limitations](https://flowlister.com/tools/sell-through-rate-calculator/) (checked 2026-10-07).

### Comps

- **BR-11 Matching:** a comp matches if brand and item type match and, when known, size, gender, and
  model/variant match. Condition mismatches are allowed but weighted lower (Phase 2).
- **BR-12 Outliers:** drop sold prices outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` before computing the
  median. Lots/bundles ("lot of 5") are excluded.

### Voice

- **BR-14 Spoken answer** is ≤ 20 words, in this order: verdict, best platform, net profit (rounded
  to the dollar), sell-speed signal (or “speed unknown”). Numbers and the signal on the card and
  in speech must match; never state a per-item days-to-sell prediction from BR-10.
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
  "assumptions": ["condition: good"],
  "platforms": [
    { "platform": "ebay", "comps_used": 24, "median": 45, "p25": 38, "p75": 52,
      "fees": 6.0, "shipping": 0, "net_profit": 30.0,
      "fee_estimate": { "status": "estimate", "fee_base_mode": "item_only",
                        "missing_inputs": ["buyer_shipping", "buyer_sales_tax"],
                        "assumptions": ["Buyer-paid shipping; no seller-funded discount; fees use item price only."] },
      "speed": { "sold_last_30d": 18, "active_listings": 12, "sell_through": 1.5,
                 "signal": "meets_target", "as_of": "2026-10-07" } }
  ],
  "recommended_platform": "ebay",
  "verdict": "MAYBE",
  "confidence": "normal",
  "max_buy_price": null,
  "spoken": "Maybe. eBay, about $30 estimated profit. Recent demand meets your pace. Buyer shipping and tax unknown."
}
```

## 6. Acceptance checks (for Prelint / QA)

- A result with negative net profit on the recommended platform is never BUY (BR-4).
- Changing `min_profit` or `max_days` changes the next verdict without code changes;
  at `max_days = 30`, 12 sold / 12 active meets the speed threshold, while 6 / 12 does not
  (assuming complete coverage). At `max_days = 60`, 6 / 12 meets it (BR-5, BR-10).
- No tag price → card shows "Worth it under $X", no BUY/PASS (BR-7).
- Never more than 2 follow-up questions per item (BR-6).
- Fewer than 3 matched sold comps across platforms → NOT ENOUGH DATA regardless of speed (BR-5).
- Fewer than 3 matching sales in the 30-day speed window, zero active listings, or incomplete
  sold/active coverage → speed unknown. Positive-profit cases become MAYBE, never BUY solely
  from a missing speed count; negative or zero profit remains PASS (BR-4, BR-5, BR-10).
- When a trustworthy rate exceeds 100%, show its sold/active percentage without capping it;
  no card, speech or result object implies a specific number of days to sell (BR-10, BR-14).
- Spoken numbers equal card numbers (BR-14, BR-15).
- Home platform is recommended when it is within the bias threshold of the best platform (BR-8).
- Fee values come from effective-dated config with a source and as-of date; a future rate is not used early (BR-3).
- A buyer-paid shipping charge enters the eBay, Depop, and Mercari fee bases when their configured
  rules require it, even when seller-paid postage is $0; buyer sales tax enters the eBay and Depop
  bases when applicable and never becomes seller revenue (BR-2, BR-3).
- A seller-funded shipping discount/label reduces profit; seller-collected shipping is added to
  revenue exactly once and actual seller-paid postage is deducted exactly once (BR-2).
- Each platform result has a typed `fee_estimate`; missing required inputs produce
  `status = "estimate"`, `fee_base_mode = "item_only"`, explicit `missing_inputs` and fee
  `assumptions`, distinct from item-attribute assumptions. The card shows the ESTIMATE label
  and scenario for the recommended platform; complete input coverage requires explicit
  zero/not-applicable values, not a silent default (BR-2, BR-3, BR-15).
- An incomplete fee estimate on the recommended platform cannot produce BUY even when
  speed and the estimated profit clear their thresholds; a complete result on another
  platform does not lift this gate (BR-2, BR-4, BR-5).
