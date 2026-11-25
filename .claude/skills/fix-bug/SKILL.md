---
name: fix-bug
description: Fix a Lamb Chomp bug through a gated graph (reproduce, failing test, root cause, risk gate, fix, verify, independent review, PR) using focused subagents. Run with /fix-bug <bug report>, or /fix-bug resume <slug>.
argument-hint: <bug report> | resume <slug>
disable-model-invocation: true
---

# Fix Bug

Report: $ARGUMENTS

You are the orchestrator. You own the graph state, the worktree, simulators and Metro, and the conversation with the user. Each subagent starts with no memory of this conversation, so pass it the worktree and report paths.

## Graph

```text
Setup → Reproduce + root cause → [risk gate] → Fix → Verify → Review → [approve] → PR → stop
              │                                 ↑       │        │
              └─ not reproduced → ask user      └─ FAIL ┴─ important
                                     wrong diagnosis → Reproduce
```

Reproduction comes first: a fix for a bug nobody observed cannot be proved. The test that fails before the fix and passes after is the core evidence.

## Gates are enforced

The same rules as `/deliver-feature` apply (read its "Verify and Review are not yours to do" section): Verify MUST be done by `feature-verifier`, Review MUST be done by a fresh `feature-reviewer`, and you never write `verify.md` or `review.md` yourself. A hook blocks `gh pr create` unless `verify.md` has `Overall: PASS`, `review.md` has `Verdict: APPROVE`, both have `Commit: <HEAD sha>`, and the tree is clean. Any new commit after Verify or Review means running both again.

## State

`<worktree>/.delivery/` (git-ignored): `state.md` (node, flags, retry counts, environment, `## Known issues`), `bug.md`, `verify.md`, `review.md`, `review-<n>.md`, `gate.json`, `evidence/`.

For `resume <slug>`, read `~/Projects/lamb-chomp-worktrees/<slug>/.delivery/state.md` and continue from its node.

## Nodes

### 1. Setup

1. Confirm the main checkout is clean; `git fetch origin`.
2. Pick a short kebab-case slug.
3. `git worktree add -b fix/<slug> ~/Projects/lamb-chomp-worktrees/<slug> origin/main`
4. `npm ci`, create `.delivery/state.md`.
5. Run the preflight in `../deliver-feature/references/native-verification.md`.

If the report is about one level being unsolvable, too easy, or having the wrong par, the bug may be level data: still use this workflow, but expect the fix in `src/game/levels/` and `npm run gate:levels` to be the regression check.

### 2. Reproduce and diagnose (`bug-investigator`)

It reproduces on unmodified code (Jest for rules, Maestro on the simulator for anything visual, gestural, or persisted), adds the smallest failing regression test, finds the root cause, sets impact flags, and writes `.delivery/bug.md`.

- `REPRODUCED`: continue.
- `NOT REPRODUCED`: stop; show the user what was tried and the one piece of information that would help most. No speculative fixes.
- `NOT A BUG`: explain the evidence and stop.

### 3. Risk gate

Pause for approval when the flags include `save`, `economy`, or `native`, when the fix would change a core rule or intended behavior, or when scope grows beyond the root cause. Show the root cause, proposed fix, and risk. Otherwise continue; the PR gate still protects `main`.

### 4. Fix (`bug-fixer`)

Smallest correct change to the root cause; the regression test passes. It proves each guarding test by removing the fix, seeing the test fail, and restoring exactly. Then commit on `fix/<slug>` (local only) so Verify can pin a sha.

### 5. Verify (`feature-verifier`)

Tell it this is a bug run, so `bug.md` is the acceptance source. It confirms the original reproduction no longer occurs, the regression test passes, and the checks in `native-verification.md` pass. Give it the sha, simulator UDIDs, and after a loop, the changed files.

- `Overall: PASS`: Review.
- `Overall: FAIL`: back to Fix.
- Only `PRE-EXISTING`: add to Known issues, go to Review.
- `Overall: BLOCKED`: stop and ask the user.

### 6. Review (`feature-reviewer`)

Archive the previous `review.md` as `review-<n>.md`, then a fresh reviewer with `bug.md` as the source of truth. Same severity rule as `/deliver-feature`.

- `Verdict: APPROVE`: PR gate.
- `important` findings routed `fix`: Fix → commit → Verify → fresh Review.
- Routed `reproduce` (wrong diagnosis): back to Reproduce.

### 7. PR

**Gate:** show the root cause, diff summary, before-and-after evidence, `gate.json`, review verdict, `MANUAL` checks, Known issues, and release notes (JS-only or needs a native build). Wait for approval.

After approval, confirm a clean tree and matching `Commit:` lines, push `fix/<slug>`, `gh pr create` into `main` (symptom, root cause, fix, evidence, risks, Known issues; follow the repository's attribution instructions). Report the URL and CI status, then stop.

## Known issues

As in `/deliver-feature`: record unfixed problems in `state.md`, offer to file them as issues at the PR gate (only with approval), and list them in the PR body.

## Retry limits

**2** Verify-to-Fix loops, **2** Review-to-Fix loops, **1** return to Reproduce. At a limit, or when a failure repeats, stop with the evidence and a recommendation.

## Rules

- Never merge, force-push, publish an EAS build, or submit to a store.
- Never weaken, skip, or delete a test to get a pass.
- Fix the cause, not the symptom. A deliberate mitigation is labeled as one at the PR gate.
- Report checks that did not run as `NOT RUN`.
