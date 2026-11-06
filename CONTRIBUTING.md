# Contributing

Thanks for your interest! Issues and pull requests are welcome.

- **Run it**: `npm install`, then `npm run dev` (UI on http://localhost:5173, API on port 3000).
- **Tests come with every change**: a fix or a feature ships with its Vitest tests in the same pull
  request. `npm run typecheck` and `npm test` must pass (CI runs both).
- **Language**: code, comments, logs, commit messages and docs are in English. What players see is
  never written in the code: it lives in the dictionaries under `shared/i18n/<lang>/` (French for now;
  a new language is very welcome, see the README).
- **Database changes**: append a migration at the end of `server/schema.ts`, never edit a released
  one. `tests/server/upgrade.test.ts` checks that every released database still opens and gives the
  same standings.
- **Changelog**: add a line under *Unreleased* in `CHANGELOG.md` for anything a player or a host
  would notice.
