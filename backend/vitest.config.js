import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // The RLS test talks to a real Neon project and is opt-in; run it with
    // `npm run test:rls` once tests/.env.test exists.
    exclude: ['tests/rls.integration.test.js', '**/node_modules/**'],
    reporters: 'verbose',
  },
});
