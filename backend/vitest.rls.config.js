import { defineConfig } from 'vitest/config';

/**
 * Config for the opt-in two-account RLS test. It lives apart from the default
 * config because that one deliberately excludes this file: `npm test` must
 * stay fast and offline, while this suite talks to a real Neon project.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls.integration.test.js'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: 'verbose',
  },
});
