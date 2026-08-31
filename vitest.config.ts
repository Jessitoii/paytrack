import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false, // Sequential test files to prevent SQLite database locks/races
    env: {
      DATABASE_URL: 'file:./test.db',
    },
  },
});
