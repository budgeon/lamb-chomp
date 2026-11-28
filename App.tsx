import { useCallback, useRef, useState } from 'react';
import { Platform, Settings, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { FieldList } from './src/components/FieldList';
import { FieldScreen } from './src/components/FieldScreen';
import { LEVELS } from './src/game';
import { ECONOMY } from './src/economy/config';
import { launchIndex, nextIndex, recordClear } from './src/play/progress';
import type { Progress } from './src/play/progress';
import { parseStartFieldOrNull } from './src/play/startField';
import { progressStore } from './src/save/progressFile';

/**
 * Hidden test hook: `startField` (1-based) from the iOS launch arguments, read once.
 * Missing or invalid values give null, so the normal launch rule applies. Never
 * written (no `Settings.set`). The `Platform` check keeps the Android `Settings`
 * stub, which warns, from being called.
 */
function readStartField(): number | null {
  const raw: unknown = Platform.OS === 'ios' ? Settings.get('startField') : undefined;
  return parseStartFieldOrNull(raw, LEVELS.length);
}

/** Loads the save once and applies the launch rule (`launchIndex`). Nothing is written here. */
function initialState() {
  const { progress } = progressStore.load();
  const launch = launchIndex(progress, LEVELS, readStartField());
  return { progress, index: launch.index, listOpen: launch.list };
}

/**
 * Two views without a navigation library (owner decision; Expo Router comes with
 * the shop): the field screen, and the field list drawn over it. The field
 * screen stays mounted under the list, so Back returns to the same session.
 *
 * FieldScreen is keyed by the level id plus an open counter: a new field, or
 * reopening the current one from the list, mounts a fresh session (its reducer
 * only reads `level` for its first state).
 */
export default function App() {
  const [initial] = useState(initialState);
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [index, setIndex] = useState(initial.index);
  const [listOpen, setListOpen] = useState(initial.listOpen);
  const [openCount, setOpenCount] = useState(0);

  // The latest progress, read by onClear, so a clear always builds on the last
  // recorded one even before React re-renders with it.
  const progressRef = useRef(progress);

  const level = LEVELS[index];

  const onClear = useCallback(
    (moves: number) => {
      const { progress: next, outcome } = recordClear(progressRef.current, level, moves, ECONOMY.earn);
      progressRef.current = next;
      setProgress(next);
      // After every recorded clear, so a failed write is retried at the next one.
      progressStore.save(next);
      return outcome;
    },
    [level],
  );

  const openField = useCallback((i: number) => {
    setIndex(i);
    setOpenCount((c) => c + 1);
    setListOpen(false);
  }, []);

  const next = nextIndex(index, LEVELS.length);
  const onNext = next === null ? undefined : () => openField(next);
  const onOpenFields = useCallback(() => setListOpen(true), []);
  const onBack = useCallback(() => setListOpen(false), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        {/* Hidden from VoiceOver and Maestro while the list covers it. */}
        <View
          testID="field-view"
          style={{ flex: 1 }}
          accessibilityElementsHidden={listOpen}
          importantForAccessibility={listOpen ? 'no-hide-descendants' : 'auto'}
        >
          <FieldScreen
            key={`${level.id}#${openCount}`}
            level={level}
            index={index}
            best={progress.fields[level.id]}
            onClear={onClear}
            onNext={onNext}
            onOpenFields={onOpenFields}
            active={!listOpen}
          />
        </View>
        {listOpen ? (
          <FieldList levels={LEVELS} progress={progress} onOpenField={openField} onBack={onBack} />
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
