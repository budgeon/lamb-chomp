/// <reference types="jest" />
/**
 * Recording clears (AC12, AC13) and unlock / launch rules (AC9).
 */
import * as fc from 'fast-check';

import { LEVELS, rateClear } from '../../game';
import { NO_BEST, coinsForClear } from '../../economy/check';
import { ECONOMY } from '../../economy/config';
import { defaultProgress, isUnlocked, launchIndex, nextIndex, recordClear } from '../progress';
import type { FieldBest, Progress } from '../progress';

const EARN = ECONOMY.earn;
const FIELD1 = LEVELS[0];

/** Progress with the given fields cleared ({3, badge} at par) and a matching balance. */
function clearedProgress(indices: number[]): Progress {
  let p = defaultProgress();
  for (const i of indices) p = recordClear(p, LEVELS[i], LEVELS[i].par, EARN).progress;
  return p;
}

describe('config assumptions (AC13 uses base 10, star bonus 0/5/10, badge 5)', () => {
  it('matches the proposed config and field 1 par 5', () => {
    expect(EARN.firstClearBase).toBe(10);
    expect(EARN.starBonus).toEqual({ 1: 0, 2: 5, 3: 10 });
    expect(EARN.shepherdsBestBonus).toBe(5);
    expect(FIELD1).toMatchObject({ id: 'field-01', par: 5 });
    expect(LEVELS).toHaveLength(8);
  });
});

describe('recordClear (AC12)', () => {
  it('a first clear sets firstClear and saves the rating and moves', () => {
    const { progress, outcome } = recordClear(defaultProgress(), FIELD1, 5, EARN);
    expect(outcome).toEqual({
      stars: 3,
      badge: true,
      moves: 5,
      coins: 25,
      firstClear: true,
      newBest: false,
      best: { stars: 3, badge: true, bestMoves: 5 },
    });
    expect(progress).toEqual({ version: 1, coins: 25, fields: { 'field-01': { stars: 3, badge: true, bestMoves: 5 } } });
  });

  it('does not mutate the progress it is given', () => {
    const p = defaultProgress();
    const snapshot = JSON.parse(JSON.stringify(p));
    recordClear(p, FIELD1, 7, EARN);
    expect(p).toEqual(snapshot);
  });

  it.each([5, 6, 7, 9])('is idempotent: the same %i-move clear twice pays 0 the second time', (moves) => {
    const first = recordClear(defaultProgress(), FIELD1, moves, EARN);
    const second = recordClear(first.progress, FIELD1, moves, EARN);
    expect(second.progress).toEqual(first.progress);
    expect(second.outcome.coins).toBe(0);
    expect(second.outcome.newBest).toBe(false);
    expect(second.outcome.firstClear).toBe(false);
    expect(second.outcome.best).toEqual(first.outcome.best);
  });

  it('bestMoves takes the minimum, and a worse replay keeps it', () => {
    let p = recordClear(defaultProgress(), FIELD1, 9, EARN).progress;
    p = recordClear(p, FIELD1, 7, EARN).progress;
    expect(p.fields['field-01'].bestMoves).toBe(7);
    p = recordClear(p, FIELD1, 12, EARN).progress;
    expect(p.fields['field-01']).toEqual({ stars: 2, badge: false, bestMoves: 7 });
  });

  it('a fewer-moves replay in the same star band lowers bestMoves but is not a new best and pays 0', () => {
    // par 5: 7 and 8 moves are both 2 stars.
    const first = recordClear(defaultProgress(), FIELD1, 8, EARN);
    const second = recordClear(first.progress, FIELD1, 7, EARN);
    expect(second.outcome).toMatchObject({ stars: 2, coins: 0, newBest: false, firstClear: false });
    expect(second.progress.fields['field-01']).toEqual({ stars: 2, badge: false, bestMoves: 7 });
    expect(second.progress.coins).toBe(first.progress.coins);
  });

  it('keeps other fields, including unknown ids, untouched', () => {
    const p: Progress = {
      version: 1,
      coins: 10,
      fields: { 'field-99': { stars: 1, badge: false, bestMoves: 4 } },
    };
    const { progress } = recordClear(p, FIELD1, 5, EARN);
    expect(progress.fields['field-99']).toEqual({ stars: 1, badge: false, bestMoves: 4 });
    expect(progress.coins).toBe(35);
  });
});

describe('coins on field 1 (AC13)', () => {
  type Step = { moves: number; coins: number; newBest: boolean; firstClear: boolean };
  const play = (steps: Step[]) => {
    let p = defaultProgress();
    let total = 0;
    for (const step of steps) {
      const r = recordClear(p, FIELD1, step.moves, EARN);
      expect({ moves: step.moves, coins: r.outcome.coins, newBest: r.outcome.newBest, firstClear: r.outcome.firstClear }).toEqual(step);
      total += r.outcome.coins;
      p = r.progress;
      expect(p.coins).toBe(total);
    }
    return p;
  };

  it('first par clear: +25', () => {
    expect(play([{ moves: 5, coins: 25, newBest: false, firstClear: true }]).coins).toBe(25);
  });

  it('first 2-star clear +15, then a par replay +10 (total 25)', () => {
    const p = play([
      { moves: 7, coins: 15, newBest: false, firstClear: true },
      { moves: 5, coins: 10, newBest: true, firstClear: false },
    ]);
    expect(p.coins).toBe(25);
    expect(p.fields['field-01']).toEqual({ stars: 3, badge: true, bestMoves: 5 });
  });

  it('3 stars without the badge +20, then a par replay +5', () => {
    const p = play([
      { moves: 6, coins: 20, newBest: false, firstClear: true },
      { moves: 5, coins: 5, newBest: true, firstClear: false },
    ]);
    expect(p.coins).toBe(25);
  });

  it('a worse replay pays 0 and is not a new best', () => {
    const p = play([
      { moves: 5, coins: 25, newBest: false, firstClear: true },
      { moves: 7, coins: 0, newBest: false, firstClear: false },
      { moves: 20, coins: 0, newBest: false, firstClear: false },
      { moves: 6, coins: 0, newBest: false, firstClear: false },
    ]);
    expect(p.fields['field-01']).toEqual({ stars: 3, badge: true, bestMoves: 5 });
    expect(p.coins).toBe(25);
  });

  it('1 star +10, then 2 stars +5, then 3 stars +5, then the badge +5', () => {
    play([
      { moves: 9, coins: 10, newBest: false, firstClear: true },
      { moves: 8, coins: 5, newBest: true, firstClear: false },
      { moves: 6, coins: 5, newBest: true, firstClear: false },
      { moves: 5, coins: 5, newBest: true, firstClear: false },
    ]);
  });
});

