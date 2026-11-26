/// <reference types="jest" />
import * as fc from 'fast-check';

import { DIRS, LEVELS, isCleared, parseLevel, slide } from '../../game';
import type { Dir, State } from '../../game';
import { runPath } from '../../game/rules';
import { STEP_MS, initialSession, sessionReducer } from '../session';
import type { Session, SessionAction } from '../session';

const FIELD1 = LEVELS[0];
const PAR_SOLUTION: Dir[] = ['up', 'left', 'down', 'right', 'up'];

const swipe = (dir: Dir, sheep = 0): SessionAction => ({ type: 'swipe', sheep, dir });
const runEnd = (runId: number): SessionAction => ({ type: 'runEnd', runId });

/** Swipe, then finish the run it started (if any). */
function swipeAndSettle(s: Session, dir: Dir): Session {
  const next = sessionReducer(s, swipe(dir));
  return next.run ? sessionReducer(next, runEnd(next.run.id)) : next;
}

function playAll(dirs: Dir[]): Session {
  return dirs.reduce(swipeAndSettle, initialSession(FIELD1));
}

describe('session reducer (AC8: board changes only through slide)', () => {
  it('starts from parseLevel with no run and an empty buffer', () => {
    const s = initialSession(FIELD1);
    expect(s.game).toEqual(parseLevel(FIELD1));
    expect(s.run).toBeNull();
    expect(s.queued).toBeNull();
    expect(STEP_MS).toBe(70);
  });

  it('the par solution U L D R U clears field 1 in 5 moves', () => {
    const s = playAll(PAR_SOLUTION);
    expect(isCleared(s.game)).toBe(true);
    expect(s.game.moves).toBe(5);
    expect(s.run).toBeNull();
    expect(s.queued).toBeNull();
  });

  it('each swipe commits exactly what slide() returns', () => {
    let s = initialSession(FIELD1);
    for (const dir of PAR_SOLUTION) {
      const expected = slide(s.game, 0, dir).state;
      const next = sessionReducer(s, swipe(dir));
      expect(next.game).toEqual(expected);
      expect(next.run).not.toBeNull();
      s = sessionReducer(next, runEnd(next.run!.id));
      expect(s.game).toBe(next.game); // runEnd never touches the board
    }
  });

  it('a blocked swipe returns the same session object and is not a move', () => {
    const s = playAll(['right']); // (3,2) -> (4,2), now at the fence
    expect(s.game.moves).toBe(1);
    expect(s.run).toBeNull();
    const blocked = sessionReducer(s, swipe('right'));
    expect(blocked).toBe(s);
    expect(blocked.game.moves).toBe(1);
    expect(blocked.run).toBeNull();
  });

  it('swipes after the field is cleared are ignored', () => {
    const cleared = playAll(PAR_SOLUTION);
    for (const dir of DIRS) {
      const next = sessionReducer(cleared, swipe(dir));
      expect(next).toBe(cleared);
      expect(next.game.moves).toBe(5);
    }
  });

  it('Run.cells is the path length of each par move (2, 3, 4, 4, 4)', () => {
    let s = initialSession(FIELD1);
    const cells: number[] = [];
    for (const dir of PAR_SOLUTION) {
      const pathLen = runPath(s.game, 0, dir).path.length;
      const from = s.game.sheep[0];
      const next = sessionReducer(s, swipe(dir));
      expect(next.run).toMatchObject({ sheep: 0, from, to: next.game.sheep[0], cells: pathLen });
      cells.push(next.run!.cells);
      s = sessionReducer(next, runEnd(next.run!.id));
    }
    expect(cells).toEqual([2, 3, 4, 4, 4]);
  });
});

