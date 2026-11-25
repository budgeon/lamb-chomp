/**
 * Level gate: every shipped level must be valid, uniquely identified, solvable,
 * and store the true BFS par. Pure: reads levels, writes nothing.
 *
 * Covers LEVELS (src/game/levels/levels.json) plus any other *.json files under
 * src/game/levels/ (each either a Level or an array of Levels).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { LEVELS, solve, validateLevel, type Level } from '../../src/game';

const ROOT = resolve(__dirname, '../..');
const LEVELS_DIR = join(ROOT, 'src/game/levels');
const MAIN_FILE = join(LEVELS_DIR, 'levels.json');

interface Entry {
  source: string;
  level: unknown;
}

function jsonFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return n.endsWith('.json') && p !== MAIN_FILE ? [p] : [];
  });
}

const entries: Entry[] = LEVELS.map((level) => ({ source: 'LEVELS', level }));
const errors: string[] = [];

for (const file of jsonFiles(LEVELS_DIR)) {
  const rel = relative(ROOT, file);
  try {
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    for (const level of Array.isArray(data) ? data : [data]) entries.push({ source: rel, level });
  } catch (e) {
    errors.push(`${rel}: cannot parse JSON (${(e as Error).message})`);
  }
}

if (entries.length === 0) errors.push('no levels found');

const ids = new Map<string, string>();
const rows: { id: string; stored: string; solver: string; ms: string; status: string }[] = [];

entries.forEach(({ source, level }, i) => {
  const label = (level as { id?: unknown })?.id;
  const name = typeof label === 'string' ? label : `${source}#${i}`;
  const problems = validateLevel(level);
  if (problems.length) {
    for (const p of problems) errors.push(`${name} (${source}): invalid: ${p}`);
    rows.push({ id: name, stored: '?', solver: '-', ms: '-', status: 'INVALID' });
    return;
  }
  const lvl = level as Level;
  const prev = ids.get(lvl.id);
  if (prev) errors.push(`${lvl.id}: duplicate id (also in ${prev})`);
  ids.set(lvl.id, source);

  const t0 = performance.now();
  const result = solve(lvl);
  const ms = (performance.now() - t0).toFixed(1);
  let status = 'ok';
  if (!result) {
    errors.push(`${lvl.id} (${source}): unsolvable (solver returned null)`);
    status = 'UNSOLVABLE';
  } else if (result.par !== lvl.par) {
    errors.push(`${lvl.id} (${source}): par mismatch, stored ${lvl.par}, solver ${result.par}`);
    status = 'PAR MISMATCH';
  }
  rows.push({ id: lvl.id, stored: String(lvl.par), solver: result ? String(result.par) : '-', ms, status });
});

const w = Math.max(2, ...rows.map((r) => r.id.length));
console.log(`${'id'.padEnd(w)}  par  solver  ms       status`);
for (const r of rows) {
  console.log(`${r.id.padEnd(w)}  ${r.stored.padStart(3)}  ${r.solver.padStart(6)}  ${r.ms.padStart(7)}  ${r.status}`);
}

if (errors.length) {
  console.error(`\nlevels gate: FAIL (${errors.length} problem(s) across ${entries.length} level(s))`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`\nlevels gate: PASS (${entries.length} level(s))`);
