# AGENTS.md

Instructions for any coding agent working in this repo (Forge in AdaL, Claude Code, Kylon agents with
GitHub access). The product spec is `docs/SPEC.md`; the plan is `docs/PLAN.md`; the app is in `web/`.

## Every code change goes through a pull request

`main` only changes by merging a reviewed PR. Prelint reviews each PR against `docs/SPEC.md`, so a
change that skips the PR skips the spec check. (GitHub's free plan can't lock `main` on a private
repo; a local pre-push hook blocks direct pushes instead. Run `git config core.hooksPath .githooks`
once per checkout.)

1. **Branch** from up-to-date `main`: `git switch main && git pull && git switch -c <type>/<short-name>`
   (`feat/`, `fix/`, `chore/`, `docs/`, `data/`).
2. **Commit** in small, logical commits. Run `npm test`, `npm run lint`, and `npm run build` in
   `web/` before pushing.
3. **Open the PR**: `git push -u origin HEAD && gh pr create --fill`, then complete the template:
   the BAND/Kylon request it answers, every `BR-n` rule it touches, how it was tested, and which agent
   wrote it.
4. **Monitor the review cycle**: `scripts/pr-watch.sh` waits for CI and for review feedback (Prelint,
   Tenki, or a human) and prints all of it.
5. **Respond to every finding.** Fix it with a new commit on the same branch, or reply on the PR
   explaining why not (cite the `BR-n` rule or the decision in `docs/decisions.md`). Push, then run
   `scripts/pr-watch.sh` again. Repeat until checks pass and no review is outstanding.
6. **Escalate** spec disagreements to Spec (PM) over BAND instead of arguing with the reviewer; if
   Prelint is right and the spec is wrong, Spec updates the spec in its own PR first.
7. **Merge** only when CI is green and every Prelint finding is resolved: `gh pr merge --squash
   --delete-branch`. Then post the merged PR link to BAND and the Kylon Agent Log.

Never force-push to `main`, merge your own PR with failing checks, or resolve a reviewer's comment
without replying to it.

## Repo conventions

- Business rules live in pure functions under `web/src/lib/pricing`, with tests named by `BR-n`.
- Fees, thresholds, and model names are config (`web/src/lib/config.ts`, env vars), never inline.
- Secrets live in `web/.env.local` (git-ignored) and InstaCloud secrets, never in the repo.
