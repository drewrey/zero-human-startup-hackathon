// Run Forge (the engineer agent) in AdaL on whatever is waiting in its BAND inbox.
//
//   node ops/forge/run.mjs            handle new BAND requests, if any
//   node ops/forge/run.mjs --dry-run  show the prompt AdaL would get, without running it
//
// Forge works in a separate git worktree (../<repo>-forge) on a fresh origin/main, so its edits never
// collide with the founder's checkout. Its role prompt = agents/_shared-context.md + engineer.md +
// ops/forge/runtime.md (rebuilt every run, so prompt changes merged to main take effect).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { band, loadConfig, markProcessed, nextMessage, participants, agentKey, sendAs, ROOT } from "../band/lib.mjs";

const dryRun = process.argv.includes("--dry-run");
const ADAL = path.join(os.homedir(), ".adal/bin/adal");
const WT = path.join(path.dirname(ROOT), `${path.basename(ROOT)}-forge`);
const LOGS = path.join(import.meta.dirname, "logs");
const git = (...args) => execFileSync("git", args, { cwd: WT, stdio: "pipe" }).toString().trim();
const config = loadConfig();

// 1. Collect requests (marks them "processing" in BAND so they aren't handed out twice).
const people = await participants(config.room.id, agentKey("Forge"));
const requests = [];
if (!dryRun) {
  for (let m = await nextMessage("Forge", config); m; m = await nextMessage("Forge", config)) {
    const from = people.find((p) => p.id === m.sender_id);
    const content = m.content.replace(/@\[\[([\w-]+)\]\]/g, (_, id) => `@${people.find((p) => p.id === id)?.name ?? id}`);
    requests.push({ id: m.id, from: from?.name ?? "someone", content });
  }
  if (requests.length === 0) {
    console.log("No new BAND requests for Forge.");
    process.exit(0);
  }
}

// 2. Fresh worktree on origin/main.
execFileSync("git", ["fetch", "-q", "origin"], { cwd: ROOT });
if (!fs.existsSync(WT)) execFileSync("git", ["worktree", "add", "-q", "--detach", WT, "origin/main"], { cwd: ROOT });
git("switch", "-q", "--detach", "origin/main");
if (!fs.existsSync(path.join(WT, "web/node_modules"))) execFileSync("npm", ["ci", "--silent"], { cwd: path.join(WT, "web"), stdio: "inherit" });

// 3. Role prompt + task.
// Prompts come from the worktree (merged main); fall back to this checkout for files not merged yet.
const read = (p) => fs.readFileSync(fs.existsSync(path.join(WT, p)) ? path.join(WT, p) : path.join(ROOT, p), "utf8");
const role = [read("agents/_shared-context.md"), read("agents/engineer.md")].join("\n\n---\n\n");
const reqText = requests.length
  ? requests.map((r, i) => `### Request ${i + 1} from ${r.from}\n\n${r.content}`).join("\n\n")
  : "_(dry run: no requests pulled)_";
const replyFile = path.join(os.tmpdir(), `forge-replies-${Date.now()}.json`);
const task = read("ops/forge/runtime.md").replaceAll("{{REPLY_FILE}}", replyFile).replace("{{REQUESTS}}", reqText);
const promptFile = path.join(os.tmpdir(), `forge-role-${Date.now()}.md`);
fs.writeFileSync(promptFile, role);

if (dryRun) {
  console.log(`Worktree: ${WT}\nRole prompt: ${promptFile}\n\n${task}`);
  process.exit(0);
}

// 4. Run AdaL headless. It needs full tool permissions for git, gh, and npm, so least privilege is
// enforced outside the agent instead of by asking it nicely:
//   - a clean environment: none of the secrets this script loaded from .env.local are inherited;
//   - a macOS sandbox that denies reading or writing the secret files and other CLIs' logins;
//   - no BAND key: Forge writes its replies to a file and this script sends them afterwards.
const SECRET_PATHS = [
  ["literal", path.join(ROOT, ".env.local")],
  ["literal", path.join(ROOT, "web/.env.local")],
  ["literal", path.join(WT, ".env.local")],
  ["literal", path.join(WT, "web/.env.local")],
  ["subpath", path.join(os.homedir(), ".kylon")],
  ["subpath", path.join(os.homedir(), ".insforge")],
];
const sandbox = `(version 1)(allow default)(deny file-read* file-write* ${SECRET_PATHS.map(([k, p]) => `(${k} ${JSON.stringify(p)})`).join(" ")})`;
const ENV_ALLOW = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TERM", "TMPDIR", "SSH_AUTH_SOCK"];
const env = Object.fromEntries(ENV_ALLOW.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));

fs.mkdirSync(LOGS, { recursive: true });
const log = path.join(LOGS, `${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
console.log(`Forge (AdaL) working on ${requests.length} request(s). Log: ${log}`);
const run = spawnSync("/usr/bin/sandbox-exec", ["-p", sandbox, ADAL, "-q", task, "--prompt-file", promptFile, "--permission-mode", "yolo", "-o", "text"], {
  cwd: WT,
  env,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});
fs.writeFileSync(log, `${run.stdout ?? ""}\n--- stderr ---\n${run.stderr ?? ""}`);

// 5. Send Forge's replies over BAND (this script holds the key, not the agent).
if (fs.existsSync(replyFile)) {
  for (const r of JSON.parse(fs.readFileSync(replyFile, "utf8"))) {
    await sendAs("Forge", `@${r.to} ${r.message}`, config);
    console.log(`Forge → ${r.to} over BAND`);
  }
  fs.rmSync(replyFile);
}

// 6. Close out the BAND messages.
for (const r of requests) {
  if (run.status === 0) await markProcessed("Forge", r.id, config);
  else await band("POST", `/agent/chats/${config.room.id}/messages/${r.id}/failed`, { key: agentKey("Forge") });
}
console.log(run.status === 0 ? "Forge finished." : `Forge exited with status ${run.status}; see ${log}`);
process.exit(run.status ?? 1);
