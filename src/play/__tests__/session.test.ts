/// <reference types="jest" />
import * as fc from 'fast-check';

import { DIRS, LEVELS, isCleared, parseLevel, slide } from '../../game';
import type { Dir, Level, State } from '../../game';
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

// ---------------------------------------------------------------------------
// Flowerbed fail, undo and restart
// ---------------------------------------------------------------------------

const FIELD5 = LEVELS[4];
const undo: SessionAction = { type: 'undo' };
const restart: SessionAction = { type: 'restart' };

/** Cell index on field-05 (width 6), 0-based column and row. */
const F5 = (col: number, row: number) => row * 6 + col;
const FLOWERBED = F5(5, 4); // column 6, row 5 (cell-5-4)

function playOn(level: Level, dirs: Dir[]): Session {
  return dirs.reduce(swipeAndSettle, initialSession(level));
}

describe('flowerbed fail (AC1, AC2)', () => {
  it('field-05 is the flowerbed field', () => {
    expect(FIELD5.id).toBe('field-05');
    expect(parseLevel(FIELD5).cells[FLOWERBED]).toBe('f');
  });

  it('AC1: RIGHT then UP runs into the flowerbed and fails the field', () => {
    const s = playOn(FIELD5, ['right', 'up']);
    expect(s.game.failed).toBe(true);
    expect(s.game.trampled).toBe(4 * 6 + 5);
    expect(s.game.sheep[0]).toBe(FLOWERBED);
    expect(s.game.moves).toBe(2);
    expect(s.run).toBeNull();
    expect(s.queued).toBeNull();
    expect(isCleared(s.game)).toBe(false);
  });

  it('AC2: every swipe on a failed field returns the same session object', () => {
    const failed = playOn(FIELD5, ['right', 'up']);
    for (const dir of DIRS) {
      const next = sessionReducer(failed, swipe(dir));
      expect(next).toBe(failed);
      expect(next.game.moves).toBe(2);
    }
  });

  it('AC2: a swipe queued during the fatal run is dropped at runEnd', () => {
    let s = playOn(FIELD5, ['right']);
    s = sessionReducer(s, swipe('up')); // the fatal run is playing
    expect(s.game.failed).toBe(true);
    const fatalRun = s.run!;
    expect(fatalRun).not.toBeNull();
    s = sessionReducer(s, swipe('left'));
    expect(s.queued).toBe('left');
    s = sessionReducer(s, runEnd(fatalRun.id));
    expect(s.queued).toBeNull();
    expect(s.run).toBeNull();
    expect(s.game.moves).toBe(2);
    expect(s.game.sheep[0]).toBe(FLOWERBED);
  });
});

describe('undo (AC6, AC7, AC8, AC9)', () => {
  it('starts with an empty history and keeps the start state', () => {
    const s = initialSession(FIELD1);
    expect(s.history).toEqual([]);
    expect(s.start).toEqual(parseLevel(FIELD1));
    expect(s.game).toBe(s.start);
  });

  it('undo with an empty history returns the same session object', () => {
    const s = initialSession(FIELD1);
    expect(sessionReducer(s, undo)).toBe(s);
  });

  it('AC6: undoing k moves after n gives the state after n - k moves', () => {
    const states: State[] = [];
    let s = initialSession(FIELD1);
    states.push(s.game);
    for (const dir of PAR_SOLUTION) {
      s = swipeAndSettle(s, dir);
      states.push(s.game);
    }
    const n = PAR_SOLUTION.length;
    expect(s.game.moves).toBe(n);
    for (let k = 1; k <= n; k++) {
      let u = playAll(PAR_SOLUTION);
      for (let i = 0; i < k; i++) u = sessionReducer(u, undo);
      expect(u.game).toEqual(states[n - k]);
      expect(u.game.moves).toBe(n - k);
      expect(u.history).toHaveLength(n - k);
    }
  });

  it('AC7: undo after the fail brings back the move before it, and play goes on', () => {
    const failed = playOn(FIELD5, ['right', 'up']);
    const s = sessionReducer(failed, undo);
    expect(s.game.moves).toBe(1);
    expect(s.game.sheep[0]).toBe(5 * 6 + 5); // column 6, row 6
    expect(s.game.failed).toBe(false);
    expect(s.game.trampled).toBe(-1);
    expect(s.run).toBeNull();
    expect(s.queued).toBeNull();

    const next = swipeAndSettle(s, 'left');
    expect(next.game.moves).toBe(2);
    expect(next.game.failed).toBe(false);
  });

  it('AC8: undo during a run with a queued swipe cancels both (H3)', () => {
    const s1 = sessionReducer(initialSession(FIELD1), swipe('up'));
    const runA = s1.run!;
    expect(runA).not.toBeNull();
    const s2 = sessionReducer(s1, swipe('left'));
    expect(s2.queued).toBe('left');

    const u = sessionReducer(s2, undo);
    expect(u.run).toBeNull();
    expect(u.queued).toBeNull();
    expect(u.game).toEqual(parseLevel(FIELD1));
    expect(u.nextRunId).toBe(s2.nextRunId);

    // The cancelled run's late runEnd is ignored: no buffered swipe, board unchanged.
    expect(sessionReducer(u, runEnd(runA.id))).toBe(u);

    const next = sessionReducer(u, swipe('up'));
    expect(next.run).not.toBeNull();
    expect(next.run!.id).not.toBe(runA.id);
  });

  it('AC8: restart during a run with a queued swipe cancels both (H3)', () => {
    const s1 = sessionReducer(initialSession(FIELD1), swipe('up'));
    const runA = s1.run!;
    expect(runA).not.toBeNull();
    const s2 = sessionReducer(s1, swipe('left'));
    expect(s2.queued).toBe('left');

    const r = sessionReducer(s2, restart);
    expect(r.run).toBeNull();
    expect(r.queued).toBeNull();
    expect(r.game).toEqual(parseLevel(FIELD1));
    expect(r.nextRunId).toBe(s2.nextRunId);

    expect(sessionReducer(r, runEnd(runA.id))).toBe(r);

    const next = sessionReducer(r, swipe('up'));
    expect(next.run).not.toBeNull();
    expect(next.run!.id).not.toBe(runA.id);
  });

  it('AC9: undo after a cleared field, then the last par move clears it again', () => {
    const cleared = playAll(PAR_SOLUTION);
    expect(isCleared(cleared.game)).toBe(true);
    const u = sessionReducer(cleared, undo);
    expect(u.game.moves).toBe(4);
    expect(isCleared(u.game)).toBe(false);

    const again = swipeAndSettle(u, 'up');
    expect(isCleared(again.game)).toBe(true);
    expect(again.game.moves).toBe(5);
  });
});

