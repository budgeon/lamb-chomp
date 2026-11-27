/// <reference types="jest" />
/**
 * Regression test: a second finger landing mid-swipe must not misdirect the swipe.
 *
 * React Native Gesture Handler reports `absoluteX/absoluteY` as the centroid of all
 * pointers on the pan (iOS: UIKit `locationInView:`; Android: `lastAbsolutePositionX`
 * averages every pointer). FieldScreen measures the swipe from the `onBegin` absolute
 * position to the `onDeactivate` absolute position, so a second pointer moves the end
 * point toward itself.
 *
 * What this models: the real FieldScreen and the real RNGH v3 `usePanGesture` callback
 * pipeline, driven by RNGH's own Jest controller with events whose `absoluteX/Y` are
 * what the native handler reports when a second finger lands. The fix measures the
 * first finger by touch id, so each case also sends the per-finger touch events the
 * native handler sends (`onTouchesDown/Move/Up`), through the pan's real JS event
 * handler. RNGH's controller has no touch-event method, hence `touches()` below.
 * What it cannot model: the native recognizer itself (activation thresholds, real
 * pointer timing, the exact order of touch and state events). Activation is driven by
 * the test.
 */
import 'react-native-gesture-handler/jestSetup';

import { act } from 'react';
import { createRoot } from 'test-renderer';
import type { Root, TestInstance } from 'test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { TouchData, usePanGesture as UsePanGesture } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LEVELS } from '../../game';
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
  // A proxy, not a spread, so deprecated getters on the module are not touched.
  return new Proxy(actual, {
    get: (target, key) => (key === 'usePanGesture' ? usePanGesture : target[key]),
  });
});

// The sheep's run animation (Reanimated) is not under test. Replace it with a plain
// view that keeps the committed position in its accessibility label.
jest.mock('../Sheep', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Sheep: ({ view }: { view: { testID: string; label: string } }) => (
      <View testID={view.testID} accessibilityLabel={view.label} />
    ),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const metrics = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

let root: Root;

function byTestID(id: string): TestInstance {
  const found = root.container.queryAll((n) => n.props.testID === id);
  if (found.length === 0) throw new Error(`no element with testID ${id}`);
  return found[0];
}

function sheepLabel(): string {
  return byTestID('sheep-0').props.accessibilityLabel;
}

function textOf(id: string): string {
  return String(byTestID(id).children.join(''));
}

// TouchEventType values from RNGH: DOWN 1, MOVE 2, UP 3.
const TOUCHES_DOWN = 1;
const TOUCHES_MOVE = 2;
const TOUCHES_UP = 3;

function finger(id: number, absoluteX: number, absoluteY: number): TouchData {
  return { id, x: absoluteX, y: absoluteY, absoluteX, absoluteY };
}

// Sends one native touch event (the shape RNGH's native side emits) to the pan's
// JS event handler, which routes it to onTouchesDown/Move/Up.
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

beforeEach(() => {
  capturedPan = null;
  root = createRoot({ textComponentTypes: ['Text', 'RCTText'] });
  act(() => {
    root.render(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={metrics}>
          <FieldScreen level={LEVELS[0]} index={0} />
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  // Give the paddock a size so the board (and the sheep's label) render.
  act(() => {
    byTestID('paddock').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 400 } },
    });
  });
});

afterEach(() => {
  act(() => root.unmount());
});

// Field 1: the sheep starts on column 4, row 3. Right runs it to column 5;
// down would run it to row 5 ('Sheep, column 4, row 5').
const START = 'Sheep, column 4, row 3';
const AFTER_RIGHT = 'Sheep, column 5, row 3';
const AFTER_DOWN = 'Sheep, column 4, row 5';

