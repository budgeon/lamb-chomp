/**
 * Play session reducer: the prototype's `busy` / `queued` logic as a pure
 * reducer over the rules module's `State`.
 *
 * The board changes only through `slide()` from `src/game`. Everything here is
 * bookkeeping for the run animation (which run is playing, how many cells it
 * covers) and the one-deep swipe buffer. No React, React Native or timers.
 *
 * Commit-then-animate: a swipe commits `slide()`'s result to `game` at once
 * and starts a `run`. The view animates the sheep and then dispatches
 * `runEnd` with the run's id. A swipe that arrives while a run is playing is
 * stored in `queued` (the latest one wins) and applied when the run ends,
 * unless the field is over by then.
 */
import { isCleared, parseLevel, slide } from '../game';
import type { Dir, Level, State } from '../game';

/** Per-cell run time in ms (prototype `STEP`). */
export const STEP_MS = 70;

export interface Run {
  /** Unique per session; `runEnd` must quote it. */
  id: number;
  /** Sheep index (scan order) that is running. */
  sheep: number;
  /** Cell index the run started from. */
  from: number;
  /** Cell index the run ended on. */
  to: number;
  /** Path length in cells (animation duration is `cells * STEP_MS`). */
  cells: number;
}

export interface Session {
  /** Committed state; single source of truth for rendering. */
  readonly game: State;
  /** Non-null while a run animates (prototype `busy`). */
  readonly run: Run | null;
  /** One-deep swipe buffer (prototype `queued`). */
  readonly queued: Dir | null;
  readonly nextRunId: number;
}

export type SessionAction =
  | { type: 'swipe'; sheep: number; dir: Dir }
  | { type: 'runEnd'; runId: number };

export function initialSession(level: Level): Session {
  return { game: parseLevel(level), run: null, queued: null, nextRunId: 1 };
}

/**
 * Number of cells between two positions on the same row or column. Geometry
 * for the animation duration only; movement itself is decided by `slide()`.
 */
function cellsBetween(width: number, from: number, to: number): number {
  const fx = from % width;
  const fy = Math.floor(from / width);
  const tx = to % width;
  const ty = Math.floor(to / width);
  return fy === ty ? Math.abs(tx - fx) : Math.abs(ty - fy);
}

/** Apply a swipe to an idle session. Returns `s` itself when nothing moved. */
function applySwipe(s: Session, sheep: number, dir: Dir): Session {
  const r = slide(s.game, sheep, dir);
  if (!r.moved) return s;
  const from = s.game.sheep[sheep];
  const to = r.state.sheep[sheep];
  return {
    game: r.state,
    run: { id: s.nextRunId, sheep, from, to, cells: cellsBetween(s.game.width, from, to) },
    queued: null,
    nextRunId: s.nextRunId + 1,
  };
}

export function sessionReducer(s: Session, a: SessionAction): Session {
  switch (a.type) {
    case 'swipe':
      if (s.run) return { ...s, queued: a.dir };
      return applySwipe(s, a.sheep, a.dir);
    case 'runEnd': {
      if (!s.run || a.runId !== s.run.id) return s;
      const sheep = s.run.sheep;
      const idle: Session = { ...s, run: null, queued: null };
      if (isCleared(s.game) || s.game.failed) return idle;
      if (s.queued) return applySwipe(idle, sheep, s.queued);
      return idle;
    }
    default:
      return s;
  }
}
