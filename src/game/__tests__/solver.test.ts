/// <reference types="jest" />
/// <reference types="node" />
import { LEVELS, isCleared, parseLevel, slide, solve } from '../index';
import type { Level } from '../index';

describe('solve()', () => {
  it.each(LEVELS.map((l, i) => [l.id, i] as const))(
    '%s: BFS par equals stored par and the solution replays',
    (_id, i) => {
      const level = LEVELS[i];
      const r = solve(level);
      expect(r).not.toBeNull();
      expect(r!.par).toBe(level.par);
      expect(r!.solution).toHaveLength(level.par);
      let s = parseLevel(level);
      for (const m of r!.solution) {
        const step = slide(s, m.sheep, m.dir);
        expect(step.moved).toBe(true);
        expect(step.failed).toBe(false);
        s = step.state;
      }
      expect(isCleared(s)).toBe(true);
    },
    30000,
  );

  it('finds no solution below par (maxDepth = par - 1)', () => {
    for (const level of LEVELS.slice(0, 5)) {
      expect(solve(level, { maxDepth: level.par - 1 })).toBeNull();
    }
  });

  it('returns null for an unsolvable field', () => {
    // Grass at (0,0) is unreachable: the sheep can only move right then stop.
    const level: Level = { id: 'x', par: 1, rows: ['g#S.'] };
    expect(solve(level)).toBeNull();
  });

  it('avoids flowerbeds', () => {
    const level: Level = { id: 'x', par: 1, rows: ['Sgf', '...'] };
    // Right would trample; no other way to eat the grass without trampling.
    expect(solve(level)).toBeNull();
    const ok: Level = { id: 'y', par: 2, rows: ['Sgm', '...'] };
    expect(solve(ok)?.par).toBe(1);
  });
});
