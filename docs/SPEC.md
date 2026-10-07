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
🔊  "Buy it. Best on eBay, about 32 profit, sells in about a week."
📱  ┌──────────────────────────────┐
    │ ✅ BUY        +$32 on eBay ⭐ │
    │ Sold $38–$52 · median $45    │
    │ 24 comps · ~9 days to sell   │
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
| Result card | Verdict (BUY / MAYBE / PASS / NOT ENOUGH DATA), best platform + net profit, sold range + median, comp count, est. days to sell, per-platform net row, assumptions made, buttons: why?, + haul, new item |
| Comps | Sold listings used: platform, title, sold price, sold date, link; excluded listings hidden behind a toggle |
| Haul | Today's items: name, tag price, expected net, best platform; trip totals (spent, expected revenue, expected profit) |
| Settings | Home platform, min profit per item, max days to sell, sales tax rate |

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
- **BR-5 Verdict logic** (using the recommended platform, BR-8):
  - **BUY:** `net_profit ≥ min_profit` AND `est_days_to_sell ≤ max_days`
  - **MAYBE:** `net_profit > 0` and exactly one of the two thresholds fails
  - **PASS:** `net_profit ≤ 0`, or both thresholds fail
  - **NOT ENOUGH DATA:** fewer than 3 matched sold comps across all platforms
  - `min_profit` and `max_days` are per-user settings. Defaults: `min_profit = $10`,
    `max_days = 30` (to be checked with users).
- **BR-6 Follow-up questions:** at most 2 per item. Only ask about attributes that change price
  (model/variant, size, gender, condition, era). Otherwise proceed and state assumptions on the card
  ("Assumed: men's, good condition").
- **BR-7 Missing tag price:** if the sourcer gives no tag price, do not output BUY/PASS. Instead output a
  **max buy price**: the highest tag price at which BR-5 would still return BUY. Spoken as
  "Worth it under $X."
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

- **BR-10 Est. days to sell (v0 heuristic):** per platform,
  `sell_through = sold_last_30d / max(active_listings, 1)`;
  `est_days_to_sell = clamp(30 / sell_through, 1, 180)`. Shown as "~N days". Replace with a better model
  once we have our own outcome data.

### Comps

- **BR-11 Matching:** a comp matches if brand and item type match and, when known, size, gender, and
  model/variant match. Condition mismatches are allowed but weighted lower (Phase 2).
- **BR-12 Outliers:** drop sold prices outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` before computing the
  median. Lots/bundles ("lot of 5") are excluded.

### Voice

- **BR-14 Spoken answer** is ≤ 20 words, in this order: verdict, best platform, net profit (rounded
  to the dollar), sell speed. Numbers on the card and in speech must match.
- **BR-15** The card and the spoken answer are produced from the same result object.

### Data

- **BR-16** Every scan is stored: transcript, photo (if any), extracted attributes, assumptions, comps
  used, per-platform results, verdict, and the sourcer's action (saved to haul / dismissed).
  This is the pricing dataset.
- **BR-17** Haul totals: `spent = Σ purchase_cost`, `expected_profit = Σ net_profit on recommended platform`.

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
      "fees": 6.0, "shipping": 0, "net_profit": 32.0, "est_days_to_sell": 9 }
  ],
  "recommended_platform": "ebay",
  "verdict": "BUY",
  "confidence": "normal",
  "max_buy_price": null,
  "spoken": "Buy it. Best on eBay, about 32 profit, sells in about a week."
}
```

## 6. Acceptance checks (for Prelint / QA)

- A result with negative net profit on the recommended platform is never BUY (BR-4).
- Changing `min_profit` in settings changes the verdict on the next scan without code changes (BR-5).
- No tag price → card shows "Worth it under $X", no BUY/PASS (BR-7).
- Never more than 2 follow-up questions per item (BR-6).
- Fewer than 3 comps → NOT ENOUGH DATA (BR-5).
- Spoken numbers equal card numbers (BR-14, BR-15).
- Home platform is recommended when it is within the bias threshold of the best platform (BR-8).
- Fee values come from config with a source and as-of date (BR-3).
