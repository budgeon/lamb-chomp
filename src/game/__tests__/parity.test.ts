/// <reference types="jest" />
/// <reference types="node" />
/**
 * Anti-drift gate: the prototype's own slide()/parse() (extracted from
 * prototype/index.html and run in a node vm sandbox) and this module must
 * agree on every step of thousands of random move sequences on all 8 fields.
 */
import * as fc from 'fast-check';

import { loadPrototype } from '../__testutils__/prototype';
import { DIRS, LEVELS, isCleared, parseLevel, slide } from '../index';
import type { Dir, State } from '../index';

const proto = loadPrototype();

interface Snap {
  grass: number[];
  sheep: number[];
  moves: number;
  failed: boolean;
  won: boolean;
  moved: boolean;
}

const snap = (s: State, moved: boolean): Snap => ({
  grass: [...s.grass],
  sheep: [...s.sheep],
  moves: s.moves,
  failed: s.failed,
  won: isCleared(s),
  moved,
});

function runModule(levelIndex: number, moves: [number, Dir][], undoOnFail: boolean): Snap[] {
  const out: Snap[] = [];
  const history: State[] = [];
  let s = parseLevel(LEVELS[levelIndex]);
  for (const [i, d] of moves) {
    const r = slide(s, i, d);
    if (r.moved) history.push(s);
    s = r.state;
    out.push(snap(s, r.moved));
    if (undoOnFail && s.failed) {
      s = history.pop()!;
      out.push(snap(s, false));
    }
  }
  return out;
}

const moveSeq = (sheepCount: number) =>
  fc.array(fc.tuple(fc.integer({ min: 0, max: sheepCount - 1 }), fc.constantFrom<Dir>(...DIRS)), {
    minLength: 1,
    maxLength: 60,
  });

describe('parity with prototype/index.html', () => {
  it('extracts the 8 prototype fields', () => {
    expect(proto.LEVELS).toHaveLength(8);
  });

  LEVELS.forEach((level, li) => {
    const sheepCount = parseLevel(level).sheep.length;
    it.each([false, true])(`${level.id} (${sheepCount} sheep) undoOnFail=%s`, (undoOnFail) => {
      fc.assert(
        fc.property(moveSeq(sheepCount), (moves) => {
          expect(runModule(li, moves, undoOnFail)).toEqual(proto.run(li, moves, undoOnFail));
        }),
        { numRuns: 300 },
      );
    });
  });
});
