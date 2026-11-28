/// <reference types="jest" />
/**
 * AC18: App reads the hidden `startField` launch argument (iOS `Settings`) once and
 * opens that field; without it, field 1. FieldScreen is replaced by a stub that
 * records the props App gives it. The save file is replaced by an empty
 * in-memory store (nothing saved), so the launch rule also gives field 1.
 */
import 'react-native-gesture-handler/jestSetup';

import { act } from 'react';
import { Settings } from 'react-native';
import { createRoot } from 'test-renderer';

import App from '../../../App';
import { LEVELS } from '../../game';
import type { Level } from '../../game';

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

// No save: an in-memory store that starts empty. `expo-file-system` never loads.
jest.mock('../../save/progressFile', () => {
  const { createProgressStore } = jest.requireActual('../../save/progressStore');
  return {
    progressStore: createProgressStore({ read: () => null, write: () => {}, backupCorrupt: () => {} }),
  };
});

const mockRendered: { level: Level; index: number }[] = [];
jest.mock('../FieldScreen', () => ({
  FieldScreen: (props: { level: Level; index: number }) => {
    mockRendered.push(props);
    return null;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderApp(raw: unknown) {
  mockRendered.length = 0;
  const get = jest.spyOn(Settings, 'get').mockImplementation((key: string) =>
    key === 'startField' ? raw : undefined,
  );
  const root = createRoot();
  act(() => {
    root.render(<App />);
  });
  const last = mockRendered[mockRendered.length - 1];
  act(() => root.unmount());
  return { props: last, get };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App start field (AC18)', () => {
  it.each<[string, number, unknown]>([
    ['number 5', 4, 5],
    ['string "5"', 4, '5'],
    ['missing', 0, undefined],
    ['invalid "abc"', 0, 'abc'],
    ['out of range 9', 0, 9],
  ])('%s opens index %i', (_name, index, raw) => {
    const { props, get } = renderApp(raw);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('startField');
    expect(props.index).toBe(index);
    expect(props.level).toBe(LEVELS[index]);
  });
});
