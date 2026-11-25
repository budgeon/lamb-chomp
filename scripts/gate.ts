/**
 * Runs the full quality gate in order and summarises it.
 *
 *   npm run gate
 *   npm run gate -- --only=lint,gate:economy
 *
 * Writes .delivery/gate.json (HEAD sha, timestamp, per-check results) when a
 * .delivery/ directory exists. Exits non-zero if any check fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECKS = ['typecheck', 'lint', 'test', 'gate:levels', 'gate:economy'] as const;
type Check = (typeof CHECKS)[number];

interface Result {
  name: Check;
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
}

const ROOT = resolve(__dirname, '..');

function parseOnly(argv: string[]): Check[] {
  const arg = argv.find((a) => a.startsWith('--only='));
  if (!arg) return [...CHECKS];
  const names = arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = names.filter((n) => !(CHECKS as readonly string[]).includes(n));
  if (unknown.length || names.length === 0) {
    console.error(`Unknown check(s): ${unknown.join(', ') || '(none given)'}. Valid: ${CHECKS.join(', ')}`);
    process.exit(2);
  }
  return CHECKS.filter((c) => names.includes(c)); // keep canonical order
}

function headSha(): string | null {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const selected = parseOnly(process.argv.slice(2));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results: Result[] = [];

for (const name of selected) {
  console.log(`\n=== ${name} ===`);
  const t0 = Date.now();
  const r = spawnSync(npm, ['run', '--silent', name], { cwd: ROOT, stdio: 'inherit' });
  results.push({ name, ok: r.status === 0, exitCode: r.status, durationMs: Date.now() - t0 });
}

const w = Math.max(...results.map((r) => r.name.length));
console.log('\n=== gate summary ===');
for (const r of results) {
  console.log(`${r.name.padEnd(w)}  ${r.ok ? 'PASS' : 'FAIL'}  ${(r.durationMs / 1000).toFixed(1).padStart(6)}s`);
}
const passed = results.every((r) => r.ok);
console.log(`Overall: ${passed ? 'PASS' : 'FAIL'}`);

const deliveryDir = join(ROOT, '.delivery');
if (existsSync(deliveryDir) && statSync(deliveryDir).isDirectory()) {
  const report = {
    commit: headSha(),
    timestamp: new Date().toISOString(),
    passed,
    partial: selected.length !== CHECKS.length,
    checks: results,
  };
  writeFileSync(join(deliveryDir, 'gate.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Wrote .delivery/gate.json');
}

process.exit(passed ? 0 : 1);
