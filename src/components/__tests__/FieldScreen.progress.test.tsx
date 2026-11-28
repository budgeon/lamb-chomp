/// <reference types="jest" />
/**
 * The field screen's progress half (D7): the "Shepherd's best" caption, the star
 * targets, the saved best, the cleared card (layout C2), recording each clear
 * exactly once, and the `active` guard.
 *
 * What this models: the real FieldScreen, session reducer and RNGH v3 pan pipeline
 * (harness copied from FieldScreen.controls.test.tsx), with `onClear` wired the way
 * App wires it: the real `recordClear` over a `Progress` held in a parent's state,
 * so every save re-renders FieldScreen with a new `onClear` and a new `best`.
 * What it cannot model: the run animation (Sheep is replaced by a plain view, and a
 * test ends each run by hand), the native touch system, real layout and file IO.
 */
import 'react-native-gesture-handler/jestSetup';

import { act, useState } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot } from 'test-renderer';
import type { Root, TestInstance } from 'test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { TouchData, usePanGesture as UsePanGesture } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ECONOMY } from '../../economy/config';
import { LEVELS } from '../../game';
import type { Dir, Level } from '../../game';
import { defaultProgress, recordClear } from '../../play/progress';
import type { ClearOutcome, Progress } from '../../play/progress';
import type { Run } from '../../play/session';
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

/** Every outcome `onClear` returned, in order. */
let clears: ClearOutcome[];
/** The parent's latest saved progress. */
let saved: Progress;

interface HarnessProps {
  level: Level;
  index: number;
  initial: Progress;
  active?: boolean;
  onNext?: () => void;
  onOpenFields: () => void;
}

/** Holds progress the way App does: each clear runs recordClear and stores the result. */
function Harness({ level, index, initial, active, onNext, onOpenFields }: HarnessProps) {
  const [progress, setProgress] = useState(initial);
  const onClear = (moves: number) => {
    const { progress: next, outcome } = recordClear(progress, level, moves, ECONOMY.earn);
    clears.push(outcome);
    saved = next;
    setProgress(next);
    return outcome;
  };
  return (
    <FieldScreen
      level={level}
      index={index}
      best={progress.fields[level.id]}
      onClear={onClear}
      onNext={onNext}
      onOpenFields={onOpenFields}
      active={active}
    />
  );
}

function element(props: HarnessProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={metrics}>
        <Harness {...props} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function mount(level: Level, index: number, extra: Partial<HarnessProps> = {}) {
  const props: HarnessProps = {
    level,
    index,
    initial: defaultProgress(),
    onNext: () => {},
    onOpenFields: () => {},
    ...extra,
  };
  act(() => {
    root.render(element(props));
  });
  act(() => {
    byTestID('paddock').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 400 } },
    });
  });
  return props;
}

const LETTER: Record<string, Dir> = { U: 'up', D: 'down', L: 'left', R: 'right' };

/** Plays each move to the end of its run. */
function play(moves: string) {
  for (const m of moves) {
    swipe(LETTER[m]);
    endRun();
  }
}

/** Plays all but the last move to the end, then swipes the last one, leaving its run going. */
function playToFinalRun(moves: string) {
  play(moves.slice(0, -1));
  swipe(LETTER[moves[moves.length - 1]]);
}

const present = (id: string) => queryTestID(id).length > 0;

/** Every host Text whose whole text equals `text`. */
function textNodesEqual(text: string): TestInstance[] {
  return root.container.queryAll((n) => {
    if (n.type !== 'Text' && n.type !== 'RCTText') return false;
    const parts: string[] = [];
    const walk = (c: TestInstance | string) => {
      if (typeof c === 'string') parts.push(c);
      else c.children.forEach(walk);
    };
    walk(n);
    return parts.join('') === text;
  });
}

