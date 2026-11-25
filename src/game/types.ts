/**
 * Core types for the Lamb Chomp rules module. Pure data, no platform code.
 *
 * Row legend (identical to prototype/index.html and tools/gen.js):
 *   g  grass            (one pass to clear)
 *   G  tall grass       (two passes: G -> g -> soil)
 *   .  bare soil
 *   #  rock             (stops a run before it)
 *   m  mud              (a sheep stops on the mud cell it enters; never changes)
 *   f  flowerbed        (entering it fails the field)
 *   S  sheep            (standing on bare soil)
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Level {
  /** Stable identifier, e.g. "field-01". */
  id: string;
  /** Equal-length strings using the legend above. Row 0 is the top of the board. */
  rows: string[];
  /** True minimum number of moves (BFS). */
  par: number;
  /** One-line tutorial hint shown when the field opens (prototype `hint`). */
  hint?: string;
}

/** Static terrain of a cell. Grass amount lives separately in `State.grass`. */
export type Terrain = '.' | '#' | 'm' | 'f';

/**
 * Immutable game state. Treat every array as read-only; `slide` always returns
 * fresh arrays for anything that changes and shares the rest.
 *
 * Positions are cell indices `p = y * width + x` (same as the prototype).
 *
 * Sheep indexing: sheep are numbered in scan order of `level.rows`
 * (left to right, top to bottom), exactly like the prototype's `parse()`.
 * Note: tools/gen.js numbers sheep in the order it randomly placed them, so
 * its printed two-sheep solutions may have indices 0/1 swapped relative to
 * this module. tools/check.js and this module use prototype order.
 */
export interface State {
  readonly width: number;
  readonly height: number;
  /** Static terrain, length width*height. Never changes during play. */
  readonly cells: readonly Terrain[];
  /** Grass per cell: 0 none/soil, 1 grass, 2 tall grass. */
  readonly grass: readonly number[];
  /** Cell index of each sheep, in scan order of the level rows. */
  readonly sheep: readonly number[];
  /** Number of moves made (blocked moves are not counted). */
  readonly moves: number;
  /** True once a sheep has entered a flowerbed. No further moves are possible. */
  readonly failed: boolean;
  /** Cell index of the trampled flowerbed, or -1 (prototype `S.tramp`). */
  readonly trampled: number;
}

export interface Move {
  sheep: number;
  dir: Dir;
}

export interface SlideResult {
  state: State;
  /** False when the move was a non-move (blocked, or the field is already over). */
  moved: boolean;
  /** True when the resulting state is failed. */
  failed: boolean;
}
