import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { FieldScreen } from './src/components/FieldScreen';
import { LEVELS } from './src/game';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        <FieldScreen level={LEVELS[0]} index={0} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
