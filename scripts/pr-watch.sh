#!/usr/bin/env bash
# Watch a PR's review cycle: wait for CI checks, wait for a review (Prelint, Tenki, or a human),
# then print checks, reviews, inline comments, and conversation so the author can respond.
#
#   scripts/pr-watch.sh                 PR for the current branch, wait up to 15 min for a review
#   scripts/pr-watch.sh 12 --wait 30    PR #12, wait up to 30 min
set -uo pipefail

pr="${1:-}"
[[ "$pr" == --* || -z "$pr" ]] && pr="$(gh pr view --json number -q .number)" || shift
wait_min=15
[[ "${1:-}" == "--wait" ]] && wait_min="${2:-15}"

author="$(gh pr view "$pr" --json author -q .author.login)"
echo "PR #$pr by $author: $(gh pr view "$pr" --json url -q .url)"

echo "⏳ Waiting for checks…"
if ! gh pr checks "$pr" --watch --interval 20 >/dev/null 2>&1; then
  echo "(checks failed or none reported yet)"
fi

count_feedback() {
  local reviews comments inline
  reviews=$(gh pr view "$pr" --json reviews -q "[.reviews[] | select(.author.login != \"$author\")] | length")
  comments=$(gh pr view "$pr" --json comments -q "[.comments[] | select(.author.login != \"$author\")] | length")
  inline=$(gh api "repos/{owner}/{repo}/pulls/$pr/comments" -q "[.[] | select(.user.login != \"$author\")] | length")
  echo $((reviews + comments + inline))
}

echo "⏳ Waiting up to ${wait_min} min for review feedback…"
deadline=$(( $(date +%s) + wait_min * 60 ))
while (( $(count_feedback) == 0 && $(date +%s) < deadline )); do sleep 30; done

echo; echo "== Checks";        gh pr checks "$pr" 2>/dev/null || echo "(none)"
echo; echo "== Reviews";       gh pr view "$pr" --json reviews -q '.reviews[] | "[\(.state)] \(.author.login): \(.body)"'
echo; echo "== Inline comments"; gh api "repos/{owner}/{repo}/pulls/$pr/comments" -q '.[] | "\(.user.login) on \(.path):\(.line // .original_line):\n  \(.body)\n"'
echo; echo "== Conversation";  gh pr view "$pr" --json comments -q '.comments[] | "\(.author.login): \(.body)\n"'
echo; echo "Review state: $(gh pr view "$pr" --json reviewDecision,mergeStateStatus -q '"\(.reviewDecision // "none") / \(.mergeStateStatus)"')"
