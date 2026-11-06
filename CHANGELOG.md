# Changelog

All notable changes, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/): a major version may need an action
from whoever hosts the app (it is always spelled out here), minor and patch versions never do.

## [Unreleased]

## [1.0.0] - 2026-11-06

First numbered release: the app the original group has been using all season, packaged so that any
group can host its own.

### Picks and scoring
- Weekly NFL games with logos, one tap to pick, picks lock at kickoff (checked by the server).
- Live scores, win probability, scoring plays and team stats during games; preview before
  (favorite, form, injuries) and stats after.
- Leaderboard by season and by week, with a live "if it ends like this" projection during games.
- Configurable scoring: `POINTS_REGULAR` (default 1) and `POINTS_PLAYOFFS` (default 2).
- End-of-season bonus (AFC and NFC champions, Super Bowl winner and total score), managed by the admin.
- Season recap with trophies, weekly recap image to share, NFL standings and team sheets.

### Seasons
- The current season follows the calendar: the new one takes over on June 1st, as soon as ESPN
  publishes the schedule. Past seasons stay available (final standings and trophies).

### Hosting
- Fresh install: the first person to open the app creates the group and becomes its admin.
- Admin page: players (add, rename, reset PIN, make admin, remove), bonus settings, ESPN sync,
  import of past weeks' picks from CSV.
- Settings through environment variables: `APP_NAME`, `APP_SHORT_NAME`, `APP_LANG`, `POINTS_*`, `TZ`.
- All texts in one dictionary per language (`shared/i18n/`); French only for now.
- Push notifications: reminder before an unpicked game, weekly results, picks flipping late in a game.
- Docker image for amd64 and arm64 on `ghcr.io/gwenoler/pronos`.

[Unreleased]: https://github.com/gwenoleR/pronos/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gwenoleR/pronos/releases/tag/v1.0.0
