import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    globals: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      'expo-sqlite': 'expo-sqlite/build/index.js',
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.js'),
      'expo-web-browser': path.resolve(__dirname, 'tests/mocks/expo-web-browser.js'),
      'expo-secure-store': path.resolve(__dirname, 'tests/mocks/expo-secure-store.js'),
      'expo-file-system/legacy': path.resolve(__dirname, 'tests/mocks/expo-file-system.js'),
      'expo-file-system': path.resolve(__dirname, 'tests/mocks/expo-file-system.js'),
      'expo-crypto': path.resolve(__dirname, 'tests/mocks/expo-crypto.js'),
      '@react-native-google-signin/google-signin': path.resolve(__dirname, 'tests/mocks/google-signin.js'),
    },
  },
});
