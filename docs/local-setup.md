# Local setup and cleanup

Everything this project installed or changed on the founder's Mac (as of Oct 7), and how to remove it.
Nothing here contains secrets; the secret files are listed so you know where they are.

## Tools installed for this project

| What | Where | How to remove |
|---|---|---|
| **Kylon CLI** 0.7.4 | `~/.kylon/` (binary, `env`, `workspace-auth.json` login) + a `# >>> kylon >>>` block in `~/.zshenv` | `kylon auth logout`, `rm -rf ~/.kylon`, delete the block from `~/.zshenv` |
| **AdaL CLI** 1.8.26 | `~/.adal/` (~725 MB), symlink `~/.local/bin/adal`, line `export PATH="$HOME/.adal/bin:$PATH"` in `~/.zshrc` | `rm -rf ~/.adal ~/.local/bin/adal`, delete that line from `~/.zshrc` |
| **InsForge CLI** (via npx) | login in `~/.insforge/` (`config.json`, `credentials.json`); npx cache `~/.npm/_npx/d7c0f92b98ce1c29` | `npx @insforge/cli logout`, `rm -rf ~/.insforge ~/.npm/_npx/d7c0f92b98ce1c29` |
| **RocketRide VS Code extension** | VS Code extensions | uninstall from VS Code's Extensions view |
| **insta CLI** (InstaCloud, via npx; not logged in) | `~/.insta/` (telemetry/update check); npx cache `~/.npm/_npx/0b5c35ede6211da9` | `rm -rf ~/.insta ~/.npm/_npx/0b5c35ede6211da9` |

`create-next-app` also ran through npx; its cache lives in `~/.npm/_npx/` alongside other projects'
(`npm cache clean --force` clears all of it).

## Inside or next to the repo

| What | Where | How to remove |
|---|---|---|
| Forge's git worktree | `~/projects/zero-human-startup-hackathon-forge` | `git worktree remove ../zero-human-startup-hackathon-forge` (from the repo) |
| Git hooks setting (blocks pushes to `main`) | repo-local `git config core.hooksPath .githooks` | `git config --unset core.hooksPath` |
| Node dependencies | `web/node_modules`, `ops/rocketride/node_modules`, the worktree's `web/node_modules` | deleted with the folders |
| Secrets | `.env.local` (BAND keys, Rocket Ride key), `web/.env.local` (Apify, database URL, Kylon proxy) | delete the files, and revoke the keys in each service |
| Run logs | `ops/forge/logs/`, `ops/band/.relay-state.json` | delete |

## Running processes

- **BAND relay** (`node ops/band/relay.mjs`): stop with Ctrl-C, or `pkill -f ops/band/relay.mjs`.

## Already on the machine (used, not installed)

Node 24, npm, `gh` (GitHub CLI), PostgreSQL 17 (Homebrew; used only for a throwaway test database in a
temp folder), Google Chrome, Playwright's cached browsers.

## Accounts and cloud resources (not local)

GitHub repo `drewrey/zero-human-startup-hackathon`; Kylon workspace "Circling Vultures" (4 agents,
4 rooms, 4 skills, 2 apps); BAND agents (Atlas, Scout, Spec, Comp, Forge, Pipeline) and the
"Flipwise Ops" room; InstaCloud project + Postgres; Apify token; Querit, Prelint, Tenki, AdaL accounts.