describe('one-swipe buffer (AC9)', () => {
  it('queues a swipe during a run, replaces it, and applies it exactly once', () => {
    const s0 = initialSession(FIELD1);
    const s1 = sessionReducer(s0, swipe('up'));
    expect(s1.run).not.toBeNull();
    expect(s1.game.moves).toBe(1);
    const firstRunId = s1.run!.id;

    const s2 = sessionReducer(s1, swipe('left'));
    expect(s2.queued).toBe('left');
    expect(s2.game).toBe(s1.game);
    expect(s2.run).toBe(s1.run);

    const s3 = sessionReducer(s2, swipe('down'));
    expect(s3.queued).toBe('down');
    expect(s3.game).toBe(s1.game);

    // Run ends: the queued 'down' from (3,0) is applied, starting a new run.
    const s4 = sessionReducer(s3, runEnd(firstRunId));
    expect(s4.game.moves).toBe(2);
    expect(s4.game).toEqual(slide(s1.game, 0, 'down').state);
    expect(s4.queued).toBeNull();
    expect(s4.run).not.toBeNull();
    expect(s4.run!.id).not.toBe(firstRunId);

    // A duplicate runEnd for the old run is a no-op.
    const s5 = sessionReducer(s4, runEnd(firstRunId));
    expect(s5).toBe(s4);
    expect(s5.game.moves).toBe(2);
  });

  it('quick U then L ends at column 1, row 1 with 2 moves', () => {
    let s = initialSession(FIELD1);
    s = sessionReducer(s, swipe('up'));
    s = sessionReducer(s, swipe('left'));
    s = sessionReducer(s, runEnd(s.run!.id));
    s = sessionReducer(s, runEnd(s.run!.id));
    expect(s.game.sheep[0]).toBe(0);
    expect(s.game.moves).toBe(2);
    expect(s.run).toBeNull();
    expect(s.queued).toBeNull();
  });

  it('drops the queued swipe when the run that clears the field ends', () => {
    let s = playAll(['up', 'left', 'down', 'right']);
    s = sessionReducer(s, swipe('up'));
    expect(isCleared(s.game)).toBe(true);
    s = sessionReducer(s, swipe('left'));
    expect(s.queued).toBe('left');
    s = sessionReducer(s, runEnd(s.run!.id));
    expect(isCleared(s.game)).toBe(true);
    expect(s.queued).toBeNull();
    expect(s.run).toBeNull();
    expect(s.game.moves).toBe(5);
  });

  it('a runEnd with no run active is a no-op', () => {
    const s = initialSession(FIELD1);
    expect(sessionReducer(s, runEnd(1))).toBe(s);
    expect(sessionReducer(s, runEnd(0))).toBe(s);
  });
});

describe('session property', () => {
  type Act = { kind: 'swipe'; dir: Dir } | { kind: 'end'; stale: number };
  const actArb: fc.Arbitrary<Act> = fc.oneof(
    fc.record({ kind: fc.constant('swipe' as const), dir: fc.constantFrom(...DIRS) }),
    fc.record({ kind: fc.constant('end' as const), stale: fc.integer({ min: 0, max: 3 }) }),
  );

  it('moves are monotone, buffer implies run, and game is reachable by slide', () => {
    fc.assert(
      fc.property(fc.array(actArb, { maxLength: 30 }), (acts) => {
        let s = initialSession(FIELD1);
        const applied: Dir[] = [];
        for (const act of acts) {
          let action: SessionAction;
          if (act.kind === 'swipe') {
            action = swipe(act.dir);
          } else {
            // stale 0 = the current run's id (or a dangling id when idle); else an old/future id.
            const current = s.run ? s.run.id : s.nextRunId;
            action = runEnd(act.stale === 0 ? current : current - act.stale);
          }
          const prev = s;
          s = sessionReducer(prev, action);

          if (s.game !== prev.game) {
            // Which direction was applied: the swipe itself if idle, else the buffer.
            const dir = action.type === 'swipe' ? action.dir : prev.queued;
            expect(dir).not.toBeNull();
            applied.push(dir!);
          }

          expect(s.game.moves).toBeGreaterThanOrEqual(prev.game.moves);
          expect(s.game.moves - prev.game.moves).toBeLessThanOrEqual(1);
          if (s.run === null) expect(s.queued).toBeNull();

          let replay: State = parseLevel(FIELD1);
          for (const d of applied) {
            const r = slide(replay, 0, d);
            expect(r.moved).toBe(true);
            replay = r.state;
          }
          expect(s.game).toEqual(replay);
          expect(s.game.moves).toBe(applied.length);
        }
      }),
      { numRuns: 300 },
    );
  });
});
