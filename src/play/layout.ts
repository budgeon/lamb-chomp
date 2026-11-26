/**
 * Cell sizing for the paddock. Same formula as the prototype's `size()`:
 *   clamp(floor(min((areaW - 14) / cols, (areaH - 26) / rows)), 28, 76)
 * where 14 and 26 are the fence on both sides plus padding. Pure, no platform code.
 */

/** Fence thickness per side, in points (prototype board border 6px). */
export const FENCE = 6;
export const CELL_MIN = 28;
export const CELL_MAX = 76;

/** Extra horizontal room kept beside the fenced board (prototype: 14 - 2*6). */
export const PAD_W = 2;
/** Extra vertical room kept around the fenced board (prototype: 26 - 2*6). */
export const PAD_H = 14;

/**
 * Side length of one cell, in points, for a paddock area of `areaW` x `areaH`.
 * When the unclamped size is at least CELL_MIN, `cols * size + 2 * FENCE` fits
 * in `areaW` and `rows * size + 2 * FENCE` fits in `areaH`.
 */
export function cellSize(areaW: number, areaH: number, cols: number, rows: number): number {
  const byW = (areaW - 2 * FENCE - PAD_W) / cols;
  const byH = (areaH - 2 * FENCE - PAD_H) / rows;
  return Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(byW, byH))));
}
