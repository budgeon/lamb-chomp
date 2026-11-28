/**
 * Saved progress: each field's best result and the coin balance (D7).
 *
 * Pure: parse, serialize, record a clear, and work out unlocks and the launch
 * field. No React, React Native, Expo or storage imports; the save adapter in
 * `src/save/` does the file IO and hands raw text in and out.
 *
 * Schema v1, stored as `progress.json`:
 *
 *   { "version": 1, "coins": 25,
 *     "fields": { "field-01": { "stars": 3, "badge": true, "bestMoves": 5 } } }
 *
 * Unlocks are never stored. They are worked out from `fields` (see `isUnlocked`).
 */
import { LEVELS, rateClear } from '../game';
import type { Level } from '../game';
import { NO_BEST, coinsForClear } from '../economy/check';
import type { BestRating } from '../economy/check';
import { ECONOMY } from '../economy/config';
import type { EarnRules } from '../economy/config';

export const PROGRESS_VERSION = 1;

/** A field's saved best. `badge` is the shepherd's best badge (a clear in exactly par moves). */
export interface FieldBest {
  stars: 1 | 2 | 3;
  badge: boolean;
  /** Fewest moves of any clear so far. */
  bestMoves: number;
}

export interface Progress {
  version: 1;
  coins: number;
  /** Keyed by level id. A field with no entry has never been cleared. */
  fields: Record<string, FieldBest>;
}

export interface LoadResult {
  progress: Progress;
  /** The text was there but unreadable: the adapter backs it up before overwriting it. */
  corrupt: boolean;
  /** Written by a newer app version: never overwrite it. */
  readOnly: boolean;
}

export interface ClearOutcome {
  /** This clear's rating and move count. */
  stars: 1 | 2 | 3;
  badge: boolean;
  moves: number;
  /** Coins awarded by this clear (>= 0). */
  coins: number;
  /** The field had no saved entry before this clear. */
  firstClear: boolean;
  /** A replay that raised the saved stars or earned the badge for the first time. */
  newBest: boolean;
  /** The saved best after this clear. */
  best: FieldBest;
}

export const defaultProgress = (): Progress => ({ version: PROGRESS_VERSION, coins: 0, fields: {} });

type Json = Record<string, unknown>;

/**
 * MIGRATIONS[v] turns a parsed version-v object into a version-(v + 1) object.
 * Empty while v1 is the only schema. When the shape changes: bump
 * PROGRESS_VERSION, add MIGRATIONS[old], and add a fixture of the old format to
 * `__tests__/fixtures/`. Never delete a migration: a player can update from any
 * older version straight to the newest.
 */
const MIGRATIONS: Readonly<Record<number, (data: Json) => Json>> = {};

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/** A clean entry, or null when it must be dropped. `par` is undefined for an unknown id. */
function cleanEntry(raw: unknown, par: number | undefined): FieldBest | null {
  if (!isObject(raw)) return null;
  const { stars, badge, bestMoves } = raw;
  if (stars !== 1 && stars !== 2 && stars !== 3) return null;
  if (!isNonNegInt(bestMoves) || bestMoves < 1) return null;
  if (par !== undefined && bestMoves < par) return null;
  // A badge needs 3 stars (D7). A non-boolean badge is treated as not earned.
  return { stars, badge: badge === true && stars === 3, bestMoves };
}

function invalid(corrupt: boolean, readOnly: boolean): LoadResult {
  return { progress: defaultProgress(), corrupt, readOnly };
}

/**
 * Reads saved text. Never throws.
 * - null (no file): defaults.
 * - not JSON, not an object, or no integer `version`: defaults, `corrupt`.
 * - a version newer than this app knows: defaults, `readOnly`.
 * - older versions run through MIGRATIONS.
 * - bad entries are dropped (or their badge cleared), unknown field ids are kept,
 *   and an invalid coin balance is rebuilt from the entries.
 */
