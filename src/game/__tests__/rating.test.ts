/// <reference types="jest" />
import * as fc from 'fast-check';

import { rateClear, starLimits } from '../index';

// Spec AC1 table: par, highest 3★ move count, highest 2★ move count.
const TABLE: [par: number, three: number, two: number][] = [
  [1, 2, 4],
  [2, 3, 5],
  [3, 4, 6],
  [5, 6, 8],
  [8, 10, 12],
  [9, 11, 13],
  [10, 12, 14],
  [12, 14, 17],
  [13, 15, 19],
  [14, 17, 20],
  [20, 23, 28],
  [21, 25, 30],
];

describe('starLimits', () => {
  it.each(TABLE)('par %i gives 3★ up to %i and 2★ up to %i', (par, three, two) => {
    expect(starLimits(par)).toEqual({ three, two });
  });
});

describe('rateClear boundaries', () => {
  describe.each(TABLE)('par %i', (par, three, two) => {
    it('exactly par: 3 stars and the badge', () => {
      expect(rateClear(par, par)).toEqual({ stars: 3, badge: true });
    });
    it('par + 1 and the 3★ limit: 3 stars, no badge', () => {
      expect(rateClear(par, par + 1)).toEqual({ stars: 3, badge: false });
      expect(rateClear(par, three)).toEqual({ stars: 3, badge: false });
    });
    it('3★ limit + 1 and the 2★ limit: 2 stars', () => {
      expect(rateClear(par, three + 1)).toEqual({ stars: 2, badge: false });
      expect(rateClear(par, two)).toEqual({ stars: 2, badge: false });
    });
    it('2★ limit + 1 and par x 3: 1 star', () => {
      expect(rateClear(par, two + 1)).toEqual({ stars: 1, badge: false });
      // At par 1, par x 3 = 3 lies inside the spec table's 2★ band (3-4), so it rates 2★ there.
      const tripleStars = par * 3 > two ? 1 : 2;
      expect(rateClear(par, par * 3)).toEqual({ stars: tripleStars, badge: false });
    });
  });
});

/** Smallest integer k with k * 100 >= percent * par, found by search (not the floor formula). */
function refCeil(percent: number, par: number): number {
  let k = 0;
  while (k * 100 < percent * par) k++;
  return k;
}

describe('rateClear properties (par 1..1000, moves par..4*par+5)', () => {
  const parArb = fc.integer({ min: 1, max: 1000 });
  const parMoves = parArb.chain((par) =>
    fc.tuple(fc.constant(par), fc.integer({ min: par, max: 4 * par + 5 })),
  );

  it('stars never increase as moves increase', () => {
    fc.assert(
      fc.property(parArb, (par) => {
        let prev = rateClear(par, par).stars;
        for (let moves = par + 1; moves <= 4 * par + 5; moves++) {
          const stars = rateClear(par, moves).stars;
          if (stars > prev) return false;
          prev = stars;
        }
        return true;
      }),
    );
  });

  it('badge holds exactly when moves == par', () => {
    fc.assert(
      fc.property(parMoves, ([par, moves]) => rateClear(par, moves).badge === (moves === par)),
    );
  });

  it('badge implies 3 stars', () => {
    fc.assert(
      fc.property(parMoves, ([par, moves]) => {
        const r = rateClear(par, moves);
        return !r.badge || r.stars === 3;
      }),
    );
  });

  it('limits equal an exact integer reference', () => {
    fc.assert(
      fc.property(parArb, (par) => {
        expect(starLimits(par)).toEqual({
          three: par + Math.max(1, refCeil(15, par)),
          two: par + Math.max(3, refCeil(40, par)),
        });
      }),
    );
  });
});