beforeEach(() => {
  capturedPan = null;
  mockSheep.run = null;
  mockSheep.onRunEnd = null;
  clears = [];
  saved = defaultProgress();
  root = createRoot({ textComponentTypes: ['Text', 'RCTText'] });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('FieldScreen strip', () => {
  it("AC4: the caption reads SHEPHERD'S BEST next to the par value, and no text reads PAR", () => {
    mount(LEVELS[0], 0);
    expect(textOf('par-caption')).toBe("SHEPHERD'S BEST");
    expect(textOf('par-value')).toBe('5');
    expect(textNodesEqual("SHEPHERD'S BEST")).toHaveLength(1); // the scan sees Text nodes
    expect(textNodesEqual('PAR')).toHaveLength(0);
  });

  it('AC5: the targets line comes from starLimits (field 1: 6 and 8)', () => {
    mount(LEVELS[0], 0);
    expect(textOf('star-targets')).toBe('3★ ≤ 6 · 2★ ≤ 8');
    expect(label('star-targets')).toBe('Three stars in 6 moves or fewer, two stars in 8 or fewer');
  });

  it('AC5: field 8 (par 13) shows 15 and 19', () => {
    expect(LEVELS[7].par).toBe(13);
    mount(LEVELS[7], 7);
    expect(textOf('star-targets')).toBe('3★ ≤ 15 · 2★ ≤ 19');
    expect(label('star-targets')).toBe('Three stars in 15 moves or fewer, two stars in 19 or fewer');
  });

  it('field-best is hidden until there is a saved best, then shows it', () => {
    mount(LEVELS[0], 0);
    expect(present('field-best')).toBe(false);
    play('UDULDRU');
    expect(label('field-best')).toBe('Your best: 2 of 3 stars in 7 moves');
    expect(textOf('field-best')).toBe('Best ★★☆ in 7');
  });

  it('field-best reads a best saved before this session', () => {
    const initial: Progress = {
      version: 1,
      coins: 25,
      fields: { 'field-01': { stars: 3, badge: true, bestMoves: 5 } },
    };
    mount(LEVELS[0], 0, { initial });
    expect(label('field-best')).toBe('Your best: 3 of 3 stars in 5 moves');
    expect(textOf('field-best')).toBe('Best ★★★ in 5');
  });

  it('fields-button is a 44 pt button labelled "Fields, Field n" that wraps field-title and opens the list', () => {
    const onOpenFields = jest.fn();
    mount(LEVELS[2], 2, { onOpenFields });
    const button = byTestID('fields-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(label('fields-button')).toBe('Fields, Field 3');
    expect(queryTestID('field-title', button)).toHaveLength(1);
    expect(textOf('field-title')).toBe('Field 3');
    const s = flatStyle('fields-button');
    expect(Math.max(Number(s.height ?? 0), Number(s.minHeight ?? 0))).toBeGreaterThanOrEqual(44);
    press('fields-button');
    expect(onOpenFields).toHaveBeenCalledTimes(1);
  });
});

describe('FieldScreen cleared card (AC6)', () => {
  it.each<[string, number, string, boolean, number]>([
    ['ULDRU', 3, '3 of 3 stars', true, 25],
    ['UDLURD', 3, '3 of 3 stars', false, 20],
    ['UDULDRU', 2, '2 of 3 stars', false, 15],
    ['UDUDULDRU', 1, '1 of 3 stars', false, 10],
  ])('%s: the card shows only after the final run, with its rating and coins, recorded once', (moves, stars, starsLabel, badge, coins) => {
    mount(LEVELS[0], 0);
    playToFinalRun(moves);
    // The clearing move is committed, but the sheep is still running.
    expect(textOf('moves-count')).toBe(String(moves.length));
    expect(mockSheep.run).not.toBeNull();
    expect(present('field-cleared')).toBe(false);
    expect(present('field-hint')).toBe(false); // the hint area is empty once cleared
    expect(clears).toHaveLength(0);

    endRun();
    expect(textOf('field-cleared')).toBe('Field cleared');
    expect(label('clear-stars')).toBe(starsLabel);
    expect(present('clear-badge')).toBe(badge);
    if (badge) expect(textOf('clear-badge')).toBe("Shepherd's best!");
    expect(textOf('clear-moves')).toBe(`${moves.length} moves · Shepherd's best 5`);
    expect(textOf('clear-coins')).toBe(`+${coins} coins`);
    expect(present('clear-new-best')).toBe(false); // a first clear is not a "new best"
    expect(clears).toHaveLength(1);
    expect(clears[0]).toMatchObject({ stars, badge, moves: moves.length, coins });
    expect(saved.coins).toBe(coins);
  });

  it('the card is outside the swipe area and placed above the Undo / Restart bar', () => {
    mount(LEVELS[0], 0);
    play('ULDRU');
    expect(queryTestID('cleared-card')).toHaveLength(1);
    expect(queryTestID('cleared-card', byTestID('paddock'))).toHaveLength(0);
    expect(queryTestID('cleared-card', byTestID('controls'))).toHaveLength(0);
    const s = flatStyle('cleared-card');
    expect(s.position).toBe('absolute');
    expect(s.bottom).toBe(metrics.insets.bottom + 16 + 48 + 10);
    expect([s.left, s.right]).toEqual([16, 16]);
  });

  it('Next field and Fields call their callbacks', () => {
    const onNext = jest.fn();
    const onOpenFields = jest.fn();
    mount(LEVELS[0], 0, { onNext, onOpenFields });
    play('ULDRU');
    press('next-field-button');
    expect(onNext).toHaveBeenCalledTimes(1);
    press('clear-fields-button');
    expect(onOpenFields).toHaveBeenCalledTimes(1);
  });

  it('AC7 (card half): without onNext (the last field) there is no Next button', () => {
    mount(LEVELS[0], 0, { onNext: undefined });
    play('ULDRU');
    expect(present('next-field-button')).toBe(false);
    expect(present('clear-fields-button')).toBe(true);
  });
});

describe('FieldScreen undo after a clear (AC8)', () => {
  it('Undo hides the card; the same clear again is recorded again and pays nothing', () => {
    mount(LEVELS[0], 0);
    play('ULDRU');
    expect(present('field-cleared')).toBe(true);
    expect(textOf('clear-coins')).toBe('+25 coins');

    press('undo-button');
    expect(present('field-cleared')).toBe(false);
    expect(textOf('moves-count')).toBe('4');

    // The re-clear's card (and the earlier outcome) stay hidden while its run plays.
    swipe('up');
    expect(mockSheep.run).not.toBeNull();
    expect(present('field-cleared')).toBe(false);
    endRun();
    expect(textOf('moves-count')).toBe('5');
    expect(present('field-cleared')).toBe(true);
    expect(label('clear-stars')).toBe('3 of 3 stars');
    expect(present('clear-coins')).toBe(false);
    expect(present('clear-new-best')).toBe(false);
    expect(clears).toHaveLength(2);
    expect(clears[1].coins).toBe(0);
    expect(saved.coins).toBe(25);
  });

  it('a better replay pays only the upgrade and shows New best', () => {
    mount(LEVELS[0], 0);
    play('UDULDRU');
    expect(textOf('clear-coins')).toBe('+15 coins');

    press('restart-button');
    expect(present('field-cleared')).toBe(false);
    expect(textOf('moves-count')).toBe('0');

    playToFinalRun('ULDRU');
    expect(present('field-cleared')).toBe(false);
    endRun();
    expect(textOf('clear-coins')).toBe('+10 coins');
    expect(present('clear-new-best')).toBe(true);
    expect(present('clear-badge')).toBe(true);
    expect(clears.map((c) => c.coins)).toEqual([15, 10]);
    expect(saved.coins).toBe(25);
    expect(label('field-best')).toBe('Your best: 3 of 3 stars in 5 moves');
  });
});

describe('FieldScreen active guard (AC10)', () => {
  it('with active={false}, a swipe does not move the sheep', () => {
    mount(LEVELS[0], 0, { active: false });
    swipe('up');
    expect(textOf('moves-count')).toBe('0');
    expect(mockSheep.run).toBeNull();
  });

  it('turning active off ignores later swipes, and turning it back on allows them', () => {
    const props = mount(LEVELS[0], 0);
    play('U');
    expect(textOf('moves-count')).toBe('1');
    act(() => root.render(element({ ...props, active: false })));
    swipe('left');
    expect(textOf('moves-count')).toBe('1');
    expect(mockSheep.run).toBeNull();
    act(() => root.render(element({ ...props, active: true })));
    play('L');
    expect(textOf('moves-count')).toBe('2');
  });
});
