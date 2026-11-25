import { ECONOMY, type EconomyConfig } from '../config';
import { checkEconomy, coinsForClear, levelsToAfford, simulateEarnCurve } from '../check';

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
  it('pays base + star bonus on first clear', () => {
    expect(coinsForClear(earn, 0, 2)).toBe(earn.firstClearBase + earn.starBonus[2]);
  });
  it('pays only the star upgrade on replay', () => {
    expect(coinsForClear(earn, 1, 3)).toBe(earn.starBonus[3] - earn.starBonus[1]);
    expect(coinsForClear(earn, 3, 3)).toBe(0);
    expect(coinsForClear(earn, 2, 1)).toBe(0);
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
  it('rejects a first cosmetic out of reach in world 1', () => {
    const c = clone();
    for (const item of c.catalog) item.price = Math.max(item.price, 500);
    expect(checkEconomy(c).join('\n')).toMatch(/cheapest cosmetic/);
  });
});
