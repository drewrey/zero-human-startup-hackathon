// One-time (idempotent) BAND setup: register an External Agent per agent system, create the
// "Flipwise Ops" room, and add every agent. Keys go to .env.local; ids go to agents.json.
import { agentKey, band, loadConfig, saveAgentKey, saveConfig } from "./lib.mjs";

const config = loadConfig();
const me = await band("GET", "/me/profile");
console.log(`BAND account: @${me.handle}`);

for (const a of config.agents) {
  let hasKey = true;
  try {
    agentKey(a.name);
  } catch {
    hasKey = false;
  }
  if (a.bandId && hasKey) {
    console.log(`= ${a.name} already registered (${a.bandId})`);
    continue;
  }
  const res = await band("POST", "/me/agents/register", { body: { agent: { name: a.name, description: a.description } } });
  a.bandId = res.agent.id;
  saveAgentKey(a.name, res.credentials.api_key);
  saveConfig(config);
  console.log(`+ registered ${a.name} (${a.bandId}); key saved to .env.local`);
}

if (!config.room.id) {
  const room = await band("POST", "/me/chats", { body: { chat: { title: config.room.title } } });
  config.room.id = room.id;
  saveConfig(config);
  console.log(`+ created room "${config.room.title}" (${room.id})`);
}

const present = new Set((await band("GET", `/me/chats/${config.room.id}/participants`)).map((p) => p.id));
for (const a of config.agents) {
  if (present.has(a.bandId)) continue;
  await band("POST", `/me/chats/${config.room.id}/participants`, {
    body: { participant: { participant_id: a.bandId, role: "member" } },
  });
  console.log(`+ added ${a.name} to the room`);
}
console.log("BAND setup complete.");
