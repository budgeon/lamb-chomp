/// <reference types="jest" />
/**
 * App with saved progress (AC7, AC10, AC11, and the App half of AC6/AC8): the
 * launch rule, Next, the field list (L1) over the field screen, and saving after
 * each clear.
 *
 * What this models: the real App, FieldScreen, FieldList, session reducer and
 * RNGH v3 pan pipeline (harness from FieldScreen.progress.test.tsx), with the
 * save file replaced by a real `createProgressStore` over an in-memory IO whose
 * starting text each test sets, and `Settings.get` stubbed for `startField`.
 * What it cannot model: the run animation (Sheep is a plain view and each run is
 * ended by hand), native hit-testing (that the list's overlay keeps touches off
 * the paddock; the `active` guard is what is proved here), real layout and the
 * real file. Maestro covers those on device.
 */
import 'react-native-gesture-handler/jestSetup';

import { act } from 'react';
import { Settings } from 'react-native';
import { createRoot } from 'test-renderer';
import type { Root, TestInstance } from 'test-renderer';
import type { TouchData, usePanGesture as UsePanGesture } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import App from '../../../App';
import { LEVELS } from '../../game';
import type { Dir } from '../../game';
import { buildBoardView } from '../../play/boardView';
import { parseProgress, serializeProgress } from '../../play/progress';
import type { Progress } from '../../play/progress';
import { initialSession } from '../../play/session';
import type { Run } from '../../play/session';

// jest-expo registers no native SettingsManager, so `Settings` (Settings.ios.js)
// can't load. Give it an empty NSUserDefaults; each test then stubs `Settings.get`.
jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  __esModule: true,
  default: { getConstants: () => ({ settings: {} }), setValues: jest.fn(), deleteValues: jest.fn() },
}));

// The real SafeAreaProvider renders nothing until it has native window metrics.
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// The save file: a fresh store per test over `mockFile`, so `expo-file-system`
// never loads. The getter is read when App uses the store, after beforeEach.
const mockFile: { text: string | null; writes: string[]; store: unknown } = {
  text: null,
  writes: [],
  store: null,
};
jest.mock('../../save/progressFile', () => ({
  get progressStore() {
    return mockFile.store;
  },
}));

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

let root: Root;

function queryTestID(id: string): TestInstance[] {
  return root.container.queryAll((n) => n.props.testID === id);
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
const present = (id: string) => queryTestID(id).length > 0;

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

/** A one-finger 40 pt swipe through the field screen's pan. */
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

function endRun() {
  const run = mockSheep.run;
  if (!run) throw new Error('no run to end');
  act(() => mockSheep.onRunEnd!(run.id));
}

const LETTER: Record<string, Dir> = { U: 'up', D: 'down', L: 'left', R: 'right' };

function play(moves: string) {
  for (const m of moves) {
    swipe(LETTER[m]);
    endRun();
  }
}

/** Activates a button the way Pressability handles a click (target is the button itself). */
function press(id: string) {
  const host = byTestID(id);
  act(() => host.props.onClick({ currentTarget: host, target: host, nativeEvent: {} }));
}

/** Gives the (newly mounted) paddock a size, so the board renders. */
function layoutPaddock() {
  act(() => {
    byTestID('paddock').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 400 } },
    });
  });
}

/** Mounts App over a save holding `saved` (null: no file) with `startField` as given. */
function launch(saved: string | null, startField?: unknown) {
  mockFile.text = saved;
  jest.spyOn(Settings, 'get').mockImplementation((key: string) =>
    key === 'startField' ? startField : undefined,
  );
  act(() => {
    root.render(<App />);
  });
  if (present('paddock')) layoutPaddock();
}

const savedProgress = (): Progress => parseProgress(mockFile.text).progress;
const startLabel = (index: number) =>
  buildBoardView(initialSession(LEVELS[index]).game).sheep[0].label;

const FIELD_1_CLEARED: Progress = {
  version: 1,
  coins: 25,
  fields: { 'field-01': { stars: 3, badge: true, bestMoves: 5 } },
};

beforeEach(() => {
  capturedPan = null;
  mockSheep.run = null;
  mockSheep.onRunEnd = null;
  mockFile.text = null;
  mockFile.writes = [];
  const { createProgressStore } = jest.requireActual('../../save/progressStore');
  mockFile.store = createProgressStore({
    read: () => mockFile.text,
    write: (text: string) => {
      mockFile.writes.push(text);
      mockFile.text = text;
    },
    backupCorrupt: () => {},
  });
  root = createRoot({ textComponentTypes: ['Text', 'RCTText'] });
});

afterEach(() => {
  act(() => root.unmount());
  jest.restoreAllMocks();
});

describe('App launch (AC11)', () => {
  it('with no save, opens field 1', () => {
    launch(null);
    expect(textOf('field-title')).toBe('Field 1');
    expect(present('field-list')).toBe(false);
  });

  it('with field 1 cleared, opens field 2', () => {
    launch(serializeProgress(FIELD_1_CLEARED));
    expect(textOf('field-title')).toBe('Field 2');
    expect(textOf('moves-count')).toBe('0');
    expect(label('sheep-0')).toBe(startLabel(1));
  });

  it('with every field cleared, opens the field list (field 1 under it)', () => {
    const all: Progress = { version: 1, coins: 0, fields: {} };
    for (const l of LEVELS) all.fields[l.id] = { stars: 1, badge: false, bestMoves: l.par * 4 };
    launch(serializeProgress(all));
    expect(present('field-list')).toBe(true);
    press('field-list-back');
    expect(present('field-list')).toBe(false);
    expect(textOf('field-title')).toBe('Field 1');
  });

  it('startField 5 with no save opens the locked field 5 and writes nothing until a clear', () => {
    launch(null, 5);
    expect(textOf('field-title')).toBe('Field 5');
    expect(textOf('moves-count')).toBe('0');
    play('U');
    expect(textOf('moves-count')).toBe('1');
    expect(mockFile.writes).toHaveLength(0);
    expect(mockFile.text).toBeNull();
  });
});