describe('restart (AC12)', () => {
  function expectRestarted(level: Level, firstDir: Dir, before: Session): Session {
    const r = sessionReducer(before, restart);
    expect(r.game).toEqual(parseLevel(level));
    expect(r.history).toEqual([]);
    expect(r.run).toBeNull();
    expect(r.queued).toBeNull();
    expect(r.nextRunId).toBeGreaterThanOrEqual(before.nextRunId);

    // nextRunId is never reset: the next run gets the id that was next before.
    const next = sessionReducer(r, swipe(firstDir));
    expect(next.run).not.toBeNull();
    expect(next.run!.id).toBe(before.nextRunId);
    return r;
  }

  it('from idle after two moves', () => {
    const s = playAll(['up', 'left']);
    expect(s.game.moves).toBe(2);
    expectRestarted(FIELD1, 'up', s);
  });

  it('from a running session with a queued swipe', () => {
    let s = playAll(['up']);
    s = sessionReducer(s, swipe('left'));
    s = sessionReducer(s, swipe('down'));
    expect(s.run).not.toBeNull();
    expect(s.queued).toBe('down');
    expectRestarted(FIELD1, 'up', s);
  });

  it('from the failed field-05', () => {
    const s = playOn(FIELD5, ['right', 'up']);
    expect(s.game.failed).toBe(true);
    const r = expectRestarted(FIELD5, 'right', s);
    expect(r.game.sheep[0]).toBe(F5(4, 5)); // column 5, row 6
  });

  it('from a cleared field 1', () => {
    const s = playAll(PAR_SOLUTION);
    expect(isCleared(s.game)).toBe(true);
    expectRestarted(FIELD1, 'up', s);
  });

  it('restart on a fresh session returns the same session object', () => {
    const s = initialSession(FIELD1);
    expect(sessionReducer(s, restart)).toBe(s);
  });
});

describe('undo and restart property (AC6, AC12, H3)', () => {
  type Act =
    | { kind: 'swipe'; dir: Dir; sheep: number }
    | { kind: 'end'; stale: number }
    | { kind: 'undo' }
    | { kind: 'restart' };

  const actArb = (sheepCount: number): fc.Arbitrary<Act> =>
    fc.oneof(
      {
        weight: 4,
        arbitrary: fc.record({
          kind: fc.constant('swipe' as const),
          dir: fc.constantFrom(...DIRS),
          sheep: fc.integer({ min: 0, max: sheepCount - 1 }),
        }),
      },
      {
        weight: 3,
        arbitrary: fc.record({ kind: fc.constant('end' as const), stale: fc.integer({ min: 0, max: 3 }) }),
      },
      { weight: 2, arbitrary: fc.constant({ kind: 'undo' as const }) },
      { weight: 1, arbitrary: fc.constant({ kind: 'restart' as const }) },
    );

  it.each(LEVELS.map((l) => [l.id, l] as const))(
    '%s: undo pops exactly the state before the last counted move',
    (_id, level) => {
      const sheepCount = parseLevel(level).sheep.length;
      fc.assert(
        fc.property(fc.array(actArb(sheepCount), { maxLength: 40 }), (acts) => {
          let s = initialSession(level);
          const model: State[] = [];
          for (const act of acts) {
            let action: SessionAction;
            if (act.kind === 'swipe') {
              action = swipe(act.dir, act.sheep);
            } else if (act.kind === 'end') {
              // stale 0 = the current run's id (or a dangling id when idle); else an old id.
              const current = s.run ? s.run.id : s.nextRunId;
              action = runEnd(act.stale === 0 ? current : current - act.stale);
            } else {
              action = { type: act.kind };
            }

            const prev = s;
            s = sessionReducer(prev, action);

            if (action.type === 'undo') {
              if (model.length === 0) {
                expect(s).toBe(prev);
              } else {
                expect(s.game).toEqual(model.pop());
                expect(s.run).toBeNull();
                expect(s.queued).toBeNull();
              }
            } else if (action.type === 'restart') {
              if (model.length === 0) expect(s).toBe(prev);
              model.length = 0;
              expect(s.game).toEqual(parseLevel(level));
            } else if (s.game.moves > prev.game.moves) {
              model.push(prev.game);
            }

            expect(s.history).toHaveLength(model.length);
            expect(s.game.moves).toBe(model.length);
            if (s.run === null) expect(s.queued).toBeNull();
            expect(s.nextRunId).toBeGreaterThanOrEqual(prev.nextRunId);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
