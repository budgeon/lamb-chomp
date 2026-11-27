/// <reference types="jest" />
/**
 * Bug run `sheep-busy-cancel` (PR #2 review N2): the session stays "busy"
 * (`session.run !== null`) until Sheep's withTiming callback dispatches
 * `runEnd`. The report asked whether a cancelled or overwritten animation can
 * skip that dispatch and leave every later swipe buffered forever.
 *
 * What this models: the real `Board` + `Sheep` components and the real
 * `sessionReducer`, rendered with `test-renderer` (jest-expo's own renderer).
 * Reanimated's native entry cannot load in Jest, so `react-native-reanimated`
 * is replaced by a thin module that re-exports Reanimated 4.7.1's own source
 * for every part that decides whether the end callback fires:
 *   - `withTiming` (src/animation/timing.ts) and `Easing`,
 *   - `useSharedValue` (src/hook/useSharedValue.ts: cancels on unmount),
 *   - `makeMutable` from src/mutables.ts, which assigns through the same
 *     `valueSetter` (src/valueSetter.ts) the UI runtime runs on device:
 *     overwriting or cancelling an unfinished animation calls its callback
 *     with `finished === false`; finishing calls it with `true`.
 * Only `Animated.View` (a plain View) and `useAnimatedStyle` (returns an empty
 * style, so nothing reads the shared values) are stubs; neither affects the
 * callback. `react-native-worklets` uses its official Jest mock: `scheduleOnRN`
 * is a microtask instead of a hop to the RN thread. Frames come from Jest's
 * fake timers. Not modelled: app backgrounding (UI frames paused), Gesture
 * Handler, real thread timing.
 */
import { act, useCallback, useEffect, useReducer } from 'react';
import { createRoot } from 'test-renderer';
import type { Root } from 'test-renderer';

import { LEVELS } from '../../game';
import { buildBoardView } from '../../play/boardView';
import { STEP_MS, initialSession, sessionReducer } from '../../play/session';
import type { Session, SessionAction } from '../../play/session';
import { Board } from '../Board';

// jest.mock calls are hoisted above the imports by babel-jest.
// The Reanimated `src/` paths below target react-native-reanimated 4.7.1. An upgrade
// that moves these files fails this suite with "Cannot find module", not with a
// behaviour failure; update the paths when that happens.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
// Jest resolves `.native.ts` first; use Reanimated's single-runtime mutable,
// which calls `valueSetter` directly (the native one does so on the UI runtime).
jest.mock('react-native-reanimated/src/mutables.native.ts', () =>
  jest.requireActual('react-native-reanimated/src/mutables.ts'),
);
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: jest.requireActual('react-native-reanimated/src/Easing.ts').Easing,
    withTiming: jest.requireActual('react-native-reanimated/src/animation/timing.ts').withTiming,
    useSharedValue: jest.requireActual('react-native-reanimated/src/hook/useSharedValue.ts')
      .useSharedValue,
    useAnimatedStyle: () => ({}),
  };
});

const FIELD1 = LEVELS[0];

interface Probe {
  session: Session | null;
  send: ((a: SessionAction) => void) | null;
}
/** Latest committed session and its dispatch, written after each render. */
const probe: Probe = { session: null, send: null };

function Harness({ cell, showBoard }: { cell: number; showBoard: boolean }) {
  const [session, dispatch] = useReducer(sessionReducer, FIELD1, initialSession);
  useEffect(() => {
    probe.session = session;
    probe.send = dispatch;
  });
  // Stable, as in FieldScreen (useCallback over dispatch).
  const onRunEnd = useCallback((runId: number) => dispatch({ type: 'runEnd', runId }), []);
  return showBoard ? (
    <Board board={buildBoardView(session.game)} cell={cell} run={session.run} onRunEnd={onRunEnd} />
  ) : null;
}

let root: Root;

const latest = (): Session => probe.session!;
const render = (cell: number, showBoard = true) =>
  act(async () => root.render(<Harness cell={cell} showBoard={showBoard} />));
const send = (a: SessionAction) => act(async () => probe.send!(a));

/** Advance fake time (UI frames), then let scheduleOnRN microtasks and React settle. */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  probe.session = null;
  probe.send = null;
  root = createRoot();
  await render(40);
});

afterEach(async () => {
  await act(async () => root.unmount());
  jest.useRealTimers();
});

/** First move of field 1's par solution; returns the run it started. */
async function startRun() {
  await send({ type: 'swipe', sheep: 0, dir: 'up' });
  expect(latest().run).not.toBeNull();
  return latest().run!;
}

describe('Sheep run end clears the busy state (sheep-busy-cancel)', () => {
  it('a run that plays to the end clears busy', async () => {
    const run = await startRun();
    await flush(run.cells * STEP_MS + 100);
    expect(latest().run).toBeNull();
  });

  it('a board resize mid-run (animation overwritten) still clears busy, and the next swipe moves', async () => {
    const run = await startRun();
    await flush(STEP_MS / 2); // mid-run: the run needs run.cells * STEP_MS >= 70 ms
    expect(latest().run).toEqual(run);
    // A resize re-runs Sheep's effect with the same run id: it snaps the shared
    // values, which cancels the timing animation (callback(false)). No more
    // time passes, so only that cancel callback can end the run.
    await render(33);
    await flush();
    expect(latest().run).toBeNull();

    const moves = latest().game.moves;
    await send({ type: 'swipe', sheep: 0, dir: 'left' });
    expect(latest().game.moves).toBe(moves + 1);
  });

  it('a swipe buffered mid-run is applied when the run ends', async () => {
    const run = await startRun();
    await flush(STEP_MS / 2);
    await send({ type: 'swipe', sheep: 0, dir: 'left' });
    expect(latest().queued).toBe('left');
    await flush(run.cells * STEP_MS + 100);
    expect(latest().game.moves).toBe(2);
  });

  it('unmounting the board mid-run (useSharedValue cancels the animation) still clears busy', async () => {
    await startRun();
    await flush(STEP_MS / 2);
    await render(40, false);
    await flush();
    expect(latest().run).toBeNull();

    await render(40);
    const moves = latest().game.moves;
    await send({ type: 'swipe', sheep: 0, dir: 'left' });
    expect(latest().game.moves).toBe(moves + 1);
  });
});
