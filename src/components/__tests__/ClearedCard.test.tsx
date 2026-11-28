/// <reference types="jest" />
/**
 * The cleared card on its own (layout C2): which buttons it shows, which one is
 * primary, when "+N coins" and the badge appear, and the button sizes.
 * Buttons are pressed through the host view's `onClick` (as in the controls test).
 */
import { act } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot } from 'test-renderer';
import type { Root, TestInstance } from 'test-renderer';

import type { ClearOutcome } from '../../play/progress';
import { palette } from '../../theme/palette';
import { ClearedCard } from '../ClearedCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;

const query = (id: string): TestInstance[] => root.container.queryAll((n) => n.props.testID === id);
const present = (id: string) => query(id).length > 0;

function byTestID(id: string): TestInstance {
  const found = query(id);
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

const background = (id: string) => StyleSheet.flatten(byTestID(id).props.style).backgroundColor;

function press(id: string) {
  const host = byTestID(id);
  act(() => host.props.onClick({ currentTarget: host, target: host, nativeEvent: {} }));
}

const outcome = (o: Partial<ClearOutcome> = {}): ClearOutcome => ({
  stars: 3,
  badge: true,
  moves: 5,
  coins: 25,
  firstClear: true,
  newBest: false,
  best: { stars: 3, badge: true, bestMoves: 5 },
  ...o,
});

function render(props: { outcome: ClearOutcome; onNext?: () => void; onOpenFields?: () => void }) {
  act(() => {
    root.render(
      <ClearedCard
        outcome={props.outcome}
        par={5}
        onNext={props.onNext}
        onOpenFields={props.onOpenFields ?? (() => {})}
      />,
    );
  });
}

beforeEach(() => {
  root = createRoot({ textComponentTypes: ['Text', 'RCTText'] });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('ClearedCard', () => {
  it('with onNext: Next field is the primary button and Fields is secondary', () => {
    const onNext = jest.fn();
    const onOpenFields = jest.fn();
    render({ outcome: outcome(), onNext, onOpenFields });
    expect(present('next-field-button')).toBe(true);
    expect(byTestID('next-field-button').props.accessibilityLabel).toBe('Next field');
    expect(background('next-field-button')).toBe(palette.butter);
    expect(background('clear-fields-button')).not.toBe(palette.butter);
    press('next-field-button');
    press('clear-fields-button');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onOpenFields).toHaveBeenCalledTimes(1);
  });

  it('without onNext (the last field): no Next button, and Fields is primary', () => {
    render({ outcome: outcome() });
    expect(present('next-field-button')).toBe(false);
    expect(present('clear-fields-button')).toBe(true);
    expect(background('clear-fields-button')).toBe(palette.butter);
  });

  it('"+N coins" shows only when the clear paid coins', () => {
    render({ outcome: outcome({ coins: 10 }), onNext: () => {} });
    expect(textOf('clear-coins')).toBe('+10 coins');
    render({ outcome: outcome({ coins: 0 }), onNext: () => {} });
    expect(present('clear-coins')).toBe(false);
  });

  it('the badge pill and New best show only when set', () => {
    render({ outcome: outcome({ badge: true, newBest: true }), onNext: () => {} });
    expect(textOf('clear-badge')).toBe("Shepherd's best!");
    expect(textOf('clear-new-best')).toBe('New best');
    render({ outcome: outcome({ stars: 2, badge: false, moves: 7, newBest: false }), onNext: () => {} });
    expect(present('clear-badge')).toBe(false);
    expect(present('clear-new-best')).toBe(false);
    expect(textOf('clear-stars')).toBe('★★☆');
    expect(byTestID('clear-stars').props.accessibilityLabel).toBe('2 of 3 stars');
    expect(textOf('clear-moves')).toBe("7 moves · Shepherd's best 5");
  });

  it('each button is a button at least 44 pt tall', () => {
    render({ outcome: outcome(), onNext: () => {} });
    for (const id of ['next-field-button', 'clear-fields-button']) {
      expect(byTestID(id).props.accessibilityRole).toBe('button');
      const s = StyleSheet.flatten(byTestID(id).props.style);
      expect(Math.max(Number(s.height ?? 0), Number(s.minHeight ?? 0))).toBeGreaterThanOrEqual(44);
    }
  });
});
