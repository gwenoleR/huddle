import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Each test file runs in its own process, with its own in-memory SQLite database:
// no test touches data/ or calls the real ESPN.
export default defineConfig({
  // UI version baked in at build time (see vite.config.ts): fixed in tests.
  define: { __APP_VERSION__: JSON.stringify('abc1234') },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--no-warnings=ExperimentalWarning'] } },
    // Server console.log output is only shown for failing tests.
    silent: 'passed-only',
    env: {
      DB_FILE: ':memory:',
      DATA_DIR: path.join(tmpdir(), 'prono-tests'),
      SEED_FILE: path.resolve('tests/fixtures/seed.json'),
      // Fixed season: tests don't depend on today's date.
      SEASON: '2026',
      SYNC: 'off',
      SYNC_PAUSE_MS: '0',
      TZ: 'Europe/Paris'
    }
  }
});
