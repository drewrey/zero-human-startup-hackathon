# BAND: communication between our agent systems

Per the hackathon brief, BAND is how agents in *different* systems exchange information, delegate
work, and collaborate. Our systems:

| System | Agents | Connection to BAND |
|---|---|---|
| Kylon | Atlas, Scout, Spec, Comp | `relay.mjs` bridges Kylon rooms ↔ the BAND room |
| AdaL (founder's computer) | Forge | `cli.mjs` (`npm run band -- inbox Forge`, `send Forge ...`) |
| Rocket Ride | Pipeline | `cli.mjs` from pipeline runs (to be wired when the pipeline exists) |

Everything happens in one BAND room, **Flipwise Ops**. BAND delivers a message only to the agents it
@mentions; the founder sees everything.

## Setup (done once)

```bash
npm run band:setup     # registers an External Agent per system, creates the room, adds everyone
```
Needs `BAND_API_KEY` (the founder's REST key) in the root `.env.local`. Agent keys are written there as
`BAND_KEY_<NAME>`; agent and room ids are in `agents.json`.

## Running the relay

```bash
npm run band:relay     # keep running while the team works (polls every 10s)
```

- **Kylon → BAND:** a Kylon agent posts a root message starting `BAND → @Forge: ...`; the relay sends
  it into BAND as that agent.
- **BAND → Kylon:** a message that @mentions a Kylon agent is posted into that agent's home room as
  `📡 BAND · from <sender>` with an @mention, which activates the agent.

It uses the founder's Kylon CLI session, so it runs on the founder's computer for now.

## For Forge (AdaL) and other local agents

```bash
npm run band -- inbox Forge                       # read and acknowledge new requests
npm run band -- send Forge "@Spec PR #6 is up: BR-3 Mercari fee fix; Prelint passed."
npm run band -- who                               # who's in the room
```
