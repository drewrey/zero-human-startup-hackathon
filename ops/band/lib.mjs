// Shared helpers for the BAND integration: BAND REST calls, the Kylon CLI, config, and secrets.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const ROOT = path.resolve(import.meta.dirname, "../..");
const ENV_FILE = path.join(ROOT, ".env.local");
const CONFIG_FILE = path.join(import.meta.dirname, "agents.json");
const KYLON = path.join(os.homedir(), ".kylon/bin/kylon");
export const BAND_API = process.env.BAND_API_URL ?? "https://api.band.ai/api/v1";

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  // No .env.local: callers fail with a clear message when a key is missing.
}

export const loadConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
export const saveConfig = (c) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2) + "\n");

const keyVar = (name) => `BAND_KEY_${name.toUpperCase().replace(/\W/g, "_")}`;

export function agentKey(name) {
  const key = process.env[keyVar(name)];
  if (!key) throw new Error(`${keyVar(name)} is not set in .env.local (run ops/band/setup.mjs)`);
  return key;
}

/** Store a secret in the git-ignored .env.local without ever printing it. */
export function saveAgentKey(name, value) {
  fs.appendFileSync(ENV_FILE, `\n${keyVar(name)}=${value}\n`);
  process.env[keyVar(name)] = value;
}

/** BAND REST call. Defaults to the founder's Human API key; pass `key` to act as an agent. */
export async function band(method, p, { key = process.env.BAND_API_KEY, body } = {}) {
  if (!key) throw new Error("BAND_API_KEY is not set in .env.local");
  const res = await fetch(BAND_API + p, {
    method,
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`BAND ${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  const json = text ? JSON.parse(text) : null;
  return json?.data ?? json;
}

/** Room participants as seen by an agent: [{id, name, handle, type}]. */
export const participants = (roomId, key) => band("GET", `/agent/chats/${roomId}/participants`, { key });

/**
 * Send `text` into the room as `agentName`. "@Name" tokens that match a room participant become
 * real BAND mentions (BAND only delivers a message to the agents it mentions).
 */
export async function sendAs(agentName, text, config = loadConfig()) {
  const key = agentKey(agentName);
  const roomId = config.room.id;
  const people = await participants(roomId, key);
  const mentions = [];
  const escape = (x) => x.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  let content = text;
  // Longest names first so "@Drewrey Lupton" wins over "@Drewrey"; handles and short handles too.
  const aliases = people
    .flatMap((p) => [p.name, p.handle, p.handle?.split("/").pop()].filter(Boolean).map((alias) => ({ alias, p })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, p } of aliases) {
    const re = new RegExp(`@${escape(alias)}(?![\\w/-])`, "gi");
    if (!re.test(content)) continue;
    content = content.replace(re, `\u0000${p.id}\u0000`);
    if (!mentions.some((m) => m.id === p.id)) mentions.push({ id: p.id, handle: p.handle, name: p.name });
  }
  const byId = new Map(mentions.map((m) => [m.id, m]));
  content = content.replace(/\u0000([\w-]+)\u0000/g, (_, id) => `@${byId.get(id).handle ?? byId.get(id).name}`);
  if (mentions.length === 0) throw new Error(`No @mention of a room participant in: ${text.slice(0, 80)}`);
  return band("POST", `/agent/chats/${roomId}/messages`, { key, body: { message: { content, mentions } } });
}

/** Pull this agent's next unprocessed message (or null), marking it as processing. */
export async function nextMessage(agentName, config = loadConfig()) {
  const key = agentKey(agentName);
  const roomId = config.room.id;
  const msg = await band("GET", `/agent/chats/${roomId}/messages/next`, { key });
  if (!msg) return null;
  await band("POST", `/agent/chats/${roomId}/messages/${msg.id}/processing`, { key });
  return msg;
}

export const markProcessed = (agentName, msgId, config = loadConfig()) =>
  band("POST", `/agent/chats/${config.room.id}/messages/${msgId}/processed`, { key: agentKey(agentName) });

/** Run a `kylon workspace ...` command and parse its JSON output. */
export async function kylon(...args) {
  const { stdout } = await exec(KYLON, ["workspace", ...args, "--json"], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}
