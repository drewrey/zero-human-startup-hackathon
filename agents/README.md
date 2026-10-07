# AI Founding Team

Each agent lives in Kylon, talks to the others over BAND, and logs its outputs to `docs/` (or the
agent-work log) so judges can see evidence of the work it did.

## Roster

| Agent | Owns | Tools | Hands off to | Answers in investor Q&A |
|---|---|---|---|---|
| **CEO / Strategy** | Priorities, decision log, daily standup | Kylon, Paritok | Everyone | Why now? Risks? Why invest? |
| **Market Research** | Market size, competitor matrix, customer pain points, marketplace fee table | Querit, Apify, Glasser | PM, Finance, Growth | Market size, competition |
| **Product Manager** | `docs/SPEC.md`, MVP scope, roadmap, verdict rules | Prelint | Engineer, QA | How it works, why customers choose it |
| **Pricing Data** (custom) | Comp pipeline, data quality, the pricing dataset (moat) | Rocket Ride, Apify, Finch | Engineer, Finance | Defensibility, data sources |
| **Engineer** | App, backend, deploy | AdaL, Tenki, InsForge/Instacloud | QA / PM | Live demo |
| **Growth & Sales** (P2) | Landing page, community outreach, creator partnerships, signup pipeline | Glasser, AdaL browser, Querit | Customer Success, Finance | First 100 customers |
| **Finance** (P2) | Pricing, per-scan cost, unit economics, financial model | Querit | CEO | Unit economics, use of funds |
| **Customer Success** (P2, optional) | Beta onboarding, feedback pipeline → PM | Rocket Ride, BAND | PM | Traction, customer feedback |

## Core workflows (BAND handoffs)

1. **Research → Spec → Build → Check**
   Market Research findings → PM updates SPEC → Engineer implements in AdaL → Prelint checks against SPEC → Tenki reviews.
2. **Price check (in product)**
   App request → Pricing Data pipeline (Rocket Ride) → result back to app; every scan stored.
3. **Feedback loop (Phase 2)**
   User feedback → Customer Success categorizes → PM prioritizes → Engineer ships.
4. **Lead gen (Phase 2)**
   Growth defines ICP → Glasser/Apify discover resellers + creators → score → outreach drafts → human approves send.

## Role prompts

Each agent's system prompt = `_shared-context.md` + its role file.

| Agent | Prompt | Phase |
|---|---|---|
| CEO / Strategy ("Atlas") | `ceo-strategy.md` | 1 |
| Market Research ("Scout") | `market-research.md` | 1 |
| Product Manager ("Spec") | `product-manager.md` | 1 |
| Pricing Data ("Comp") | `pricing-data.md` | 1 |
| Engineer ("Forge") | `engineer.md` | 1 |
| Growth & Sales, Finance, Customer Success | to be written | 2 |

