// Minimal react-native and expo runtime mock for Vitest / Node test runner
if (!globalThis.expo) {
  class MockEventEmitter {
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    emit() {}
  }
  globalThis.expo = {
    EventEmitter: MockEventEmitter,
    modules: {},
  };
}

export const Platform = {
  OS: 'android',
  select: (obj) => (obj && obj.android !== undefined ? obj.android : obj ? obj.default : undefined),
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};

export const Linking = {
  addEventListener: () => ({ remove: () => {} }),
  openURL: async () => {},
  canOpenURL: async () => true,
  getInitialURL: async () => null,
};

export const processColor = (color) => color;
export const NativeModules = {};

export default {
  Platform,
  AppState,
  Linking,
  processColor,
  NativeModules,
};
