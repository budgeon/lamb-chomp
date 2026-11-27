import { useState } from 'react';
import { Platform, Settings } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { FieldScreen } from './src/components/FieldScreen';
import { LEVELS } from './src/game';
import { parseStartField } from './src/play/startField';

/**
 * Hidden test hook: `startField` (1-based) from the iOS launch arguments, read once.
 * Missing or invalid values open field 1. Never written (no `Settings.set`). The
 * `Platform` check keeps the Android `Settings` stub, which warns, from being called.
 */
function readStartField(): number {
  const raw: unknown = Platform.OS === 'ios' ? Settings.get('startField') : undefined;
  return parseStartField(raw, LEVELS.length);
}

export default function App() {
  const [index] = useState(readStartField);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        <FieldScreen level={LEVELS[index]} index={index} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
