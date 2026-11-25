---
name: deliver-feature
description: Deliver a Lamb Chomp feature through a gated graph (spec, impact routing, plan, implement, verify, review, PR) using focused subagents. Run with /deliver-feature <feature request>, or /deliver-feature resume <slug>.
argument-hint: <feature request> | resume <slug>
disable-model-invocation: true
---

# Deliver Feature

Request: $ARGUMENTS

You are the orchestrator. You own the graph state, the worktree, the simulators and Metro processes, and the conversation with the user. Subagents do the specialist work. Each starts with no memory of this conversation, so pass it the worktree path and the files it needs.

## Graph

```text
Setup → Spec → [approve] → Plan → Implement → Verify → Review → [approve] → PR → stop
                             ↑        ↑          │        │
                             │        ├─ FAIL ───┘        │
                             │        └─ important code ──┤
                             └──── design/spec finding ───┘ (spec wrong → user)
```

Merging is outside the graph. The user merges.

## Verify and Review are not yours to do

Verify MUST be done by the `feature-verifier` subagent and Review MUST be done by a fresh `feature-reviewer` subagent. Never write, edit, or "fix up" `verify.md` or `review.md` yourself, and never summarize your own test run as verification. A previous run skipped the verifier and that is the failure this rule exists to stop.

The gates are mechanical:

- `npm run gate` runs typecheck, lint, Jest, the level gate, and the economy gate, and writes `.delivery/gate.json`. The verifier runs it.
- A PreToolUse hook blocks `gh pr create` unless `.delivery/verify.md` contains `Overall: PASS`, `.delivery/review.md` contains `Verdict: APPROVE`, both contain `Commit: <full HEAD sha>` matching current `HEAD`, and the working tree is clean.

So the code must be committed before Verify. Any new commit after Verify or Review (a fix, a rebase, a typo) makes both stale: run Verify and a fresh Review again. Do not try to get around the hook.

## State

Keep run state in `<worktree>/.delivery/` (git-ignored):

- `state.md`: current node, impact flags, retry counts, decisions, environment (simulators, Metro port and PID), `## Known issues`
- `spec.md`, `plan.md`, `verify.md`, `review.md`, archived `review-<n>.md`
- `gate.json`, `evidence/` (screenshots, Maestro output, logs)

Update `state.md` after every transition. For `resume <slug>`, read `~/Projects/lamb-chomp-worktrees/<slug>/.delivery/state.md`, check `git log -1` against any `Commit:` lines, and continue from the recorded node.

## Nodes

### 1. Setup

1. Confirm the main checkout is clean and run `git fetch origin`.
2. Pick a short kebab-case slug.
3. `git worktree add -b feature/<slug> ~/Projects/lamb-chomp-worktrees/<slug> origin/main`
4. `npm ci` in the worktree, then create `.delivery/state.md`.
5. Run the environment preflight in `references/native-verification.md` (Xcode, Maestro, run simulators, Metro port).

Worktrees keep parallel runs and the user's checkout apart. Keep them outside `~/Documents` (iCloud eviction corrupts git).

### 2. Spec (`feature-spec`)

It writes `.delivery/spec.md` with acceptance criteria and impact flags from `references/lambchomp-risks.md`. Show the user a short summary, the ACs, the flags, any layout options, and open questions.

**Gate:** wait for approval or amendments. Skip only when all hold: the only flag is `ui`, and the user asked for a non-stop run. If `rules` is flagged and the change alters a core rule in `CLAUDE.md`, the owner must approve explicitly even in a non-stop run.

### 3. Plan (`feature-planner`)

It writes `.delivery/plan.md`: ordered tasks with files, dependencies, tests, and the checks each flag requires. Record the routing in `state.md`.

### 4. Implement (`feature-implementer`)

One implementer per task in dependency order. Run tasks in parallel only when the plan marks them `parallel_safe` and files do not overlap. When all tasks are done, run `npm run typecheck` as a sanity check, then commit on `feature/<slug>` (local only, no push) so Verify and Review have a sha to pin.

### 5. Verify (`feature-verifier`)

Before it starts, have a stable Release build ready on the run's simulators (see `references/native-verification.md`) and give it the sha, simulator UDIDs, and, after a fix loop, the files changed since the last verify.

- `Overall: PASS`: go to Review.
- `Overall: FAIL`: send the failures to an implementer, commit, verify again.
- Only `PRE-EXISTING` failures: add them to Known issues and go to Review. Ask the user only if fixing one is needed for the feature to work.
- `Overall: BLOCKED`: stop and ask the user. A missing tool or broken environment is not a code problem.

### 6. Review (`feature-reviewer`)

Archive any earlier `review.md` as `review-<n>.md` first. Spawn a fresh reviewer that did not write the code.

**Severity rule:** `important` means a defect this change introduces or makes materially worse, or an unmet AC, with a concrete reachable scenario. Untouched defects that exist the same way on `origin/main` are `pre-existing`: add them to Known issues.

- `Verdict: APPROVE` (zero `important` findings): go to the PR gate.
- `important` findings routed `implement`: Implement → commit → Verify → fresh Review.
- Findings routed `plan` or `spec`: back to Plan, or to the user if the spec itself is wrong.

### 7. PR

**Gate:** show the user the diff summary, `gate.json` result, verification evidence with screenshot paths, the review verdict, any `MANUAL` checks with steps, Known issues, and release notes (EAS build or store steps if `native`). Wait for approval.

After approval, confirm the tree is clean and `HEAD` matches both `Commit:` lines, push `feature/<slug>`, and run `gh pr create` into `main`. The PR body covers summary, acceptance evidence, risks, Known issues, and release steps, and follows the repository's attribution instructions. Report the PR URL and CI status, then stop.

## Known issues

Keep `## Known issues` in `state.md` for problems found but not fixed: `PRE-EXISTING` failures and out-of-scope findings. For each: what happens, how it was found, reproduced or only read in code. At the PR gate, list them and offer to file each as a GitHub issue (only with approval). List them in the PR body either way, because `.delivery/` dies with the worktree.

## Retry limits

**2** Verify-to-Implement loops and **2** Review-to-Implement loops per run. At a limit, or when the same failure repeats, stop and give the user the evidence and a recommendation.

## Rules

- Never merge, force-push, publish an EAS build, or submit to a store from this workflow.
- Never weaken, skip, or delete a test to get a pass. A test that is truly wrong needs a reason in `state.md` and a mention at the PR gate.
- Every new guarding test is proved: remove the code it protects, see it fail, restore exactly.
- Report checks that did not run as `NOT RUN`, never as passed.
- At cleanup (after the user merges or abandons), stop Metro, delete the run's simulators, and remove the worktree and any base worktree.
