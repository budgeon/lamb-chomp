/// <reference types="jest" />
/// <reference types="node" />
import * as fc from 'fast-check';

import { DIRS, LEVELS, grassRemaining, isCleared, parseLevel, slide } from '../index';
import type { Dir, State } from '../index';

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

const scenario = fc.record({
  level: fc.integer({ min: 0, max: LEVELS.length - 1 }),
  moves: fc.array(fc.tuple(fc.integer({ min: 0, max: 1 }), fc.constantFrom<Dir>(...DIRS)), {
    maxLength: 50,
  }),
});

/** Plays moves, undoing any trample so runs go deep. Sheep index is taken mod sheep count. */
function play(level: number, moves: [number, Dir][], visit: (before: State, i: number, d: Dir) => void) {
  let s = parseLevel(LEVELS[level]);
  for (const [raw, d] of moves) {
    const i = raw % s.sheep.length;
    visit(s, i, d);
    const r = slide(s, i, d);
    s = r.failed ? s : r.state;
  }
}

const RUNS = { numRuns: 500 };

describe('rules properties', () => {
  it('slide never mutates its input', () => {
    fc.assert(
      fc.property(scenario, ({ level, moves }) => {
        play(level, moves, (s, i, d) => {
          const copy = JSON.stringify(s);
          deepFreeze(s); // any write would throw in strict mode
          slide(s, i, d);
          expect(JSON.stringify(s)).toBe(copy);
        });
      }),
      RUNS,
    );
  });

  it('grassRemaining never increases and moves count only real moves', () => {
    fc.assert(
      fc.property(scenario, ({ level, moves }) => {
        play(level, moves, (s, i, d) => {
          const r = slide(s, i, d);
          expect(grassRemaining(r.state)).toBeLessThanOrEqual(grassRemaining(s));
          expect(r.state.moves).toBe(s.moves + (r.moved ? 1 : 0));
        });
      }),
      RUNS,
    );
  });

  it('sheep stay in bounds, off rocks, off flowers unless failed, and never overlap', () => {
    fc.assert(
      fc.property(scenario, ({ level, moves }) => {
        play(level, moves, (s, i, d) => {
          const { state: n } = slide(s, i, d);
          const size = n.width * n.height;
          for (const p of n.sheep) {
            expect(Number.isInteger(p) && p >= 0 && p < size).toBe(true);
            expect(n.cells[p]).not.toBe('#');
            if (n.cells[p] === 'f') expect(n.failed).toBe(true);
          }
          expect(new Set(n.sheep).size).toBe(n.sheep.length);
          if (n.failed) expect(n.cells[n.trampled]).toBe('f');
        });
      }),
      RUNS,
    );
  });

  it('a non-move returns moved=false and the same state', () => {
    fc.assert(
      fc.property(scenario, ({ level, moves }) => {
        play(level, moves, (s, i, d) => {
          const r = slide(s, i, d);
          if (!r.moved) expect(r.state).toBe(s);
          else expect(r.state).not.toEqual(s);
        });
      }),
      RUNS,
    );
  });

  it('failed and cleared states accept no further moves', () => {
    fc.assert(
      fc.property(scenario, ({ level, moves }) => {
        let s = parseLevel(LEVELS[level]);
        for (const [raw, d] of moves) {
          const r = slide(s, raw % s.sheep.length, d);
          if (s.failed || isCleared(s)) {
            expect(r.moved).toBe(false);
            expect(r.state).toBe(s);
          }
          s = r.state;
        }
      }),
      RUNS,
    );
  });

  it('undo model: a history stack of states pops back exactly', () => {
    fc.assert(
      fc.property(scenario, fc.array(fc.boolean(), { maxLength: 50 }), ({ level, moves }, undos) => {
        const start = parseLevel(LEVELS[level]);
        const startJson = JSON.stringify(start);
        const history: State[] = [];
        const snapshots: string[] = [];
        let s = start;
        moves.forEach(([raw, d], k) => {
          if (undos[k] && history.length) {
            const prev = history.pop()!;
            expect(JSON.stringify(prev)).toBe(snapshots.pop());
            s = prev;
            return;
          }
          const r = slide(s, raw % s.sheep.length, d);
          if (r.moved) {
            history.push(s);
            snapshots.push(JSON.stringify(s));
            s = r.state;
          }
        });
        while (history.length) {
          s = history.pop()!;
          expect(JSON.stringify(s)).toBe(snapshots.pop());
        }
        expect(JSON.stringify(s)).toBe(startJson);
        expect(s.moves).toBe(0);
      }),
      RUNS,
    );
  });
});

describe('rules examples', () => {
  const lvl = (rows: string[]) => parseLevel({ id: 't', par: 1, rows });

  it('tall grass takes two passes', () => {
    let s = lvl(['SG.']);
    s = slide(s, 0, 'right').state;
    expect(s.grass).toEqual([0, 1, 0]);
    s = slide(s, 0, 'left').state;
    expect(s.grass).toEqual([0, 0, 0]);
    expect(isCleared(s)).toBe(true);
    expect(s.moves).toBe(2);
  });

  it('mud stops on entry and never changes', () => {
    const r = slide(lvl(['Sgmg']), 0, 'right');
    expect(r.state.sheep).toEqual([2]);
    expect(r.state.grass).toEqual([0, 0, 0, 1]);
    expect(r.state.cells[2]).toBe('m');
  });

  it('flowerbed fails the field', () => {
    const r = slide(lvl(['Sgfg']), 0, 'right');
    expect(r).toMatchObject({ moved: true, failed: true });
    expect(r.state.trampled).toBe(2);
    expect(isCleared(r.state)).toBe(false);
  });

  it('rock, fence and other sheep block; blocked move is a non-move', () => {
    const s = lvl(['gS#', 'gS.']);
    expect(slide(s, 0, 'right').moved).toBe(false); // rock
    expect(slide(s, 0, 'up').moved).toBe(false); // fence
    expect(slide(s, 0, 'down').moved).toBe(false); // sheep 1
    expect(slide(s, 1, 'up').moved).toBe(false); // sheep 0
    expect(slide(s, 1, 'right').state.sheep).toEqual([1, 5]);
    expect(slide(s, 7, 'left').moved).toBe(false); // bad index
  });

  it('sheep are indexed in scan order', () => {
    expect(lvl(['g.S', 'S..']).sheep).toEqual([2, 3]);
  });
});
