import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isCleared } from '../game';
import type { Level } from '../game';
import { SWIPE_MIN_DISTANCE, swipeBetween } from '../input/swipe';
import type { Point } from '../input/swipe';
import { buildBoardView } from '../play/boardView';
import { cellSize } from '../play/layout';
import { initialSession, sessionReducer } from '../play/session';
import { palette } from '../theme/palette';
import { Board } from './Board';

interface Props {
  level: Level;
  /** Position of the level in LEVELS (0-based), shown as "Field {index + 1}". */
  index: number;
}

/**
 * Field screen, layout Option A: title row, stats strip, paddock (swipe area with
 * the board centred), hint. State logic lives in the pure session reducer; this
 * component only renders it and forwards swipes.
 */
export function FieldScreen({ level, index }: Props) {
  const insets = useSafeAreaInsets();
  const [session, dispatch] = useReducer(sessionReducer, level, initialSession);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  const board = useMemo(() => buildBoardView(session.game), [session.game]);
  const cleared = isCleared(session.game);
  const cell = area ? cellSize(area.w, area.h, board.width, board.height) : 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const onRunEnd = useCallback((runId: number) => dispatch({ type: 'runEnd', runId }), []);

  // Where the finger touched down, in window coordinates. The swipe is measured
  // from here to the lift point. Not from e.translationX/Y: on iOS, RNGH resets
  // the translation to zero when the pan activates at minDistance, which would
  // drop the first 16 pt and measure from the activation point (verify F1).
  const touchStart = useRef<Point | null>(null);

  // Callbacks run on the JS thread, in order. onBegin fires at touch-down;
  // onDeactivate fires once per activated pan, when the finger lifts. There is no
  // selection UI yet, so the swipe goes to sheep 0 (spec section 4).
  const pan = usePanGesture({
    // Only gates activation (16 pt from touch-down), so taps never become pans.
    minDistance: SWIPE_MIN_DISTANCE,
    runOnJS: true,
    onBegin: (e) => {
      touchStart.current = { x: e.absoluteX, y: e.absoluteY };
    },
    onDeactivate: (e) => {
      const start = touchStart.current;
      if (e.canceled || !start) return;
      const dir = swipeBetween(start, { x: e.absoluteX, y: e.absoluteY });
      if (dir) dispatch({ type: 'swipe', sheep: 0, dir });
    },
    onFinalize: () => {
      touchStart.current = null;
    },
  });

  return (
    <View
      testID="app-root"
      style={[styles.root, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 }]}
    >
      <View style={styles.top}>
        <Text style={styles.title}>Lamb Chomp</Text>
        <Text testID="field-title" style={styles.field}>
          {`Field ${index + 1}`}
        </Text>
      </View>

      <View style={styles.strip}>
        <View style={styles.stat}>
          <Text testID="moves-count" style={styles.statValue}>
            {String(session.game.moves)}
          </Text>
          <Text style={styles.statCaption}>MOVES</Text>
        </View>
        <View style={styles.stat}>
          <Text testID="par-value" style={styles.statValue}>
            {String(level.par)}
          </Text>
          <Text style={styles.statCaption}>PAR</Text>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View testID="paddock" style={styles.paddock} onLayout={onLayout}>
          {cell > 0 ? (
            <Board board={board} cell={cell} run={session.run} onRunEnd={onRunEnd} />
          ) : null}
        </View>
      </GestureDetector>

      <View style={styles.hintArea}>
        {cleared ? (
          <Text testID="field-cleared" style={[styles.hint, styles.cleared]}>
            Field cleared
          </Text>
        ) : (
          <Text testID="field-hint" style={styles.hint}>
            {level.hint}
          </Text>
        )}
      </View>
    </View>
  );
}

const HINT_LINE = 20;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.page,
    paddingHorizontal: 16,
    gap: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: palette.butter,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  field: {
    color: palette.woolDim,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingBottom: 4,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statValue: {
    color: palette.wool,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statCaption: {
    color: palette.woolDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  paddock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintArea: {
    minHeight: HINT_LINE * 2,
    justifyContent: 'center',
  },
  hint: {
    color: palette.wool,
    fontSize: 15,
    lineHeight: HINT_LINE,
    textAlign: 'center',
  },
  cleared: {
    color: palette.butter,
    fontWeight: '700',
  },
});
