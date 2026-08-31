import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      'expo-sqlite': 'expo-sqlite/build/index.js',
    },
  },
});
