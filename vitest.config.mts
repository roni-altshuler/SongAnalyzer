import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The Playwright E2E suite lives under playwright/ and is run via
    // `npm run test:e2e` — don't let Vitest try to import its specs.
    exclude: ['node_modules/**', 'playwright/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` is a marker package that ships inside Next.js itself.
      // Vitest doesn't go through the Next bundler, so we alias it to the
      // compiled empty stub Next ships with — it lets us import server-only
      // modules in unit tests without pulling Next's webpack pipeline in.
      'server-only': path.resolve(
        __dirname,
        'node_modules/next/dist/compiled/server-only/empty.js',
      ),
    },
  },
});
