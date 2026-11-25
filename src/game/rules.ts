/**
 * Lamb Chomp rules. A line-for-line port of `slide()`/`parse()` in
 * prototype/index.html (which must stay identical to tools/gen.js).
 *
 * Decisions documented here:
 * - Sheep indexing: scan order of the level rows (see State in types.ts).
 * - Blocked moves: if the selected sheep cannot enter even one cell (fence,
 *   rock or other sheep directly ahead), the move is a non-move. `slide`
 *   returns `moved: false` and the *same* state object; `moves` is not
 *   incremented. This matches the prototype, which plays a "nope" wiggle and
 *   neither pushes undo history nor counts the move.
 * - Finished fields: once a state is failed or cleared, `slide` is a non-move
 *   (prototype `move()` returns early when `S.won || S.failed`).
 * - Invalid sheep index: treated as a non-move rather than throwing, so UI code
 *   can call slide blindly.
 */
import type { Dir, Level, SlideResult, State, Terrain } from './types';

export const DIR_DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
  right: [1, 0],
  left: [-1, 0],
  down: [0, 1],
  up: [0, -1],
};

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export const LEGEND = ['g', 'G', '.', '#', 'm', 'f', 'S'] as const;
export const MAX_SHEEP = 2;

/** Schema and legend checks. Returns human-readable errors, [] when valid. */
export function validateLevel(level: unknown): string[] {
  const errors: string[] = [];
  if (typeof level !== 'object' || level === null || Array.isArray(level)) {
    return ['level must be an object'];
  }
  const l = level as Record<string, unknown>;

  if (typeof l.id !== 'string' || l.id.trim() === '') errors.push('id must be a non-empty string');

  if (typeof l.par !== 'number' || !Number.isInteger(l.par) || l.par <= 0) {
    errors.push('par must be a positive integer');
  }

  if (l.hint !== undefined && typeof l.hint !== 'string') errors.push('hint must be a string when present');

  const rows = l.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('rows must be a non-empty array of strings');
    return errors;
  }
  if (!rows.every((r): r is string => typeof r === 'string')) {
    errors.push('rows must contain only strings');
    return errors;
  }
  const width = rows[0].length;
  if (width === 0) errors.push('rows must not be empty strings');
  let sheep = 0;
  let grass = 0;
  rows.forEach((r, y) => {
    if (r.length !== width) errors.push(`row ${y} has length ${r.length}, expected ${width} (ragged rows)`);
    [...r].forEach((c, x) => {
      if (!(LEGEND as readonly string[]).includes(c)) {
        errors.push(`unknown cell '${c}' at row ${y}, column ${x}`);
      }
      if (c === 'S') sheep++;
      if (c === 'g' || c === 'G') grass++;
    });
  });
  if (sheep === 0) errors.push('level has no sheep');
  if (sheep > MAX_SHEEP) errors.push(`level has ${sheep} sheep, at most ${MAX_SHEEP} allowed`);
  if (grass === 0) errors.push('level has no grass');
  return errors;
}

/** Build the initial state. Throws if the level is invalid. */
export function parseLevel(level: Level): State {
  const errors = validateLevel(level);
  if (errors.length) throw new Error(`Invalid level ${String(level?.id)}: ${errors.join('; ')}`);
  const rows = level.rows;
  const height = rows.length;
  const width = rows[0].length;
  const cells: Terrain[] = [];
  const grass: number[] = [];
  const sheep: number[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      const p = y * width + x;
      cells.push(c === '#' || c === 'm' || c === 'f' ? c : '.');
      grass.push(c === 'g' ? 1 : c === 'G' ? 2 : 0);
      if (c === 'S') sheep.push(p);
    }),
  );
  return { width, height, cells, grass, sheep, moves: 0, failed: false, trampled: -1 };
}

/** Total grazing passes still needed. Tall grass counts 2. */
export function grassRemaining(state: State): number {
  let n = 0;
  for (const g of state.grass) n += g;
  return n;
}

/** Cleared means no grass left and the field has not failed. */
export function isCleared(state: State): boolean {
  return !state.failed && state.grass.every((g) => g === 0);
}

/**
 * Cells the sheep would enter, plus whether the run ends in a flowerbed.
 * Exact port of the prototype's `slide()`.
 */
export function runPath(state: State, sheep: number, dir: Dir): { path: number[]; trample: boolean } {
  const { width: w, height: h, cells } = state;
  const [dx, dy] = DIR_DELTA[dir];
  const start = state.sheep[sheep];
  let x = start % w;
  let y = Math.floor(start / w);
  const path: number[] = [];
  let trample = false;
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) break; // fence
    const p = ny * w + nx;
    const c = cells[p];
    if (c === '#') break; // rock
    if (state.sheep.some((s, j) => j !== sheep && s === p)) break; // other sheep
    x = nx;
    y = ny;
    path.push(p);
    if (c === 'f') {
      trample = true;
      break;
    }
    if (c === 'm') break; // mud stops on entry
  }
  return { path, trample };
}

/** Apply one swipe. Pure: never mutates `state`. */
export function slide(state: State, sheep: number, dir: Dir): SlideResult {
  const noMove: SlideResult = { state, moved: false, failed: state.failed };
  if (state.failed || isCleared(state)) return noMove;
  if (!Number.isInteger(sheep) || sheep < 0 || sheep >= state.sheep.length) return noMove;
  if (!(dir in DIR_DELTA)) return noMove;

  const { path, trample } = runPath(state, sheep, dir);
  if (path.length === 0) return noMove;

  const grass = state.grass.slice();
  for (const p of path) if (grass[p]) grass[p]--;
  const sheepPos = state.sheep.slice();
  sheepPos[sheep] = path[path.length - 1];

  const next: State = {
    width: state.width,
    height: state.height,
    cells: state.cells,
    grass,
    sheep: sheepPos,
    moves: state.moves + 1,
    failed: trample,
    trampled: trample ? sheepPos[sheep] : -1,
  };
  return { state: next, moved: true, failed: trample };
}
