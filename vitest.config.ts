import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Chaque fichier de test tourne dans son propre processus, avec sa base SQLite en mémoire :
// aucun test ne touche à data/ ni n'appelle ESPN pour de vrai.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--no-warnings=ExperimentalWarning'] } },
    // Les console.log du serveur ne s'affichent que pour les tests qui échouent.
    silent: 'passed-only',
    env: {
      DB_FILE: ':memory:',
      DATA_DIR: path.join(tmpdir(), 'prono-tests'),
      SEED_FILE: path.resolve('tests/fixtures/seed.json'),
      SYNC: 'off',
      TZ: 'Europe/Paris'
    }
  }
});
