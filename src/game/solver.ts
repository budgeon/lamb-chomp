/**
 * Breadth-first search over (sheep positions, grass state). Because every move
 * costs 1 and BFS expands depth by depth, the first cleared state found is a
 * true minimum. Same search as `solve()` in tools/gen.js, but uncapped by
 * state count (bounded by `maxDepth` instead) and using this module's `slide`.
 *
 * Moves that trample a flowerbed are dead ends and are not expanded; blocked
 * moves are skipped. Sheep indices in the returned solution use scan order
 * (prototype order), so they may differ from tools/gen.js printouts.
 */
import { DIRS, isCleared, parseLevel, slide } from './rules';
import type { Level, Move, State } from './types';

export interface SolveResult {
  par: number;
  solution: Move[];
}

const keyOf = (s: State): string => s.sheep.join(',') + '|' + s.grass.join('');

export function solve(level: Level, opts: { maxDepth?: number } = {}): SolveResult | null {
  const maxDepth = opts.maxDepth ?? 60;
  const start = parseLevel(level);
  if (isCleared(start)) return { par: 0, solution: [] };

  // parent[key] = [parentKey, move]; start maps to null.
  const parent = new Map<string, [string, Move] | null>();
  parent.set(keyOf(start), null);
  let frontier: State[] = [start];

  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: State[] = [];
    for (const s of frontier) {
      const sk = keyOf(s);
      for (let i = 0; i < s.sheep.length; i++) {
        for (const dir of DIRS) {
          const r = slide(s, i, dir);
          if (!r.moved || r.failed) continue;
          const k = keyOf(r.state);
          if (parent.has(k)) continue;
          parent.set(k, [sk, { sheep: i, dir }]);
          if (isCleared(r.state)) {
            const solution: Move[] = [];
            let cur: string = k;
            for (let link = parent.get(cur); link; link = parent.get(cur)) {
              solution.unshift(link[1]);
              cur = link[0];
            }
            return { par: depth, solution };
          }
          next.push(r.state);
        }
      }
    }
    frontier = next;
  }
  return null;
}
