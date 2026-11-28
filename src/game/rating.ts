/**
 * Star rating for a cleared field (D7, docs/DECISIONS.md).
 *
 * - moves == par: 3 stars and the shepherd's best badge
 * - moves <= par + max(1, ceil(15% of par)): 3 stars
 * - moves <= par + max(3, ceil(40% of par)): 2 stars
 * - any other clear: 1 star
 *
 * Margins use integer maths only, so the result never depends on float rounding.
 * For 15% and 40% the float form Math.ceil(0.15 * par) happens to agree for every
 * par up to 100,000, but other percentages do not (0.07 * 100 is 7.000000000000001,
 * which Math.ceil rounds up to 8), so a later tuning could silently break it.
 */

export type StarCount = 1 | 2 | 3;

export interface Rating {
  stars: StarCount;
  badge: boolean;
}

/** ceil(percent * par / 100) for non-negative integers, without floating point. */
function ceilPercent(percent: number, par: number): number {
  return Math.floor((percent * par + 99) / 100);
}

/** Highest move counts that still earn 3 stars and 2 stars. */
export function starLimits(par: number): { three: number; two: number } {
  return {
    three: par + Math.max(1, ceilPercent(15, par)),
    two: par + Math.max(3, ceilPercent(40, par)),
  };
}

/** Rates a clear of a field with the given par in the given number of moves. */
export function rateClear(par: number, moves: number): Rating {
  const { three, two } = starLimits(par);
  const stars: StarCount = moves <= three ? 3 : moves <= two ? 2 : 1;
  return { stars, badge: moves <= par };
}
