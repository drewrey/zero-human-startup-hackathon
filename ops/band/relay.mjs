// Bridge between Kylon (where Atlas, Scout, Spec, Comp live) and BAND (where agents in other tools
// live: Forge in AdaL, the Rocket Ride pipeline). Runs on the founder's computer, which holds the
// Kylon CLI session and the BAND agent keys.
//
//   Kylon → BAND: a Kylon agent posts a root message in any room starting with "BAND → @Name: ...".
//                 The relay sends it into the BAND room as that agent, with a real @mention.
//   BAND → Kylon: a BAND message that @mentions a Kylon agent is posted into that agent's home room,
//                 labeled as coming from BAND and @mentioning the agent so it wakes up.
//
//   node ops/band/relay.mjs            run continuously (polls every 10s)
//   node ops/band/relay.mjs --once     one pass, then exit
import fs from "node:fs";
import path from "node:path";
import { kylon, loadConfig, markProcessed, nextMessage, participants, agentKey, sendAs } from "./lib.mjs";

const STATE_FILE = path.join(import.meta.dirname, ".relay-state.json");
const OUTBOUND = /^\s*BAND\s*(?:→|->)\s*/i;
const config = loadConfig();
const kylonAgents = config.agents.filter((a) => a.system === "kylon");

const state = fs.existsSync(STATE_FILE)
  ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
  : { since: new Date().toISOString(), relayed: [] };
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

let people = [];
async function person(id) {
  if (!people.some((p) => p.id === id)) people = await participants(config.room.id, agentKey(kylonAgents[0].name));
  return people.find((p) => p.id === id);
}
/** Name to @mention in a reply: the display name when it's one word, otherwise the handle. */
const replyName = (p) => (p ? (/\s/.test(p.name) ? p.handle : p.name) : "someone");
/** BAND stores mentions as @[[uuid]]; show names instead. */
async function readable(content) {
  const ids = [...content.matchAll(/@\[\[([\w-]+)\]\]/g)].map((m) => m[1]);
  for (const id of ids) content = content.replace(`@[[${id}]]`, `@${(await person(id))?.name ?? id}`);
  return content;
}

async function inbound() {
  for (const a of kylonAgents) {
    const seen = new Set();
    for (let msg = await nextMessage(a.name, config); msg && !seen.has(msg.id); msg = await nextMessage(a.name, config)) {
      seen.add(msg.id);
      const sender = await person(msg.sender_id);
      const from = sender?.name ?? "someone";
      const text =
        `📡 BAND · from ${from} → @${a.kylonId}:\n\n${await readable(msg.content)}\n\n` +
        `_Reply over BAND with a root message starting \`BAND → @${replyName(sender)}:\`_`;
      await kylon("message", "send", "--room", a.kylonRoom, "--text", text, "--mentions", a.kylonId);
      await markProcessed(a.name, msg.id, config);
      console.log(`${new Date().toISOString()}  BAND → Kylon  ${from} → ${a.name}`);
    }
  }
}

/** "Forge: ..." or "Forge, ..." without the @ still means "@Forge". */
function addressed(text) {
  const t = text.trimStart();
  if (t.startsWith("@")) return t;
  const target = config.agents.find((a) => new RegExp(`^${a.name}\\s*[:,]`, "i").test(t));
  return target ? `@${t}` : t;
}

async function outbound() {
  const res = await kylon("history", "recent", "--room", "all", "--since", state.since, "--limit", "50");
  const msgs = (res.details?.messages ?? []).slice().reverse(); // oldest first
  for (const m of msgs) {
    if (m.senderType !== "agent" || state.relayed.includes(m.id) || !OUTBOUND.test(m.content)) continue;
    const agent = kylonAgents.find((a) => a.name === m.senderName);
    if (!agent) continue;
    // Each message is handled on its own, so one bad message can never block the ones after it.
    state.relayed.push(m.id);
    try {
      await sendAs(agent.name, addressed(m.content.replace(OUTBOUND, "")), config);
      console.log(`${new Date().toISOString()}  Kylon → BAND  ${agent.name} (#${m.roomName})`);
    } catch (err) {
      console.error(`${new Date().toISOString()}  undeliverable from ${agent.name}: ${err.message}`);
      await kylon(
        "message", "send", "--room", m.roomId, "--mentions", agent.kylonId,
        "--text", `⚠️ @${agent.kylonId} the BAND relay couldn't deliver your message (${err.message.slice(0, 120)}). ` +
          "Resend it as a root message starting `BAND → @Name:` with a BAND room member: " +
          config.agents.map((a) => a.name).join(", ") + ".",
      ).catch(() => {});
    }
  }
  state.relayed = state.relayed.slice(-500);
  saveState();
}

async function pass() {
  try {
    await inbound();
    await outbound();
  } catch (err) {
    console.error(`${new Date().toISOString()}  relay error: ${err.message}`);
  }
}

if (!config.room.id) throw new Error("Run ops/band/setup.mjs first");
await pass();
if (!process.argv.includes("--once")) {
  console.log(`BAND relay running for "${config.room.title}" (Ctrl-C to stop)`);
  setInterval(pass, 10_000);
}