describe('App clear, save and Next (AC6, AC7, AC8)', () => {
  it('a clear is saved; Next opens field 2 with a fresh session', () => {
    launch(null);
    play('ULDRU');
    expect(textOf('clear-coins')).toBe('+25 coins');
    expect(mockFile.writes).toHaveLength(1);
    expect(savedProgress()).toEqual(FIELD_1_CLEARED);

    press('next-field-button');
    layoutPaddock();
    expect(textOf('field-title')).toBe('Field 2');
    expect(textOf('moves-count')).toBe('0');
    expect(present('field-cleared')).toBe(false);
    expect(label('sheep-0')).toBe(startLabel(1));
  });

  it('undo and the same clear again pays nothing; the saved coins stay 25', () => {
    launch(null);
    play('ULDRU');
    press('undo-button');
    play('U');
    expect(present('field-cleared')).toBe(true);
    expect(present('clear-coins')).toBe(false);
    expect(savedProgress()).toEqual(FIELD_1_CLEARED);
  });

  it('field 7 (via startField) cleared at par: Next opens field 8, and the save records field 7', () => {
    launch(null, 7);
    play('LDRURDLRUDLD');
    expect(label('clear-stars')).toBe('3 of 3 stars');
    expect(present('clear-badge')).toBe(true);
    expect(savedProgress().fields).toEqual({ 'field-07': { stars: 3, badge: true, bestMoves: 12 } });

    press('next-field-button');
    layoutPaddock();
    expect(textOf('field-title')).toBe('Field 8');
    expect(textOf('moves-count')).toBe('0');
    expect(textOf('star-targets')).toBe('3★ ≤ 15 · 2★ ≤ 19');
  });
});

describe('App field list (AC10)', () => {
  it('opens from fields-button over a field in progress; locked tiles are disabled; swipes do nothing; Back keeps the session', () => {
    launch(null);
    play('U');
    expect(textOf('moves-count')).toBe('1');
    const sheepAfterOne = label('sheep-0');

    press('fields-button');
    expect(present('field-list')).toBe(true);
    expect(label('field-tile-1')).toBe('Field 1, not cleared');
    expect(byTestID('field-tile-1').props.accessibilityState).toMatchObject({ disabled: false });
    expect(label('field-tile-2')).toBe('Field 2, locked');
    expect(byTestID('field-tile-2').props.accessibilityState).toMatchObject({ disabled: true });
    expect(textOf('coin-balance')).toBe('0 coins');
    // The covered field screen is hidden from accessibility (Maestro, VoiceOver).
    expect(byTestID('field-view').props.accessibilityElementsHidden).toBe(true);
    expect(byTestID('field-view').props.importantForAccessibility).toBe('no-hide-descendants');

    // A locked tile does not open.
    press('field-tile-2');
    expect(present('field-list')).toBe(true);

    // A swipe reaching the pan while the list is open changes nothing.
    swipe('left');
    expect(mockSheep.run).toBeNull();
    expect(textOf('moves-count')).toBe('1');

    press('field-list-back');
    expect(present('field-list')).toBe(false);
    expect(textOf('field-title')).toBe('Field 1');
    expect(textOf('moves-count')).toBe('1');
    expect(label('sheep-0')).toBe(sheepAfterOne);
    expect(byTestID('field-view').props.accessibilityElementsHidden).toBe(false);

    // And the field plays on after Back.
    play('L');
    expect(textOf('moves-count')).toBe('2');
  });

  it('with field 1 saved: tile labels and coins come from the save, and an open tile opens its field', () => {
    launch(serializeProgress(FIELD_1_CLEARED));
    press('fields-button');
    expect(label('field-tile-1')).toBe("Field 1, 3 of 3 stars, shepherd's best");
    expect(label('field-tile-2')).toBe('Field 2, not cleared');
    expect(byTestID('field-tile-2').props.accessibilityState).toMatchObject({ disabled: false });
    expect(label('field-tile-3')).toBe('Field 3, locked');
    expect(label('coin-balance')).toBe('25 coins');
    expect(textOf('coin-balance')).toBe('25 coins');

    press('field-tile-1');
    layoutPaddock();
    expect(present('field-list')).toBe(false);
    expect(textOf('field-title')).toBe('Field 1');
    expect(textOf('moves-count')).toBe('0');
  });

  it("the card's Fields button opens the list, which shows the new clear and coins", () => {
    launch(null);
    play('ULDRU');
    press('clear-fields-button');
    expect(label('field-tile-1')).toBe("Field 1, 3 of 3 stars, shepherd's best");
    expect(label('field-tile-2')).toBe('Field 2, not cleared');
    expect(textOf('coin-balance')).toBe('25 coins');
  });

  it("tapping the current field's tile restarts it with a fresh session", () => {
    launch(null);
    play('UL');
    expect(textOf('moves-count')).toBe('2');
    press('fields-button');
    press('field-tile-1');
    layoutPaddock();
    expect(present('field-list')).toBe(false);
    expect(textOf('moves-count')).toBe('0');
    expect(label('sheep-0')).toBe(startLabel(0));
  });

  it('nothing is written by opening the list or tiles', () => {
    launch(serializeProgress(FIELD_1_CLEARED));
    press('fields-button');
    press('field-tile-2');
    expect(mockFile.writes).toHaveLength(0);
  });
});
