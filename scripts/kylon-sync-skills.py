#!/usr/bin/env python3
"""Publish each agent's role prompt (agents/_shared-context.md + its role file) to Kylon as a skill
and install it on that agent. Re-run after editing any prompt; existing skills are updated in place.

    python3 scripts/kylon-sync-skills.py            # create or update + install
    python3 scripts/kylon-sync-skills.py --dry-run  # write skill folders only
"""
import json, os, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
AGENTS = ROOT / "agents"
cfg = json.loads((AGENTS / "kylon-agents.json").read_text())
dry = "--dry-run" in sys.argv
kylon = os.path.expanduser("~/.kylon/bin/kylon")


def run(*args):
    out = subprocess.run([kylon, "workspace", *args, "--json"], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f"kylon {' '.join(args)} failed:\n{out.stdout}\n{out.stderr}")
    return json.loads(out.stdout)


existing = {} if dry else {
    s.get("slug"): s.get("id") for s in run("skill", "list").get("details", {}).get("skills", [])
}
shared = (AGENTS / "_shared-context.md").read_text()
tmp = pathlib.Path(tempfile.mkdtemp(prefix="kylon-skills-"))

for a in cfg["agents"]:
    slug = f"flipwise-role-{a['name'].lower()}"
    role = (AGENTS / a["role_file"]).read_text()
    body = f"""---
name: {slug}
description: "{a['name']}'s standing role, responsibilities, and operating rules at the startup (secondhand sourcing copilot). Load at the start of every task and whenever deciding what to work on, who to hand off to, how to log work, or how to answer investors."
human_description: "{a['name']}'s role prompt, synced from agents/{a['role_file']} in the repo."
---

You are **{a['name']}**. The company's repo (plan, spec, decisions, code) is {cfg['repo']}.

{shared}

---

{role}
"""
    d = tmp / slug
    d.mkdir()
    (d / "SKILL.md").write_text(body)
    if dry:
        print(f"wrote {d / 'SKILL.md'}")
        continue
    if slug in existing:
        run("skill", "update", existing[slug], "--from", str(d))
        print(f"updated {slug}")
    else:
        res = run("skill", "create", "--slug", slug, "--from", str(d))
        print(f"created {slug}: {res.get('text', '')[:120]}")
    run("skill", "install", slug, "--agent", a["id"])
    print(f"  installed on {a['name']} ({a['id']})")
