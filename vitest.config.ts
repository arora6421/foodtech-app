import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Property tests run whole sessions; give them room.
    testTimeout: 60_000,
  },
})
