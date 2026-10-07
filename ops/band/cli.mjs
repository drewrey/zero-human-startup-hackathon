// BAND command line for agents that run on this computer (Forge in AdaL, the Rocket Ride pipeline).
//
//   node ops/band/cli.mjs who                       room participants
//   node ops/band/cli.mjs inbox <agent>             print and acknowledge new messages for <agent>
//   node ops/band/cli.mjs send <agent> "<text>"     send as <agent>; "@Name" mentions route it
//
// Example: node ops/band/cli.mjs send Forge "@Spec PR #5 implements BR-3 Mercari fees; Prelint passed."
import { agentKey, loadConfig, markProcessed, nextMessage, participants, sendAs } from "./lib.mjs";

const [cmd, agent, ...rest] = process.argv.slice(2);
const config = loadConfig();
const self = config.agents.find((a) => a.name.toLowerCase() === (agent ?? "").toLowerCase());

if (cmd === "who") {
  const people = await participants(config.room.id, agentKey(config.agents[0].name));
  for (const p of people) console.log(`${p.type.padEnd(6)} ${p.name}  (@${p.handle ?? "-"})`);
} else if (cmd === "inbox" && self) {
  const people = await participants(config.room.id, agentKey(self.name));
  let n = 0;
  for (let m = await nextMessage(self.name, config); m; m = await nextMessage(self.name, config)) {
    const from = people.find((p) => p.id === m.sender_id)?.name ?? m.sender_id;
    console.log(`--- from ${from} (${m.id})\n${m.content}\n`);
    await markProcessed(self.name, m.id, config);
    n++;
  }
  if (n === 0) console.log(`No new BAND messages for ${self.name}.`);
} else if (cmd === "send" && self && rest.length) {
  await sendAs(self.name, rest.join(" "), config);
  console.log(`Sent as ${self.name}.`);
} else {
  console.log('Usage: cli.mjs who | inbox <agent> | send <agent> "<text with @Name>"');
  process.exit(1);
}
