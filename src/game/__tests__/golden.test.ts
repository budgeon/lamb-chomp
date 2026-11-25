/// <reference types="jest" />
/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

import { CHECK_SOLUTIONS, loadPrototype, parseSolution } from '../__testutils__/prototype';
import { LEVELS, grassRemaining, isCleared, parseLevel, slide } from '../index';

describe('golden replay of tools/check.js solutions', () => {
  it('uses the same solutions as tools/check.js', () => {
    const check = fs.readFileSync(path.resolve(__dirname, '../../../tools/check.js'), 'utf8');
    const m = check.match(/const sols=(\[[^\]]*\])/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toEqual(CHECK_SOLUTIONS);
  });

  it('levels.json matches the prototype LEVELS and tools/levels.json (rows, par, hint)', () => {
    const proto = loadPrototype().LEVELS;
    const tools = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../tools/levels.json'), 'utf8'),
    ) as { rows: string[]; par: number }[];
    expect(LEVELS).toHaveLength(8);
    LEVELS.forEach((l, i) => {
      expect(l.rows).toEqual(proto[i].rows);
      expect(l.par).toBe(proto[i].par);
      expect(l.hint).toBe(proto[i].hint);
      expect(l.rows).toEqual(tools[i].rows);
      expect(l.par).toBe(tools[i].par);
    });
  });

  it.each(LEVELS.map((l, i) => [l.id, i] as const))('%s clears in exactly par moves', (_id, i) => {
    const level = LEVELS[i];
    const moves = parseSolution(CHECK_SOLUTIONS[i]);
    expect(moves).toHaveLength(level.par);
    let s = parseLevel(level);
    moves.forEach((m, k) => {
      expect(isCleared(s)).toBe(false); // not cleared early
      const r = slide(s, m.sheep, m.dir);
      expect({ k, moved: r.moved, failed: r.failed }).toEqual({ k, moved: true, failed: false });
      s = r.state;
    });
    expect(s.moves).toBe(level.par);
    expect(grassRemaining(s)).toBe(0);
    expect(isCleared(s)).toBe(true);
  });
});
