/// <reference types="jest" />
/**
 * The Undo / Restart bar and the flowerbed fail message (layout A).
 *
 * What this models: the real FieldScreen, the real session reducer and the real
 * RNGH v3 `usePanGesture` callback pipeline, driven by RNGH's Jest controller plus
 * the per-finger touch events (same setup as FieldScreen.multitouch.test.tsx).
 * Buttons are pressed through the host view's `onClick`, the Pressability handler
 * an accessibility activation goes through; it honours `disabled` like a tap does.
 * What it cannot model: the run animation (Sheep is replaced by a plain view that
 * records the run it was given, so a test ends the run by hand), the native touch
 * system and real layout.
 */
import 'react-native-gesture-handler/jestSetup';

import { act } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot } from 'test-renderer';
import type { Root, TestInstance } from 'test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { TouchData, usePanGesture as UsePanGesture } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LEVELS } from '../../game';
import type { Dir, Level } from '../../game';
import type { Run } from '../../play/session';
import { palette } from '../../theme/palette';
import { FieldScreen } from '../FieldScreen';

// Capture the pan gesture FieldScreen creates, without changing it.
let capturedPan: ReturnType<typeof UsePanGesture> | null = null;
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const usePanGesture = (config: unknown) => {
    const g = actual.usePanGesture(config) as ReturnType<typeof UsePanGesture>;
    capturedPan = g;
    return g;
  };
  return new Proxy(actual, {
    get: (target, key) => (key === 'usePanGesture' ? usePanGesture : target[key]),
  });
});