describe('coins property (AC13): any clears on any fields', () => {
  const clearArb = fc
    .integer({ min: 0, max: LEVELS.length - 1 })
    .chain((i) => fc.tuple(fc.constant(i), fc.integer({ min: LEVELS[i].par, max: 3 * LEVELS[i].par + 3 })));

  it('total paid = progress.coins = sum of coinsForClear(none -> final best); never negative', () => {
    fc.assert(
      fc.property(fc.array(clearArb, { maxLength: 40 }), (clears) => {
        let p = defaultProgress();
        let total = 0;
        const fewest = new Map<string, number>();
        for (const [i, moves] of clears) {
          const level = LEVELS[i];
          const r = recordClear(p, level, moves, EARN);
          expect(r.outcome.coins).toBeGreaterThanOrEqual(0);
          // Repeating the same clear (or undoing and clearing again) pays nothing.
          const again = recordClear(r.progress, level, moves, EARN);
          expect(again.outcome.coins).toBe(0);
          expect(again.progress).toEqual(r.progress);
          total += r.outcome.coins;
          p = r.progress;
          fewest.set(level.id, Math.min(fewest.get(level.id) ?? Infinity, moves));
        }
        expect(p.coins).toBe(total);
        const expected = Object.values(p.fields).reduce(
          (sum, e: FieldBest) => sum + coinsForClear(EARN, NO_BEST, e),
          0,
        );
        expect(total).toBe(expected);
        // The saved best is the rating of the fewest moves seen.
        expect(Object.keys(p.fields).sort()).toEqual([...fewest.keys()].sort());
        for (const [id, moves] of fewest) {
          const level = LEVELS.find((l) => l.id === id)!;
          expect(p.fields[id]).toEqual({ ...rateClear(level.par, moves), bestMoves: moves });
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('unlocks (AC9)', () => {
  const unlocked = (p: Progress) => LEVELS.map((_, i) => isUnlocked(p, LEVELS, i));

  it('empty progress: only field 1 is open', () => {
    expect(unlocked(defaultProgress())).toEqual([true, false, false, false, false, false, false, false]);
  });

  it('field 1 cleared: field 2 open, field 3 locked', () => {
    const p = clearedProgress([0]);
    expect(isUnlocked(p, LEVELS, 1)).toBe(true);
    expect(isUnlocked(p, LEVELS, 2)).toBe(false);
    expect(unlocked(p)).toEqual([true, true, false, false, false, false, false, false]);
  });

  it('only field 3 cleared: field 3 open (cleared itself) and field 4 open', () => {
    const p = clearedProgress([2]);
    expect(unlocked(p)).toEqual([true, false, true, true, false, false, false, false]);
  });

  it('any clear counts, whatever the stars', () => {
    const p = recordClear(defaultProgress(), FIELD1, 40, EARN).progress;
    expect(p.fields['field-01'].stars).toBe(1);
    expect(isUnlocked(p, LEVELS, 1)).toBe(true);
  });

  it('indices outside the list are never open', () => {
    const p = clearedProgress([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const i of [-1, 8, 1.5, NaN]) expect(isUnlocked(p, LEVELS, i)).toBe(false);
  });
});

describe('launchIndex (AC9, AC11)', () => {
  it.each<[string, number[], number | null, { index: number; list: boolean }]>([
    ['empty', [], null, { index: 0, list: false }],
    ['field 1 cleared', [0], null, { index: 1, list: false }],
    ['fields 1-3 cleared', [0, 1, 2], null, { index: 3, list: false }],
    ['fields 1, 2 and 4 cleared: the first gap', [0, 1, 3], null, { index: 2, list: false }],
    ['all eight cleared', [0, 1, 2, 3, 4, 5, 6, 7], null, { index: 0, list: true }],
    ['startField 4 with all cleared', [0, 1, 2, 3, 4, 5, 6, 7], 4, { index: 4, list: false }],
    ['startField 4 with empty progress', [], 4, { index: 4, list: false }],
    ['startField 0 with field 1 cleared', [0], 0, { index: 0, list: false }],
  ])('%s', (_name, cleared, startField, expected) => {
    expect(launchIndex(clearedProgress(cleared), LEVELS, startField)).toEqual(expected);
  });
});

describe('nextIndex', () => {
  it('steps to the next field and stops after the last', () => {
    expect(nextIndex(0, 8)).toBe(1);
    expect(nextIndex(6, 8)).toBe(7);
    expect(nextIndex(7, 8)).toBeNull();
  });
});
