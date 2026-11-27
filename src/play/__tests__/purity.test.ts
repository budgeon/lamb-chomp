/// <reference types="jest" />
/**
 * AC17 purity guard. The play modules (session reducer, board view model,
 * layout, start-field parser) and the rules in `src/game` stay plain
 * TypeScript: no React, React Native or Expo imports, and no timers in
 * `src/play`. Timing belongs to the components (Reanimated), not the reducer.
 *
 * Read-only: this reads source text and adds no test to `src/game`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const PLAY_DIR = path.resolve(__dirname, '..');
const GAME_DIR = path.resolve(__dirname, '../../game');

const PLAY_FILES = ['session.ts', 'boardView.ts', 'layout.ts', 'startField.ts'].map((f) =>
  path.join(PLAY_DIR, f),
);

/** Non-test source files in `src/game`, recursively (skips `__tests__` and `__testutils__`). */
function gameFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name.startsWith('__') ? [] : gameFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Strip block and line comments so prose that mentions a forbidden name does not count. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Module specifiers: `import ... from 'x'`, `import 'x'`, `export ... from 'x'`, `require('x')`, `import('x')`. */
function specifiers(src: string): string[] {
  const code = stripComments(src);
  const patterns = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((re) => [...code.matchAll(re)].map((m) => m[1]));
}

const FORBIDDEN_IMPORT = [/^react($|-native|\/)/, /^react-native-/, /^expo($|-|\/)/, /^@expo\//];
const TIMERS = /\b(setTimeout|setInterval|requestAnimationFrame)\b/;

const rel = (f: string) => path.relative(ROOT, f);

describe('purity (AC17)', () => {
  it('play modules and src/game import no React, React Native or Expo; play modules use no timers', () => {
    const game = gameFiles(GAME_DIR);
    // Guards that the sweep really reads the files it is meant to.
    expect(game.map((f) => path.basename(f))).toEqual(expect.arrayContaining(['rules.ts', 'solver.ts']));
    for (const f of PLAY_FILES) expect(fs.existsSync(f)).toBe(true);

    const badImports: string[] = [];
    for (const f of [...PLAY_FILES, ...game]) {
      for (const spec of specifiers(fs.readFileSync(f, 'utf8'))) {
        if (FORBIDDEN_IMPORT.some((re) => re.test(spec))) badImports.push(`${rel(f)}: '${spec}'`);
      }
    }

    const timers: string[] = [];
    for (const f of PLAY_FILES) {
      const m = stripComments(fs.readFileSync(f, 'utf8')).match(TIMERS);
      if (m) timers.push(`${rel(f)}: ${m[1]}`);
    }

    expect(badImports).toEqual([]);
    expect(timers).toEqual([]);
  });
});