// The latest props Board gave sheep 0: its run (null when idle) and the end callback.
const mockSheep: { run: Run | null; onRunEnd: ((id: number) => void) | null } = {
  run: null,
  onRunEnd: null,
};
jest.mock('../Sheep', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Sheep: ({
      view,
      run,
      onRunEnd,
    }: {
      view: { testID: string; label: string };
      run: Run | null;
      onRunEnd: (id: number) => void;
    }) => {
      if (view.testID === 'sheep-0') {
        mockSheep.run = run;
        mockSheep.onRunEnd = onRunEnd;
      }
      return <View testID={view.testID} accessibilityLabel={view.label} />;
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const metrics = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

let root: Root;

function queryTestID(id: string, under?: TestInstance): TestInstance[] {
  return (under ?? root.container).queryAll((n) => n.props.testID === id);
}

function byTestID(id: string): TestInstance {
  const found = queryTestID(id);
  if (found.length === 0) throw new Error(`no element with testID ${id}`);
  return found[0];
}

function textOf(id: string): string {
  const parts: string[] = [];
  const walk = (n: TestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(byTestID(id));
  return parts.join('');
}

const label = (id: string): string => byTestID(id).props.accessibilityLabel;
const flatStyle = (id: string) => StyleSheet.flatten(byTestID(id).props.style);

// TouchEventType values from RNGH: DOWN 1, MOVE 2, UP 3.
const TOUCHES_DOWN = 1;
const TOUCHES_MOVE = 2;
const TOUCHES_UP = 3;

function finger(id: number, absoluteX: number, absoluteY: number): TouchData {
  return { id, x: absoluteX, y: absoluteY, absoluteX, absoluteY };
}

function touches(eventType: number, changedTouches: TouchData[], allTouches: TouchData[]) {
  const handler = capturedPan!.detectorCallbacks.jsEventHandler as (e: unknown) => void;
  handler({
    handlerTag: capturedPan!.handlerTag,
    numberOfTouches: allTouches.length,
    state: 0,
    eventType,
    allTouches,
    changedTouches,
    pointerType: 0,
  });
}

const VECTOR: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** A one-finger 40 pt swipe on the paddock (copied from the multitouch test's control case). */
function swipe(dir: Dir) {
  const [dx, dy] = VECTOR[dir];
  const pan = createGestureController(capturedPan!);
  const at = (d: number) => finger(0, 200 + dx * d, 300 + dy * d);
  act(() => {
    touches(TOUCHES_DOWN, [at(0)], [at(0)]);
    pan.begin({ absoluteX: at(0).absoluteX, absoluteY: at(0).absoluteY });
    touches(TOUCHES_MOVE, [at(16)], [at(16)]);
    pan.activate({ absoluteX: at(16).absoluteX, absoluteY: at(16).absoluteY });
    touches(TOUCHES_MOVE, [at(40)], [at(40)]);
    pan.update({ absoluteX: at(40).absoluteX, absoluteY: at(40).absoluteY });
    touches(TOUCHES_UP, [at(40)], [at(40)]);
    pan.end({ absoluteX: at(40).absoluteX, absoluteY: at(40).absoluteY });
  });
}

/** Ends the run sheep 0 is playing, as Sheep's animation callback would. */
function endRun() {
  const run = mockSheep.run;
  if (!run) throw new Error('no run to end');
  act(() => mockSheep.onRunEnd!(run.id));
}

/** Activates a button the way Pressability handles a click (target is the button itself). */
function press(id: string) {
  const host = byTestID(id);
  act(() => host.props.onClick({ currentTarget: host, target: host, nativeEvent: {} }));
}

/**
 * Both halves of "disabled": what VoiceOver and Maestro read (`accessibilityState`)
 * and whether Pressability ignores presses (its config's `disabled`, read through
 * React Native's test-only hook on the host view).
 */
function expectDisabled(id: string, disabled: boolean) {
  const host = byTestID(id);
  expect(host.props.accessibilityState?.disabled === true).toBe(disabled);
  const config = host.props.onStartShouldSetResponder.testOnly_pressabilityConfig();
  expect(config.disabled === true).toBe(disabled);
}

function mount(level: Level, index: number) {
  act(() => {
    root.render(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={metrics}>
          <FieldScreen level={level} index={index} />
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  act(() => {
    byTestID('paddock').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 400 } },
    });
  });
}

beforeEach(() => {
  capturedPan = null;
  mockSheep.run = null;
  mockSheep.onRunEnd = null;
  root = createRoot({ textComponentTypes: ['Text', 'RCTText'] });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('FieldScreen controls', () => {
  it('AC10: Undo and Restart are disabled at launch, enabled after a move; Undo steps back; Restart disables both', () => {
    mount(LEVELS[0], 0);
    expectDisabled('undo-button', true);
    expectDisabled('restart-button', true);
    expect(byTestID('undo-button').props.accessibilityRole).toBe('button');
    expect(label('undo-button')).toBe('Undo');
    expect(label('restart-button')).toBe('Restart field');

    // A press on a disabled button does nothing.
    press('undo-button');
    press('restart-button');
    expect(textOf('moves-count')).toBe('0');

    swipe('up');
    endRun();
    expect(textOf('moves-count')).toBe('1');
    expectDisabled('undo-button', false);
    expectDisabled('restart-button', false);

    press('undo-button');
    expect(textOf('moves-count')).toBe('0');
    expect(label('sheep-0')).toBe('Sheep, column 4, row 3');
    expect(label('cell-3-1')).toBe('grass, column 4, row 2');
    expectDisabled('undo-button', true);
    expectDisabled('restart-button', true);

    swipe('up');
    endRun();
    expectDisabled('restart-button', false);
    press('restart-button');
    expect(textOf('moves-count')).toBe('0');
    expect(label('sheep-0')).toBe('Sheep, column 4, row 3');
    expectDisabled('undo-button', true);
    expectDisabled('restart-button', true);
  });

  it('AC4: the fail message replaces the hint only after the fatal run ends, and Undo turns primary', () => {
    expect(LEVELS[4].id).toBe('field-05');
    mount(LEVELS[4], 4);
    swipe('right');
    endRun();
    swipe('up');
    // The fatal move is committed but the sheep is still running into the flowerbed.
    expect(textOf('moves-count')).toBe('2');
    expect(mockSheep.run).not.toBeNull();
    expect(queryTestID('field-failed')).toHaveLength(0);
    expect(queryTestID('field-hint')).toHaveLength(1);
    expect(flatStyle('undo-button').backgroundColor).not.toBe(palette.butter);

    endRun();
    expect(queryTestID('field-failed')).toHaveLength(1);
    expect(textOf('field-failed')).toContain('Flowers trampled');
    expect(textOf('field-failed')).toContain('Undo that run or restart the field.');
    expect(queryTestID('field-hint')).toHaveLength(0);
    expect(flatStyle('undo-button').backgroundColor).toBe(palette.butter);
    expect(flatStyle('restart-button').backgroundColor).not.toBe(palette.butter);

    // Undo leaves the fail state: the hint is back and Undo is no longer primary.
    press('undo-button');
    expect(textOf('moves-count')).toBe('1');
    expect(queryTestID('field-failed')).toHaveLength(0);
    expect(queryTestID('field-hint')).toHaveLength(1);
    expect(flatStyle('undo-button').backgroundColor).not.toBe(palette.butter);
  });

  it('AC14: each button is at least 44 pt tall', () => {
    mount(LEVELS[0], 0);
    for (const id of ['undo-button', 'restart-button']) {
      const s = flatStyle(id);
      expect(Math.max(Number(s.height ?? 0), Number(s.minHeight ?? 0))).toBeGreaterThanOrEqual(44);
    }
  });

  it('AC15: the bar is outside the swipe area, and pressing a button mid-run never starts a run', () => {
    mount(LEVELS[0], 0);
    const paddock = byTestID('paddock');
    for (const id of ['controls', 'undo-button', 'restart-button']) {
      expect(queryTestID(id)).toHaveLength(1);
      expect(queryTestID(id, paddock)).toHaveLength(0);
    }

    swipe('up'); // the run is still going
    expect(textOf('moves-count')).toBe('1');
    expect(mockSheep.run).not.toBeNull();
    press('undo-button');
    expect(textOf('moves-count')).toBe('0');
    expect(mockSheep.run).toBeNull();
    press('restart-button');
    expect(textOf('moves-count')).toBe('0');
    expect(mockSheep.run).toBeNull();

    // The same mid-run case with Restart.
    swipe('up');
    expect(mockSheep.run).not.toBeNull();
    press('restart-button');
    expect(textOf('moves-count')).toBe('0');
    expect(mockSheep.run).toBeNull();
    expect(label('sheep-0')).toBe('Sheep, column 4, row 3');
  });
});
