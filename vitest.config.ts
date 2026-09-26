import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __DEBUG_TOOLS__: 'true' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Property tests run whole sessions; give them room.
    testTimeout: 60_000,
  },
})
