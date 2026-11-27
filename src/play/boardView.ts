/**
 * Board view model: turns a game `State` into plain cell and sheep descriptors
 * for rendering (kind, accessibility label, testID, grid position).
 *
 * Display mapping only. No movement, blocking or win logic lives here; that is
 * all in `src/game` (`slide`, `isCleared`). No React or platform imports.
 */
import type { State } from '../game';

export type CellKind =
  | 'grass'
  | 'tall grass'
  | 'soil'
  | 'rock'
  | 'mud'
  | 'flowerbed'
  | 'trampled flowerbed';

export interface CellView {
  p: number;
  x: number;
  y: number;
  kind: CellKind;
  testID: string;
  label: string;
}

export interface SheepView {
  i: number;
  p: number;
  x: number;
  y: number;
  testID: string;
  label: string;
}

export interface BoardView {
  width: number;
  height: number;
  cells: CellView[];
  sheep: SheepView[];
}

/**
 * What a cell looks like right now. Grass amount wins over terrain. The
 * flowerbed a sheep ran into (`state.trampled`, as the prototype's `S.tramp`)
 * shows as trampled until the run is undone or the field restarted.
 */
export function cellKind(state: State, p: number): CellKind {
  const g = state.grass[p];
  if (g === 2) return 'tall grass';
  if (g === 1) return 'grass';
  switch (state.cells[p]) {
    case '#':
      return 'rock';
    case 'm':
      return 'mud';
    case 'f':
      return state.trampled === p ? 'trampled flowerbed' : 'flowerbed';
    default:
      return 'soil';
  }
}

/** Human (1-based) position text shared by cell and sheep labels. */
function where(x: number, y: number): string {
  return `column ${x + 1}, row ${y + 1}`;
}

export function buildBoardView(state: State): BoardView {
  const { width, height } = state;
  const cells: CellView[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const kind = cellKind(state, p);
      cells.push({ p, x, y, kind, testID: `cell-${x}-${y}`, label: `${kind}, ${where(x, y)}` });
    }
  }
  const sheep: SheepView[] = state.sheep.map((p, i) => {
    const x = p % width;
    const y = Math.floor(p / width);
    return { i, p, x, y, testID: `sheep-${i}`, label: `Sheep, ${where(x, y)}` };
  });
  return { width, height, cells, sheep };
}
