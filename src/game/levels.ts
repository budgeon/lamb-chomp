import raw from './levels/levels.json';
import { validateLevel } from './rules';
import type { Level } from './types';

function load(data: unknown): Level[] {
  if (!Array.isArray(data)) throw new Error('levels.json must be an array');
  const seen = new Set<string>();
  return data.map((l, i) => {
    const errors = validateLevel(l);
    if (errors.length) throw new Error(`levels.json entry ${i}: ${errors.join('; ')}`);
    const level = l as Level;
    if (seen.has(level.id)) throw new Error(`levels.json duplicate id ${level.id}`);
    seen.add(level.id);
    return level;
  });
}

/** The shipped fields, in play order. Validated at import time. */
export const LEVELS: Level[] = load(raw);
