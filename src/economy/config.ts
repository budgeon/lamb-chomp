/**
 * v1 coin economy and cosmetics catalog (D6: free, ad-light, coins earned by
 * play, spent on cosmetics; rewarded ads for hints only).
 *
 * Every number marked TODO-tune is a placeholder. The invariants that matter
 * (affordability, no forced ads) are enforced by `scripts/gates/economy.ts`
 * and `src/economy/__tests__/config.test.ts`, so retuning is safe as long as
 * the gate stays green.
 */

export type Stars = 1 | 2 | 3;

export type CosmeticCategory = 'sheep-skin' | 'fence' | 'paddock';

export interface Cosmetic {
  id: string;
  name: string;
  category: CosmeticCategory;
  /** Price in coins. Must be a positive integer. */
  price: number;
}

/**
 * The only ad format allowed in v1 is a rewarded ad the player opts into to get
 * a solver hint. Interstitials, banners and rewarded-for-coins are deliberately
 * not representable in this type (D6: "no forced interstitials").
 */
export interface AdPlacement {
  id: string;
  kind: 'rewarded';
  purpose: 'hint';
  /** Where the player can opt in. Informational. */
  surface: string;
}

export interface EarnRules {
  /** Coins for clearing a field for the first time, regardless of stars. */
  firstClearBase: number;
  /** Extra coins by star rating, paid on first clear. */
  starBonus: Record<Stars, number>;
  /**
   * Replays pay no base. They pay only the difference in star bonus when the
   * player improves their best rating, so grinding an already-3-starred field
   * earns nothing and every coin stays tied to progress.
   */
  replay: 'star-upgrade-only';
  /**
   * Extra coins for the shepherd's best badge (a clear in exactly par moves,
   * D7). Paid once per field: on a first clear that earns the badge, or as a
   * replay upgrade the first time the badge is earned.
   */
  shepherdsBestBonus: number;
  /** One-off bonus for clearing every field in a world. */
  worldCompleteBonus: number;
}

export interface SimulationProfile {
  /** Planned world sizes (D2: ~100 levels, worlds of 15-20). */
  worldSizes: number[];
  /** Repeating star pattern for a typical player on first clear. */
  starPattern: Stars[];
  /**
   * Whether the typical player earns the shepherd's best badge on each clear,
   * lined up index by index with `starPattern` (same length; a badge only on
   * a 3-star entry).
   */
  badgePattern: boolean[];
}

export interface EconomyThresholds {
  /** The cheapest cosmetic must be affordable within this many levels. */
  firstCosmeticWithinLevels: number;
  /** Every individual cosmetic must be affordable within this many levels. */
  eachCosmeticWithinLevels: number;
}

export interface EconomyConfig {
  earn: EarnRules;
  catalog: Cosmetic[];
  ads: AdPlacement[];
  simulation: SimulationProfile;
  thresholds: EconomyThresholds;
}

export const ECONOMY: EconomyConfig = {
  earn: {
    firstClearBase: 10, // TODO-tune
    starBonus: { 1: 0, 2: 5, 3: 10 }, // TODO-tune
    replay: 'star-upgrade-only',
    shepherdsBestBonus: 5, // TODO-tune
    worldCompleteBonus: 50, // TODO-tune
  },

  // TODO-tune: all prices. Names and items are placeholders pending art.
  catalog: [
    { id: 'skin-cream', name: 'Cream Fleece', category: 'sheep-skin', price: 100 },
    { id: 'skin-black', name: 'Black Sheep', category: 'sheep-skin', price: 200 },
    { id: 'skin-spotted', name: 'Spotted Fleece', category: 'sheep-skin', price: 300 },
    { id: 'skin-golden', name: 'Golden Fleece', category: 'sheep-skin', price: 600 },
    { id: 'fence-picket', name: 'White Picket', category: 'fence', price: 150 },
    { id: 'fence-stone', name: 'Dry Stone Wall', category: 'fence', price: 250 },
    { id: 'fence-hedge', name: 'Hawthorn Hedge', category: 'fence', price: 400 },
    { id: 'paddock-spring', name: 'Spring Meadow', category: 'paddock', price: 200 },
    { id: 'paddock-autumn', name: 'Autumn Field', category: 'paddock', price: 350 },
    { id: 'paddock-moonlit', name: 'Moonlit Pasture', category: 'paddock', price: 500 },
  ],

  ads: [{ id: 'hint-rewarded', kind: 'rewarded', purpose: 'hint', surface: 'in-level hint button' }],

  simulation: {
    worldSizes: [15, 16, 17, 17, 17, 18], // TODO-tune with the real level plan
    starPattern: [3, 2, 1, 2], // averages 2 stars
    badgePattern: [true, false, false, false], // the 3-star clear is at par
  },

  thresholds: {
    firstCosmeticWithinLevels: 15, // must be reachable inside world 1
    eachCosmeticWithinLevels: 100, // TODO-tune
  },
};
