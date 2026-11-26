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

/** A point in screen coordinates (points, y grows downward). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Classifies a swipe from the touch-down point to the lift point. Use this rather
 * than a gesture runtime's translation: react-native-gesture-handler on iOS resets
 * the pan's translation to zero when the pan activates (after its own minDistance),
 * so the translation leaves out the start of the swipe.
 */
export function swipeBetween(
  start: Point,
  end: Point,
  minDistance: number = SWIPE_MIN_DISTANCE,
): Dir | null {
  return swipeDirection(end.x - start.x, end.y - start.y, minDistance);
}
