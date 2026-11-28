import { ECONOMY, type EconomyConfig, type Stars } from '../config';
import * as fc from 'fast-check';
import {
  NO_BEST,
  type BestRating,
  checkEconomy,
  coinsForClear,
  levelsToAfford,
  simulateEarnCurve,
} from '../check';

const clone = (): EconomyConfig => JSON.parse(JSON.stringify(ECONOMY));

describe('economy config', () => {
  it('passes every invariant', () => {
    expect(checkEconomy(ECONOMY)).toEqual([]);
  });

  it('has positive integer prices and unique ids', () => {
    for (const c of ECONOMY.catalog) {
      expect(Number.isInteger(c.price) && c.price > 0).toBe(true);
    }
    const ids = [...ECONOMY.catalog.map((c) => c.id), ...ECONOMY.ads.map((a) => a.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only has rewarded hint ads', () => {
    for (const ad of ECONOMY.ads) {
      expect(ad.kind).toBe('rewarded');
      expect(ad.purpose).toBe('hint');
    }
  });

  it('simulates ~100 levels in worlds of 15-20', () => {
    const curve = simulateEarnCurve(ECONOMY);
    expect(curve.length).toBeGreaterThanOrEqual(90);
    expect(curve.length).toBeLessThanOrEqual(110);
    for (const n of ECONOMY.simulation.worldSizes) {
      expect(n).toBeGreaterThanOrEqual(15);
      expect(n).toBeLessThanOrEqual(20);
    }
  });

  it('makes the cheapest cosmetic reachable in world 1', () => {
    const curve = simulateEarnCurve(ECONOMY);
    const cheapest = Math.min(...ECONOMY.catalog.map((c) => c.price));
    const at = levelsToAfford(curve, cheapest);
    expect(at).not.toBeNull();
    expect(at!).toBeLessThanOrEqual(ECONOMY.simulation.worldSizes[0]);
  });

  it('makes every cosmetic affordable within the threshold', () => {
    const curve = simulateEarnCurve(ECONOMY);
    for (const c of ECONOMY.catalog) {
      const at = levelsToAfford(curve, c.price);
      expect(at).not.toBeNull();
      expect(at!).toBeLessThanOrEqual(ECONOMY.thresholds.eachCosmeticWithinLevels);
    }
  });
});

describe('payout rules', () => {
  const { earn } = ECONOMY;
  const r = (stars: Stars, badge = false) => ({ stars, badge });
  it('pays base + star bonus on first clear', () => {
    expect(coinsForClear(earn, NO_BEST, r(2))).toBe(earn.firstClearBase + earn.starBonus[2]);
  });
  it('pays only the star upgrade on replay', () => {
    expect(coinsForClear(earn, r(1), r(3))).toBe(earn.starBonus[3] - earn.starBonus[1]);
    expect(coinsForClear(earn, r(3), r(3))).toBe(0);
    expect(coinsForClear(earn, r(2), r(1))).toBe(0);
  });

  // AC13 coin half, with the shipped config (base 10, starBonus 0/5/10, badge 5).
  it('uses the config the AC13 amounts assume', () => {
    expect(earn.firstClearBase).toBe(10);
    expect(earn.starBonus).toEqual({ 1: 0, 2: 5, 3: 10 });
    expect(earn.shepherdsBestBonus).toBe(5);
  });
  it('pays 25 for a first clear at par (3 stars + badge)', () => {
    expect(coinsForClear(earn, NO_BEST, r(3, true))).toBe(25);
  });
  it('pays 15 for a first 2-star clear, then 10 for a par replay', () => {
    expect(coinsForClear(earn, NO_BEST, r(2))).toBe(15);
    expect(coinsForClear(earn, r(2), r(3, true))).toBe(10);
  });
  it('pays the badge bonus once, as a replay upgrade', () => {
    expect(coinsForClear(earn, NO_BEST, r(3))).toBe(20);
    expect(coinsForClear(earn, r(3), r(3, true))).toBe(5);
    expect(coinsForClear(earn, r(3, true), r(3, true))).toBe(0);
  });
  it('telescopes: any sequence of clears on one field pays the value of its final best, never negative', () => {
    const rating = fc
      .constantFrom<Stars>(1, 2, 3)
      .chain((stars) => (stars === 3 ? fc.boolean() : fc.constant(false)).map((badge) => ({ stars, badge })));
    fc.assert(
      fc.property(fc.array(rating, { maxLength: 12 }), (clears) => {
        let best: BestRating = NO_BEST;
        let total = 0;
        for (const next of clears) {
          const paid = coinsForClear(earn, best, next);
          expect(paid).toBeGreaterThanOrEqual(0);
          total += paid;
          if (next.stars > best.stars) best = next;
          else if (next.stars === best.stars) best = { stars: best.stars, badge: best.badge || next.badge };
        }
        const finalValue =
          best.stars === 0
            ? 0
            : earn.firstClearBase + earn.starBonus[best.stars] + (best.badge ? earn.shepherdsBestBonus : 0);
        expect(total).toBe(finalValue);
      }),
    );
  });
  it('pays nothing for a worse replay, never a negative amount', () => {
    expect(coinsForClear(earn, r(3, true), r(1))).toBe(0);
    expect(coinsForClear(earn, r(3, true), r(3))).toBe(0);
    expect(coinsForClear(earn, r(2), r(1))).toBe(0);
  });
});

describe('earn simulation', () => {
  it('includes the badge bonus: level 1 (3 stars + badge) earns 25', () => {
    expect(ECONOMY.simulation.starPattern[0]).toBe(3);
    expect(ECONOMY.simulation.badgePattern[0]).toBe(true);
    expect(simulateEarnCurve(ECONOMY)[0].coins).toBe(25);
  });
});

describe('checkEconomy catches violations', () => {
  it('rejects a non-rewarded ad (forced interstitial)', () => {
    const c = clone();
    (c.ads as unknown[]).push({ id: 'level-end', kind: 'interstitial', purpose: 'hint', surface: 'x' });
    expect(checkEconomy(c).join('\n')).toMatch(/only rewarded\/hint/);
  });
  it('rejects a rewarded ad for anything but hints', () => {
    const c = clone();
    (c.ads as unknown[]).push({ id: 'double-coins', kind: 'rewarded', purpose: 'coins', surface: 'x' });
    expect(checkEconomy(c).join('\n')).toMatch(/only rewarded\/hint/);
  });
  it('rejects non-integer and non-positive prices', () => {
    const c = clone();
    c.catalog[0].price = 0;
    c.catalog[1].price = 12.5;
    expect(checkEconomy(c).filter((e) => /not a positive integer/.test(e))).toHaveLength(2);
  });
  it('rejects duplicate ids', () => {
    const c = clone();
    c.catalog[1].id = c.catalog[0].id;
    expect(checkEconomy(c).join('\n')).toMatch(/duplicate id/);
  });
  it('rejects an unaffordable cosmetic', () => {
    const c = clone();
    c.catalog.push({ id: 'skin-diamond', name: 'Diamond', category: 'sheep-skin', price: 1_000_000 });
    expect(checkEconomy(c).join('\n')).toMatch(/skin-diamond.*affordable at level never/);
  });
  it('rejects a negative shepherdsBestBonus', () => {
    const c = clone();
    c.earn.shepherdsBestBonus = -1;
    expect(checkEconomy(c).join('\n')).toMatch(/shepherdsBestBonus must be a non-negative integer/);
  });
  it('rejects a non-integer shepherdsBestBonus', () => {
    const c = clone();
    c.earn.shepherdsBestBonus = 2.5;
    expect(checkEconomy(c).join('\n')).toMatch(/shepherdsBestBonus must be a non-negative integer/);
  });
  it('rejects a badgePattern whose length differs from starPattern', () => {
    const c = clone();
    c.simulation.badgePattern = [true, false, false];
    expect(checkEconomy(c).join('\n')).toMatch(/badgePattern length 3 must equal simulation.starPattern length 4/);
    c.simulation.badgePattern = [true, false, false, false, false];
    expect(checkEconomy(c).join('\n')).toMatch(/badgePattern length 5/);
  });
  it('rejects a non-boolean badgePattern entry', () => {
    const c = clone();
    (c.simulation.badgePattern as unknown[])[1] = 1;
    expect(checkEconomy(c).join('\n')).toMatch(/badgePattern\[1\] must be a boolean/);
  });
  it('rejects a badge on a non-3-star pattern entry', () => {
    const c = clone();
    c.simulation.badgePattern = [true, true, false, false]; // starPattern[1] is 2
    expect(checkEconomy(c).join('\n')).toMatch(/badgePattern\[1\] is a badge on a 2-star entry/);
  });
  it('rejects a first cosmetic out of reach in world 1', () => {
    const c = clone();
    for (const item of c.catalog) item.price = Math.max(item.price, 500);
    expect(checkEconomy(c).join('\n')).toMatch(/cheapest cosmetic/);
  });
});