export function parseProgress(
  raw: string | null,
  levels: readonly Level[] = LEVELS,
  earn: EarnRules = ECONOMY.earn,
): LoadResult {
  if (raw === null) return invalid(false, false);

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return invalid(true, false);
  }
  if (!isObject(data) || !Number.isInteger(data.version)) return invalid(true, false);

  let version = data.version as number;
  if (version > PROGRESS_VERSION) return invalid(false, true);
  while (version < PROGRESS_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return invalid(true, false);
    data = migrate(data as Json);
    version++;
  }
  const doc = data as Json;

  const pars = new Map(levels.map((l) => [l.id, l.par]));
  const fields: Record<string, FieldBest> = {};
  if (isObject(doc.fields)) {
    for (const id of Object.keys(doc.fields)) {
      const entry = cleanEntry(doc.fields[id], pars.get(id));
      // defineProperty, not assignment, so an id such as "__proto__" stays plain data.
      if (entry) Object.defineProperty(fields, id, { value: entry, enumerable: true, writable: true, configurable: true });
    }
  }

  const coins = isNonNegInt(doc.coins)
    ? doc.coins
    : Object.values(fields).reduce((sum, e) => sum + coinsForClear(earn, NO_BEST, e), 0);

  return { progress: { version: PROGRESS_VERSION, coins, fields }, corrupt: false, readOnly: false };
}

/**
 * Text to save. Byte-stable: keys in the order version, coins, fields; field ids
 * sorted; entry keys in the order stars, badge, bestMoves; two-space indent and
 * a trailing newline.
 */
export function serializeProgress(p: Progress): string {
  const fields: Record<string, FieldBest> = {};
  for (const id of Object.keys(p.fields).sort()) {
    const e = p.fields[id];
    Object.defineProperty(fields, id, {
      value: { stars: e.stars, badge: e.badge, bestMoves: e.bestMoves },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return JSON.stringify({ version: p.version, coins: p.coins, fields }, null, 2) + '\n';
}

/**
 * Records a clear of `level` in `moves` moves. Pays only the rise in the
 * field's value (`coinsForClear` against the saved best), so repeating a clear,
 * or undoing and clearing again, pays nothing. Idempotent: recording the same
 * clear again returns the same progress object and 0 coins.
 *
 * `moves` is at least `level.par`, which the level gate proves is the minimum.
 */
export function recordClear(
  p: Progress,
  level: Pick<Level, 'id' | 'par'>,
  moves: number,
  earn: EarnRules,
): { progress: Progress; outcome: ClearOutcome } {
  const rating = rateClear(level.par, moves);
  const saved = has(p.fields, level.id) ? p.fields[level.id] : undefined;
  const previous: BestRating = saved ? { stars: saved.stars, badge: saved.badge } : NO_BEST;
  const coins = coinsForClear(earn, previous, rating);

  const best: FieldBest = saved
    ? {
        stars: Math.max(saved.stars, rating.stars) as FieldBest['stars'],
        badge: saved.badge || rating.badge,
        bestMoves: Math.min(saved.bestMoves, moves),
      }
    : { stars: rating.stars, badge: rating.badge, bestMoves: moves };

  const outcome: ClearOutcome = {
    stars: rating.stars,
    badge: rating.badge,
    moves,
    coins,
    firstClear: !saved,
    newBest: !!saved && (rating.stars > saved.stars || (rating.badge && !saved.badge)),
    best,
  };

  const unchanged =
    saved && coins === 0 && saved.stars === best.stars && saved.badge === best.badge && saved.bestMoves === best.bestMoves;
  if (unchanged) return { progress: p, outcome };

  return {
    progress: { version: p.version, coins: p.coins + coins, fields: { ...p.fields, [level.id]: best } },
    outcome,
  };
}

const cleared = (p: Progress, level: Level | undefined) => level !== undefined && has(p.fields, level.id);

/** Field 1 is always open; field n is open once field n - 1 or field n itself is cleared. */
export function isUnlocked(p: Progress, levels: readonly Level[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= levels.length) return false;
  return index === 0 || cleared(p, levels[index]) || cleared(p, levels[index - 1]);
}

/**
 * Which field the app opens on, and whether the field list opens over it.
 * - The `startField` test hook wins (even for a locked field).
 * - Otherwise the first field not yet cleared.
 * - With every field cleared, field 1 under the open field list.
 */
export function launchIndex(
  p: Progress,
  levels: readonly Level[],
  startField: number | null,
): { index: number; list: boolean } {
  if (startField !== null) return { index: startField, list: false };
  const first = levels.findIndex((l) => !cleared(p, l));
  return first === -1 ? { index: 0, list: true } : { index: first, list: false };
}

/** The field after `index`, or null on the last field. */
export function nextIndex(index: number, count: number): number | null {
  return index + 1 < count ? index + 1 : null;
}
