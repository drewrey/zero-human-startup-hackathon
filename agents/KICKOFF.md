# Kickoff: getting the agents working together in Kylon

Kylon is a shared workspace (rooms, threads, tables, workflows) where each agent is a member with its
own name, memory, and connections. The founder sets it up once; after that the agents coordinate in
rooms and threads, and the CEO agent drives the work.

Kylon is the office; **BAND is the wire** between agents in different tools (Kylon agents, Forge in
AdaL, the Rocket Ride pipeline). Every cross-tool handoff uses the format in `_shared-context.md`.

## Status (Oct 7)

Done: workspace **Circling Vultures** (`a3fae6244774`); agents Atlas, Scout, Spec, Comp created
(ids in `kylon-agents.json`) with their role prompts installed as skills
(`scripts/kylon-sync-skills.py`); rooms `#hq`, `#research`, `#product-eng`, `#pricing`; kickoff
posted in `#hq`. Agents set up their own connections (founder approves the cards) and Atlas builds the
Agent Log and Decisions database apps. BAND room "Flipwise Ops" is live with all six agents (`ops/band/`); first handoff Spec → Forge sent
over BAND. Pending: Forge in AdaL, Rocket Ride, Kylon API key.

## 0. What the founder does vs. what's scripted

The `kylon` CLI can create agents, rooms, skills, and tables, so most of this is scripted from the repo.
The founder only:

1. Signs up at app.kylon.io and creates the workspace.
2. Installs the CLI and signs in: `curl -fsSL https://api.kylon.io/install.sh | sh` (opens a browser).
3. Installs AdaL on this computer, where Forge runs (see step 5).
4. Generates one agent API key (agent settings → API key) for the app's Kylon model proxy and puts
   it in `web/.env.local` and the InstaCloud secrets as `ANTHROPIC_API_KEY`.
5. Creates the other mandatory accounts: **BAND** (free signup at band.ai), **AdaL**
   (`curl -fsSL https://adal.sylph.ai/install.sh | bash`), **Rocket Ride** cloud (hackathon code), and
   **Prelint** on the GitHub repo.

Then: one BAND room joins Forge (AdaL), the Kylon agents, and the Rocket Ride pipeline. Exactly how
each connects (MCP, SDK adapter, or Band Desktop) is confirmed once the accounts exist.

Everything below (agents, role prompts as skills, rooms, tables, kickoff message) is then created
with `kylon workspace ...` commands.

## 1. Workspace and rooms (founder, ~10 min)

Create a workspace (working name: Flipwise) and these rooms:

| Room | Members | Used for |
|---|---|---|
| `#hq` | Founder + all agents | Kickoff, standups, decisions, escalations |
| `#research` | Atlas, Scout, Spec | Market, competitor, customer, and fee research |
| `#product-eng` | Atlas, Spec, Forge, Comp | Spec changes, build requests, deploy notes |
| `#pricing` | Comp, Forge, Spec, Scout | Comp quality, price index, Apify spend |

Create two **Tables** (judges look at these as evidence of a working AI organization):

- **Agent Log**: `time`, `agent`, `what was done`, `link`. Every agent adds a row when it finishes
  something (replaces `docs/agent-log.md` while we're in Kylon; Forge exports it to the repo daily).
- **Decisions**: `date`, `decision`, `options`, `why`, `owner`, `founder approval`. Seed it from
  `docs/decisions.md`.

## 2. Create the agents (founder, ~15 min)

A new agent starts private; add it to its rooms after creating it. For each one, paste
`_shared-context.md` followed by its role file as the agent's instructions.

| Agent | Role file | How it runs | Why | Connections |
|---|---|---|---|---|
| Atlas (CEO) | `ceo-strategy.md` | Kylon-hosted | Always available to coordinate | — |
| Scout (Research) | `market-research.md` | Kylon-hosted | Web research only | Querit (as a custom API service secret) |
| Spec (PM) | `product-manager.md` | Kylon-hosted | Reads and edits the spec | GitHub (this repo) |
| Comp (Pricing Data) | `pricing-data.md` | Kylon-hosted | Data quality and index decisions | GitHub, Apify |
| Forge (Engineer) | `engineer.md` | **AdaL** on the founder's computer, joined to the team through BAND (and to Kylon if AdaL can connect there) | AdaL is mandatory; needs the repo checkout, tests, and deploy CLI | Runs locally with the repo |

Notes:
- Kylon-hosted agents spend **Kylon credits** ($100). Start them on the Standard tier and watch usage
  for the first hour before moving anyone to Max.
- Forge runs in AdaL on this computer, so it is offline when the computer sleeps.
- Never paste API keys into chat. Add them as connections or secrets in Kylon.

## 3. Kickoff message (founder posts in `#hq`)

> Welcome, team. We're building a voice-first sourcing assistant for secondhand resellers; the
> plan, spec, and decisions are in the repo (`docs/`). Final investor demo is Oct 11.
> @Atlas you run the team from here. Today's goals: (1) verified marketplace fees,
> (2) a decision on how we judge sell speed, (3) the app deployed with live eBay comps,
> (4) a pre-warmed price index within budget. Log every finished task in the Agent Log table.
> Anything that spends money or contacts real people comes to me first.

## 4. First assignments (Atlas posts these as threads; listed here so nothing is missed)

| Owner | Task | Hands off to | Done when |
|---|---|---|---|
| Scout | Fill `docs/research/fees.md`: seller fees and seller-paid shipping for eBay, Poshmark, Depop, Mercari (apparel), with source URLs and dates | Spec | Spec confirms and requests the config change |
| Spec | Propose the BR-10 sell-speed rule (sell-through rate vs. days) with a recommendation; update `docs/SPEC.md` after the founder decides | Forge, Comp | SPEC merged |
| Spec | Turn Scout's fee table into a request to update `web/src/lib/config.ts` (BR-3) | Forge | Fees marked verified in config |
| Comp | Review `web/data/seed-segments.json`; propose a pre-warm run with cost (dry run: ~$3.52) | Atlas → founder for approval | Index warmed, spend logged |
| Comp | Check 5 real items end to end and report bad matches with examples | Spec | Issues filed with `BR-n` references |
| Forge | Confirm the InstaCloud deploy (root dir `web`, secrets, Postgres `DATABASE_URL`), post the live URL | Atlas, all | URL works on a phone |
| Atlas | Post the open-decision summary (model provider, sell speed) to the founder; standup at end of day | Founder | Decisions logged |

## 5. Keeping it going

- **Standups:** Atlas posts in `#hq` at the start and end of each work block (done, next, at risk).
- **Follow-ups:** when an agent promises a check-back, it schedules a Kylon follow-up instead of
  saying "I'll check later."
- **Workflows (later):** e.g. a new row in a Feedback table triggers Spec to triage it.
- **Evidence for judges:** the Agent Log and Decisions tables, plus the handoff threads, are the proof
  that the agents work together. Keep them honest and specific.
