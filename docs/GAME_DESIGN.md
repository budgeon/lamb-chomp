# Game design

## Pitch

Each level is a small fenced pasture. Swipe to send a sheep running; it eats every grass tile it crosses and stops when something blocks it. Clear the field in as few runs as you can.

One-thumb play, no timers. The puzzle is the order and direction of the swipes.

## Components in v1

| Component | Level char | Behaviour |
|---|---|---|
| Bare soil | `.` | Nothing to eat. Sheep pass over it. |
| Grass | `g` | Eaten in one pass, becomes soil. |
| Tall grass | `G` | First pass makes it grass, second pass clears it. |
| Rock | `#` | Stops a run. The sheep halts on the cell before it. |
| Mud | `m` | The sheep stops on the mud cell the moment it enters. |
| Flowerbed | `f` | Entering it fails the field. Plan around it. |
| Sheep | `S` | Starts on soil. One or two per field. Sheep block each other. |

The board edge is a fence and stops a run like a rock.

## Rules in order

1. The player picks a direction (and a sheep, if there are two).
2. The sheep moves one cell at a time. Before each step: if the next cell is off the board, a rock or another sheep, the run ends.
3. On entering a cell: a flowerbed fails the field and ends the run; grass or tall grass loses one level; mud ends the run.
4. A swipe that moves the sheep zero cells is not a move and is not counted.
5. The field is cleared when no cell has grass left.

## Scoring

- Par is the minimum number of moves, computed by breadth-first search over (sheep positions, grass state).
- Three stars at par or better, two stars within par + 2, one star otherwise.
- The best star result per field is kept.

## Level format

A level is an array of equal-length strings using the characters above, plus its par:

```json
{ "par": 9, "rows": ["ggggGg","g.g#Sg","g.g.Gg","g#g.gg","ggggGg","ggg###"] }
```

Sheep are indexed in scan order (left to right, top to bottom) in the prototype. `tools/gen.js` numbers sheep in the order it placed them, so its printed two-sheep solutions can have the indices swapped relative to the prototype. `tools/check.js` uses prototype order.

## The eight prototype fields

| Field | Size | Introduces | Par |
|---|---|---|---|
| 1 | 5×5 | Sliding and the fence | 5 |
| 2 | 6×6 | Rocks | 8 |
| 3 | 6×6 | Tall grass | 9 |
| 4 | 6×6 | Mud | 9 |
| 5 | 6×6 | Flowerbeds | 10 |
| 6 | 6×6 | Two sheep | 10 |
| 7 | 6×7 | Mud, flowers and tall grass together | 12 |
| 8 | 6×7 | Two sheep and every obstacle | 13 |

All eight came from the generator, not hand design. They are solvable at par but some are less elegant than others. In fields 6 and 8 the par solution leans mostly on one sheep, which undersells the two-sheep idea; hand-tuned levels should force real cooperation.

## How the generator works

1. Place rocks, mud, flowerbeds and sheep at random on an empty grid.
2. Do a random walk of legal slides and mark every crossed cell as grass (cells crossed twice can become tall grass). This guarantees solvability.
3. Solve with BFS for the true par. Keep candidates whose par is in the target range and whose grass coverage is high.
4. For flower levels, keep only candidates where removing the flowers would lower par, so the flowers matter.
5. Greedily turn leftover bare cells into grass where the level stays solvable within the par ceiling.

For the real level pipeline, add a difficulty score (par, number of distinct par solutions, dead-end states) and have a person pick from candidates.

## Feel

Things that worked in the prototype and should survive:

- The sheep gets visibly rounder as it eats.
- Tiles pop as they are eaten, in step with the run.
- A blocked swipe gives a small head-shake instead of nothing.
- Input is buffered by one swipe so fast players are not ignored.

Still to add: chewing animation, haptics on each bite, sound, a satisfying cleared-field finish.

## Ideas parked for after v1

- Regrowing grass (grows back after N moves)
- Gates and pressure plates (one sheep holds a gate for another)
- Wolves and cliffs as fail hazards
- Breeds that only eat one type of grass
- Wool growth and shearing as a cosmetic meta layer (breeds, hats, pasture themes)
- A daily field
- Solver-backed hints, which are also the natural thing to sell or gate behind an ad
