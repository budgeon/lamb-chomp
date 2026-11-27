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
 *
 * Undo and restart: `history` is a stack of the committed states from before
 * each counted move (the prototype's `S.hist`, without JSON snapshots; `State`
 * is immutable, so the objects themselves are kept). Undo pops one, restart
 * goes back to `start`. Both cancel the current run and drop the buffer, so a
 * late `runEnd` for the cancelled run finds `run === null` (or a newer id) and
 * is ignored. `nextRunId` is never reset, so a cancelled run's id can never
 * match a later run.
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
  /** Next run id. Only ever grows; undo and restart never reset it. */
  readonly nextRunId: number;
  /** parseLevel(level), the target of restart. */
  readonly start: State;
  /** Committed states before each counted move, oldest first. Empty at start and after restart. */
  readonly history: readonly State[];
}

export type SessionAction =
  | { type: 'swipe'; sheep: number; dir: Dir }
  | { type: 'runEnd'; runId: number }
  | { type: 'undo' }
  | { type: 'restart' };

export function initialSession(level: Level): Session {
  const start = parseLevel(level);
  return { game: start, run: null, queued: null, nextRunId: 1, start, history: [] };
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
    start: s.start,
    history: [...s.history, s.game],
  };
}

/** Step back one counted move. Returns `s` itself when there is nothing to undo. */
function applyUndo(s: Session): Session {
  if (s.history.length === 0) return s;
  return {
    ...s,
    game: s.history[s.history.length - 1],
    history: s.history.slice(0, -1),
    run: null,
    queued: null,
  };
}

/**
 * Back to the starting layout. Returns `s` itself when no move has been made
 * (an empty history also means no run is playing).
 */
function applyRestart(s: Session): Session {
  if (s.history.length === 0) return s;
  return { ...s, game: s.start, history: [], run: null, queued: null };
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
    case 'undo':
      return applyUndo(s);
    case 'restart':
      return applyRestart(s);
    default:
      return s;
  }
}
