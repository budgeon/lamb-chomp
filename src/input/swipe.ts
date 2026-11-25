/**
 * Swipe classification for the paddock gesture.
 *
 * Pure: no React, React Native or gesture-runtime imports, so it is tested in Jest
 * directly. Same maths as the prototype's `pointerup` handler: a release closer than
 * 16 pt to the start is not a swipe; otherwise the dominant axis wins and a tie goes
 * vertical. Screen y grows downward, so dy > 0 is `down`.
 */
import type { Dir } from '../game';

/** Minimum swipe length in points, same as the prototype. */
export const SWIPE_MIN_DISTANCE = 16;

export function swipeDirection(
  dx: number,
  dy: number,
  minDistance: number = SWIPE_MIN_DISTANCE,
): Dir | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) < minDistance) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
