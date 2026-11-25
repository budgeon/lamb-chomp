---
name: new-levels
description: Produce new Lamb Chomp levels (brief, generate candidates, solver-verify and score, owner hand-picks, level gate, verify, review, PR). Run with /new-levels <brief>, e.g. "/new-levels world 3 mud, 18 levels", or /new-levels resume <slug>.
argument-hint: <brief> | resume <slug>
disable-model-invocation: true
---

# New Levels

Brief: $ARGUMENTS

You are the orchestrator. The `level-designer` subagent generates and scores; the owner picks. Levels are content the owner curates, so nothing lands in `src/game/levels/` without their pick.

## Graph

```text
Setup → Brief → [confirm] → Generate → Score + shortlist → [owner picks] → Write levels → Verify → Review → [approve] → PR → stop
                                ↑              │
                                └── too few ───┘ (max 2 regenerations)
```

## Nodes

### 1. Setup

As `/deliver-feature` Setup, with branch `feature/levels-<slug>` in `~/Projects/lamb-chomp-worktrees/<slug>`. State lives in `.delivery/` (`state.md`, `brief.md`, `candidates/`, `shortlist.md`).

### 2. Brief

Turn the request into `.delivery/brief.md` and confirm it with the owner:

- World number and the one component it introduces (D2: worlds of 15–20 levels, one new component each). Earlier components may appear; later ones may not.
- Level count, board sizes, sheep count, and a par range rising across the world. First levels teach the new component in isolation.
- Which existing levels the new ones sit between, and any ids that must not change (shipped levels carry players' stars).

### 3. Generate (`level-designer`)

It runs the project's generator (the TS successor of `tools/gen.js` if one exists under `scripts/`, else a copy of `tools/gen.js` with new seeds and `specs` in `.delivery/`) and writes candidates to `.delivery/candidates/`. Aim for at least 3× the requested count. It never edits `tools/gen.js` in place or writes to `src/` at this step.

### 4. Score and shortlist (`level-designer`)

For each candidate: BFS par (must be the true minimum), number of distinct par solutions, dead-end states reachable, grass coverage, and whether the component matters (removing flowerbeds or mud changes par; in two-sheep levels, every par solution moves both sheep meaningfully). It drops failures and writes `.delivery/shortlist.md`: about 2× the count, ordered by suggested position, each with an ASCII board, par, scores, one par solution in prototype sheep order, and a one-line note on what it teaches.

If fewer viable candidates than the count survive, regenerate with adjusted specs (at most twice), then ask the owner.

### 5. Owner picks

**Gate:** present the shortlist. The owner picks, orders, and may ask for tweaks (moving a rock, removing a tile). Any tweak is re-solved for its new par before it is accepted. Record picks in `state.md`.

### 6. Write levels (`level-designer`)

It writes the picked levels into `src/game/levels/` in the existing format, with stored par, then runs `npm run gate:levels` and `npm run gate`. Commit on the branch.

### 7. Verify (`feature-verifier`) and Review (`feature-reviewer`)

Same rules as `/deliver-feature`: the subagents do this, never you, and the PR hook checks their `Overall: PASS` / `Verdict: APPROVE` / `Commit:` lines. Acceptance source is `brief.md` plus the owner's picks in `state.md`. The verifier also screenshots the first new level and the world's last level on both simulators. The reviewer checks that shipped levels were not changed, every par is the true minimum, and order matches the picks.

### 8. PR

**Gate:** show the picked levels, `gate.json`, evidence, and review. After approval, push and `gh pr create`, then stop.

## Rules

- Never ship a level the solver did not verify, or store a par other than the true minimum.
- Never change a shipped level's layout or id without explicit owner approval.
- Core rules in `CLAUDE.md` are not up for change here. A level idea that needs a new rule or a parked component (D2) goes back to the owner as a note.
- Retry limits as in `/deliver-feature`: 2 Verify loops, 2 Review loops.
