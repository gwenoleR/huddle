# Translating

Huddle speaks **English** and **French**. Every text — screens, notifications, error messages,
game details — lives in one dictionary per language, in
[`shared/i18n/`](https://github.com/gwenoleR/huddle/tree/main/shared/i18n): one file per part of the
app (games, standings, profile, notifications…).

## Adding a language

1. Copy `shared/i18n/en/` to a new folder, say `de/`, and translate the texts.
2. Add it to `DICTIONARIES` in `shared/i18n/index.ts`.
3. Run `npm run typecheck`: it refuses a translation with a missing or extra text.
4. Try it with `APP_LANG=de npm run dev`, then open a pull request.

Texts that depend on values are functions — plurals, names, numbers — so you translate whole
sentences in your language's word order, not fragments. Dates, times (12 or 24 h) and numbers follow
the dictionary's `locale` and `hour` settings.
