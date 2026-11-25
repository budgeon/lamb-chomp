/**
 * Pure helpers for the coin economy: payout rules, a typical-player earn
 * simulation, and the invariant checks shared by the economy gate and tests.
 */
import type { EconomyConfig, Stars } from './config';

const CATEGORIES = new Set(['sheep-skin', 'fence', 'paddock']);

/** Coins paid for a clear, given the player's previous best (0 = never cleared). */
export function coinsForClear(
  earn: EconomyConfig['earn'],
  previousBest: 0 | Stars,
  stars: Stars,
): number {
  if (previousBest === 0) return earn.firstClearBase + earn.starBonus[stars];
  if (stars <= previousBest) return 0;
  return earn.starBonus[stars] - earn.starBonus[previousBest];
}

export interface EarnPoint {
  level: number; // 1-based
  world: number; // 1-based
  coins: number; // cumulative after this level (including any world bonus)
}

/** Cumulative coins for a typical player clearing each level once, in order. */
export function simulateEarnCurve(config: EconomyConfig): EarnPoint[] {
  const { worldSizes, starPattern } = config.simulation;
  const curve: EarnPoint[] = [];
  let coins = 0;
  let level = 0;
  worldSizes.forEach((size, w) => {
    for (let i = 0; i < size; i++) {
      const stars = starPattern[level % starPattern.length];
      coins += coinsForClear(config.earn, 0, stars);
      level++;
      if (i === size - 1) coins += config.earn.worldCompleteBonus;
      curve.push({ level, world: w + 1, coins });
    }
  });
  return curve;
}

/** First level (1-based) at which cumulative coins reach `price`, or null. */
export function levelsToAfford(curve: EarnPoint[], price: number): number | null {
  const point = curve.find((p) => p.coins >= price);
  return point ? point.level : null;
}

/** Returns a list of human-readable invariant violations; empty means pass. */
export function checkEconomy(config: EconomyConfig): string[] {
  const errors: string[] = [];
  const isNonNegInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  const isPosInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;

  // Earn rules
  const { earn } = config;
  if (!isNonNegInt(earn.firstClearBase)) errors.push(`earn.firstClearBase must be a non-negative integer`);
  if (!isNonNegInt(earn.worldCompleteBonus)) errors.push(`earn.worldCompleteBonus must be a non-negative integer`);
  ([1, 2, 3] as const).forEach((s) => {
    if (!isNonNegInt(earn.starBonus[s])) errors.push(`earn.starBonus[${s}] must be a non-negative integer`);
  });
  if (!(earn.starBonus[1] <= earn.starBonus[2] && earn.starBonus[2] <= earn.starBonus[3])) {
    errors.push(`earn.starBonus must not decrease with more stars`);
  }
  if (earn.replay !== 'star-upgrade-only') errors.push(`earn.replay must be 'star-upgrade-only'`);

  // Catalog
  if (config.catalog.length === 0) errors.push('catalog is empty');
  const ids = new Set<string>();
  const seen = (id: string, where: string) => {
    if (ids.has(id)) errors.push(`duplicate id "${id}" (${where})`);
    ids.add(id);
  };
  for (const item of config.catalog) {
    seen(item.id, 'catalog');
    if (!item.id || !item.name) errors.push(`cosmetic ${JSON.stringify(item)} needs id and name`);
    if (!CATEGORIES.has(item.category)) errors.push(`cosmetic "${item.id}" has invalid category "${item.category}"`);
    if (!isPosInt(item.price)) errors.push(`cosmetic "${item.id}" price ${item.price} is not a positive integer`);
  }

  // Ads: rewarded hint only. Checked at runtime too, in case a cast slips past the type.
  for (const ad of config.ads) {
    seen(ad.id, 'ads');
    const kind = (ad as { kind: unknown }).kind;
    const purpose = (ad as { purpose: unknown }).purpose;
    if (kind !== 'rewarded' || purpose !== 'hint') {
      errors.push(
        `ad placement "${ad.id}" is ${String(kind)}/${String(purpose)}; only rewarded/hint is allowed (D6: no forced interstitials)`,
      );
    }
  }

  // Simulation profile sanity (D2)
  const { worldSizes, starPattern } = config.simulation;
  worldSizes.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 15 || n > 20) errors.push(`world ${i + 1} size ${n} is outside 15-20 (D2)`);
  });
  if (starPattern.length === 0) errors.push('simulation.starPattern is empty');
  if (errors.length) return errors; // curve maths below assumes valid inputs

  // Affordability
  const curve = simulateEarnCurve(config);
  const { firstCosmeticWithinLevels, eachCosmeticWithinLevels } = config.thresholds;
  const world1 = worldSizes[0];
  const cheapest = [...config.catalog].sort((a, b) => a.price - b.price)[0];
  const firstAt = levelsToAfford(curve, cheapest.price);
  if (firstAt === null || firstAt > Math.min(firstCosmeticWithinLevels, world1)) {
    errors.push(
      `cheapest cosmetic "${cheapest.id}" (${cheapest.price}) affordable at level ${firstAt ?? 'never'}; ` +
        `must be within ${Math.min(firstCosmeticWithinLevels, world1)} (world 1)`,
    );
  }
  for (const item of config.catalog) {
    const at = levelsToAfford(curve, item.price);
    if (at === null || at > eachCosmeticWithinLevels) {
      errors.push(
        `cosmetic "${item.id}" (${item.price}) affordable at level ${at ?? 'never'}; must be within ${eachCosmeticWithinLevels}`,
      );
    }
  }
  return errors;
}
