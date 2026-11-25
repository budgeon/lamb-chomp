# Lamb Chomp

A one-thumb mobile puzzle game. Sheep slide across a small pasture, eat the grass they cross, and the field is cleared when no grass is left.

This file carries the context from the planning session (10–13 Nov 2026) in which the concept, the prototype and the decisions below were made. Read `docs/` before proposing changes to rules or scope.

## Status

- Concept and core rules: settled. The owner played the prototype and said all the mechanics feel good.
- Name: **Lamb Chomp** (decided 13 Nov 2026). Checked 25 Nov 2026; Lamb Chop trademark risk accepted by the owner. See D5.
- Playable prototype: `prototype/index.html`, a single self-contained HTML file with 8 fields.
- Level generator and solver: `tools/gen.js`. Verifier: `tools/check.js`.
- Tech stack for the real build: **React Native + Expo (TypeScript)**. See D4 in `docs/DECISIONS.md`.
- Monetization: free, ad-light (rewarded hint ads only), coins earned by play and spent on cosmetics, optional coin packs and remove-ads. See D6.

## Core rules (do not change without asking)

- The board is a grid. A swipe sends the selected sheep running in that direction until the next cell is a rock, the fence (board edge) or another sheep.
- Every cell the sheep enters is grazed: grass becomes bare soil, tall grass becomes grass. Tall grass therefore needs two passes.
- Mud stops the sheep on the cell it enters. Mud is not grass and never changes.
- Entering a flowerbed fails the field. The player must undo or restart.
- Sheep start on bare soil. With two sheep, the player taps one (or starts the swipe on it) to choose it. Sheep block each other.
- The field is cleared when no grass or tall grass remains.
- Par is the true minimum number of moves, found by breadth-first search. Three stars at par, two at par + 2, one otherwise.

The reference implementation of these rules is the `slide()` function in `prototype/index.html` and `tools/gen.js`. They must stay identical in behaviour.

## Layout

```
CLAUDE.md               this file
README.md               how to use this bundle
docs/DECISIONS.md       decision log, including the name
docs/GAME_DESIGN.md     rules, components, level format, parked ideas
docs/MARKET_NOTES.md    market research summary with sources
docs/NEXT_STEPS.md      roadmap to a shippable v1
prototype/index.html    playable prototype (open in a browser)
tools/gen.js            level generator + BFS solver (Node, no dependencies)
tools/check.js          replays stored solutions against the prototype's own rules
tools/levels.json       the 8 generated fields with their pars
```

## Commands

```
node tools/check.js     # every field must report cleared: true at par
node tools/gen.js       # regenerates candidates; takes about 30 seconds
```

`gen.js` is seeded, so it reproduces the same 8 fields. Change the seeds or the `specs` array to get new ones.

## Working agreements

- Keep the rules in one pure module with no rendering or platform code, and cover it with tests. Whatever the stack, port `slide()` first and prove it against `tools/check.js` solutions.
- Every shipped level must be verified solvable by the solver, with par stored alongside it.
- v1 scope is frozen (25 Nov 2026, D2) at: rocks, tall grass, mud, flowerbeds, two sheep, stars against par, undo, restart, ~100 levels, coin economy and cosmetics shop. Regrowing grass, gates and pressure plates, wolves, cliffs and herding are parked for later updates.
- The prototype's visual direction (deep spruce page, fenced paddock, buttery yellow accent, sheep that get rounder as they eat) was liked but is not a final art style.
- Explain game-engine specifics, not general programming.