describe('FieldScreen pan with a second pointer', () => {
  it('control: a one-finger 40 pt right swipe moves the sheep right', () => {
    expect(sheepLabel()).toBe(START);
    const pan = createGestureController(capturedPan!);
    act(() => {
      touches(TOUCHES_DOWN, [finger(0, 200, 400)], [finger(0, 200, 400)]);
      pan.begin({ absoluteX: 200, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 216, 400)], [finger(0, 216, 400)]);
      pan.activate({ absoluteX: 216, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.update({ absoluteX: 240, absoluteY: 400 });
      touches(TOUCHES_UP, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.end({ absoluteX: 240, absoluteY: 400 });
    });
    expect(textOf('moves-count')).toBe('1');
    expect(sheepLabel()).toBe(AFTER_RIGHT);
  });

  it('a second finger landing 200 pt below mid-swipe does not turn a right swipe into down', () => {
    expect(sheepLabel()).toBe(START);
    const pan = createGestureController(capturedPan!);
    act(() => {
      // Finger 1 touches down and swipes 40 pt right.
      touches(TOUCHES_DOWN, [finger(0, 200, 400)], [finger(0, 200, 400)]);
      pan.begin({ absoluteX: 200, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 216, 400)], [finger(0, 216, 400)]);
      pan.activate({ absoluteX: 216, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.update({ absoluteX: 240, absoluteY: 400 });
      // Finger 2 lands at (200, 600). RNGH now reports the centroid of both pointers.
      touches(TOUCHES_DOWN, [finger(1, 200, 600)], [finger(0, 240, 400), finger(1, 200, 600)]);
      pan.update({ absoluteX: 220, absoluteY: 500 });
      // Both fingers lift together; the end event carries the same centroid.
      touches(
        TOUCHES_UP,
        [finger(0, 240, 400), finger(1, 200, 600)],
        [finger(0, 240, 400), finger(1, 200, 600)],
      );
      pan.end({ absoluteX: 220, absoluteY: 500 });
    });
    // Finger 1 swiped right, so the sheep should have run right.
    expect(sheepLabel()).toBe(AFTER_RIGHT);
  });

  it('finger 1 lifting first while finger 2 stays down still swipes right', () => {
    const pan = createGestureController(capturedPan!);
    act(() => {
      touches(TOUCHES_DOWN, [finger(0, 200, 400)], [finger(0, 200, 400)]);
      pan.begin({ absoluteX: 200, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 216, 400)], [finger(0, 216, 400)]);
      pan.activate({ absoluteX: 216, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.update({ absoluteX: 240, absoluteY: 400 });
      touches(TOUCHES_DOWN, [finger(1, 200, 600)], [finger(0, 240, 400), finger(1, 200, 600)]);
      pan.update({ absoluteX: 220, absoluteY: 500 });
      // Finger 1 lifts; only finger 2 remains, so RNGH reports finger 2's position.
      touches(TOUCHES_UP, [finger(0, 240, 400)], [finger(0, 240, 400), finger(1, 200, 600)]);
      pan.update({ absoluteX: 200, absoluteY: 600 });
      touches(TOUCHES_MOVE, [finger(1, 200, 640)], [finger(1, 200, 640)]);
      pan.update({ absoluteX: 200, absoluteY: 640 });
      touches(TOUCHES_UP, [finger(1, 200, 640)], [finger(1, 200, 640)]);
      pan.end({ absoluteX: 200, absoluteY: 640 });
    });
    expect(sheepLabel()).toBe(AFTER_RIGHT);
  });

  it('a later finger reusing finger 1\'s id after it lifted does not move the end point', () => {
    const pan = createGestureController(capturedPan!);
    act(() => {
      touches(TOUCHES_DOWN, [finger(0, 200, 400)], [finger(0, 200, 400)]);
      pan.begin({ absoluteX: 200, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 216, 400)], [finger(0, 216, 400)]);
      pan.activate({ absoluteX: 216, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.update({ absoluteX: 240, absoluteY: 400 });
      touches(TOUCHES_DOWN, [finger(1, 200, 600)], [finger(0, 240, 400), finger(1, 200, 600)]);
      touches(TOUCHES_UP, [finger(0, 240, 400)], [finger(0, 240, 400), finger(1, 200, 600)]);
      // A new finger lands far below and gets id 0 again (Android reuses pointer ids).
      touches(TOUCHES_DOWN, [finger(0, 240, 700)], [finger(1, 200, 600), finger(0, 240, 700)]);
      touches(TOUCHES_MOVE, [finger(0, 240, 720)], [finger(1, 200, 600), finger(0, 240, 720)]);
      touches(
        TOUCHES_UP,
        [finger(1, 200, 600), finger(0, 240, 720)],
        [finger(1, 200, 600), finger(0, 240, 720)],
      );
      pan.end({ absoluteX: 220, absoluteY: 660 });
    });
    expect(sheepLabel()).toBe(AFTER_RIGHT);
  });

  it('a cancelled pan dispatches nothing, and the next swipe starts fresh', () => {
    const pan = createGestureController(capturedPan!);
    act(() => {
      touches(TOUCHES_DOWN, [finger(0, 200, 400)], [finger(0, 200, 400)]);
      pan.begin({ absoluteX: 200, absoluteY: 400 });
      touches(TOUCHES_MOVE, [finger(0, 240, 400)], [finger(0, 240, 400)]);
      pan.activate({ absoluteX: 240, absoluteY: 400 });
      pan.cancel({ absoluteX: 240, absoluteY: 400 });
    });
    expect(textOf('moves-count')).toBe('0');
    expect(sheepLabel()).toBe(START);

    // A new one-finger down swipe with a different id must be measured on its own,
    // not from the cancelled pan's leftover finger (which had moved right).
    act(() => {
      touches(TOUCHES_DOWN, [finger(5, 100, 300)], [finger(5, 100, 300)]);
      pan.begin({ absoluteX: 100, absoluteY: 300 });
      touches(TOUCHES_MOVE, [finger(5, 100, 340)], [finger(5, 100, 340)]);
      pan.activate({ absoluteX: 100, absoluteY: 340 });
      touches(TOUCHES_UP, [finger(5, 100, 340)], [finger(5, 100, 340)]);
      pan.end({ absoluteX: 100, absoluteY: 340 });
    });
    expect(textOf('moves-count')).toBe('1');
    expect(sheepLabel()).toBe(AFTER_DOWN);
  });
});
