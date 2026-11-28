/// <reference types="jest" />
/**
 * Purity guards (AC17, AC20). The play modules in `src/play`, the rules in
 * `src/game` and the save logic in `src/save/progressStore.ts` stay plain
 * TypeScript: no React, React Native or Expo imports, and no timers in
 * `src/play`. Timing belongs to the components (Reanimated), not the reducer.
 *
 * Every non-test file under `src/play` and `src/game` is scanned, so a new
 * module is covered without editing this test. `expo-file-system` may only be
 * imported under `src/save/` (the save adapter, `progressFile.ts`).
 *
 * Read-only: this reads source text and adds no test to `src/game`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(ROOT, 'src');
const PLAY_DIR = path.join(SRC_DIR, 'play');
const GAME_DIR = path.join(SRC_DIR, 'game');
const SAVE_DIR = path.join(SRC_DIR, 'save');
const PROGRESS_STORE = path.join(SAVE_DIR, 'progressStore.ts');

/** `.ts`/`.tsx` files under `dir`, recursively. With `skipTests`, skips `__tests__`, `__testutils__` and other `__` folders. */
function sourceFiles(dir: string, skipTests: boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || (skipTests && e.name.startsWith('__'))) return [];
      return sourceFiles(full, skipTests);
    }
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
const FILE_SYSTEM = /^expo-file-system($|\/)/;

const rel = (f: string) => path.relative(ROOT, f);
const base = (f: string) => path.basename(f).replace(/\.tsx?$/, '');

describe('purity (AC17, AC20)', () => {
  const play = sourceFiles(PLAY_DIR, true);
  const game = sourceFiles(GAME_DIR, true);

  it('the scans read the files they are meant to', () => {
    expect(play.map(base)).toEqual(
      expect.arrayContaining(['session', 'boardView', 'layout', 'startField', 'progress']),
    );
    expect(play.some((f) => f.includes(`${path.sep}__tests__${path.sep}`))).toBe(false);
    expect(game.map(base)).toEqual(expect.arrayContaining(['rules', 'solver', 'rating']));
    expect(fs.existsSync(PROGRESS_STORE)).toBe(true);
  });

  it('play modules, src/game and progressStore import no React, React Native or Expo; play modules use no timers', () => {
    const badImports: string[] = [];
    for (const f of [...play, ...game, PROGRESS_STORE]) {
      for (const spec of specifiers(fs.readFileSync(f, 'utf8'))) {
        if (FORBIDDEN_IMPORT.some((re) => re.test(spec))) badImports.push(`${rel(f)}: '${spec}'`);
      }
    }

    const timers: string[] = [];
    for (const f of play) {
      const m = stripComments(fs.readFileSync(f, 'utf8')).match(TIMERS);
      if (m) timers.push(`${rel(f)}: ${m[1]}`);
    }

    expect(badImports).toEqual([]);
    expect(timers).toEqual([]);
  });

  it('expo-file-system is imported only under src/save/', () => {
    const candidates = [
      ...sourceFiles(SRC_DIR, false),
      path.join(ROOT, 'App.tsx'),
      path.join(ROOT, 'index.ts'),
    ];
    const hits = candidates.filter((f) =>
      specifiers(fs.readFileSync(f, 'utf8')).some((spec) => FILE_SYSTEM.test(spec)),
    );

    expect(hits.map(rel)).toContain(path.join('src', 'save', 'progressFile.ts'));
    expect(hits.filter((f) => !f.startsWith(SAVE_DIR + path.sep)).map(rel)).toEqual([]);
  });
});
