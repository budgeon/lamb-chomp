import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SheepView } from '../play/boardView';
import { STEP_MS } from '../play/session';
import type { Run } from '../play/session';
import { palette } from '../theme/palette';

interface Props {
  view: SheepView;
  /** Cell side in points. */
  cell: number;
  /** Board width in cells (to turn `run.from` into a column and row). */
  cols: number;
  /** The active run if it belongs to this sheep, otherwise null. */
  run: Run | null;
  onRunEnd: (runId: number) => void;
}

/**
 * A sheep on the board. The committed position comes from the view model; while a
 * run plays, the on-screen position is a Reanimated shared value animated with
 * `withTiming` on the UI thread (no per-frame React state). When the animation
 * ends, finished or interrupted, it hops to JS once with `runEnd(run.id)`.
 */
export function Sheep({ view, cell, cols, run, onRunEnd }: Props) {
  const tx = useSharedValue(view.x * cell);
  const ty = useSharedValue(view.y * cell);
  const startedRun = useRef<number | null>(null);

  const runId = run ? run.id : null;
  const runFrom = run ? run.from : -1;
  const runCells = run ? run.cells : 0;

  useEffect(() => {
    const toX = view.x * cell;
    const toY = view.y * cell;

    if (runId !== null && runId !== startedRun.current) {
      startedRun.current = runId;
      const id = runId;
      const fromX = (runFrom % cols) * cell;
      const fromY = Math.floor(runFrom / cols) * cell;
      const config = { duration: Math.max(1, runCells) * STEP_MS, easing: Easing.linear };
      const done = () => {
        'worklet';
        scheduleOnRN(onRunEnd, id);
      };
      // A run is along one axis: animate that axis (with the end callback) and
      // place the other directly, so runEnd fires exactly once.
      if (fromY === toY) {
        ty.set(toY);
        tx.set(fromX);
        tx.set(withTiming(toX, config, done));
      } else {
        tx.set(toX);
        ty.set(fromY);
        ty.set(withTiming(toY, config, done));
      }
      return;
    }

    // No new run (idle, or the board was resized mid-run): snap to the committed
    // cell. Assigning cancels a running animation, whose callback still reports runEnd.
    tx.set(toX);
    ty.set(toY);
  }, [runId, runFrom, runCells, cell, cols, view.x, view.y, onRunEnd, tx, ty]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }],
  }));

  const body = Math.round(cell * 0.62);
  const head = Math.round(cell * 0.3);
  return (
    <Animated.View
      testID={view.testID}
      accessible
      accessibilityLabel={view.label}
      style={[styles.sheep, { width: cell, height: cell }, animated]}
    >
      <View style={[styles.body, { width: body, height: body * 0.85, borderRadius: body / 2 }]} />
      <View
        style={[
          styles.head,
          {
            width: head,
            height: head * 1.15,
            borderRadius: head / 2,
            top: cell * 0.2,
            left: cell * 0.6,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheep: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { backgroundColor: palette.wool },
  head: { position: 'absolute', backgroundColor: palette.sheepFace },
});
