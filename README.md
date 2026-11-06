# Prono NFL entre potes

An NFL picks app for a group of friends: a mobile PWA you install on your home screen, self-hosted in Docker and exposed through an existing Cloudflare tunnel.

- **Games** of the week with team logos, one tap to make a pick, and the group's split under each game.
- **Locking** at kickoff (server-side), **live scores**, points computed automatically.
- **Leaderboard** by season / week, **profile** week by week, **season recap** with trophies.
- **Season after season**: the new season takes over by itself on June 1st (once ESPN publishes the schedule, week 1 is already open for picks). Until then, the finished season stays on screen. Past seasons remain available: a « Saisons précédentes » link at the bottom of the leaderboard leads to their recap (final standings and trophies).
- **Notifications**: a reminder 1 h before a game you haven't picked, results once a week is over.

Scoring: 1 point per correct pick in the regular season, **2 points in the playoffs** (configurable, see [Settings](#settings)). Picks for weeks 1 to 8 come from the old site (imported as CSV from the admin screen).

## Server setup

1. **Hook up the existing Cloudflare tunnel**: in Zero Trust › Networks › Tunnels › your tunnel › *Public Hostname*, add `prono.your-domain.com` → service `HTTP`, URL `<server-ip>:3847`. If your cloudflared runs on a shared Docker network, see the commented-out variant in `docker-compose.yml`: the URL then becomes `prono:3000`.
2. **Log in to the registry** (the image is private), once per server. You need a *classic* GitHub token with the `read:packages` scope (Settings › Developer settings › Personal access tokens), pasted as the password:
   ```bash
   docker login ghcr.io -u gwenoleR
   ```
3. **Prepare a folder**: no need to clone the repo, everything is in the image. All you need is `docker-compose.yml` and a `.env`:
   ```bash
   mkdir -p ~/prono && cd ~/prono
   ```
   Copy [`docker-compose.yml`](docker-compose.yml) into it (with `scp` from your machine, or by pasting its contents), then create the `.env`:
   ```bash
   echo "PUBLIC_URL=https://prono.your-domain.com" > .env
   ```
   If `docker compose pull` answers `unauthorized`, step 2 is missing.
4. **Start**:
   ```bash
   docker compose pull && docker compose up -d
   ```
   On first start, the app downloads the 32 teams, their logos and the season's 272 games (about 30 s). The database is empty: the logs tell you there are no players yet and which address to open to create your group.
5. **Create the group**: the first person to open the address picks their first name and PIN, and becomes the admin. They then add the others from Profil › Admin. Everyone picks their own name: **the first PIN they type becomes their PIN**. Until the group exists, anyone with the address can create it, so do it right after the first start.
6. Install the app:
   - **iPhone** (Safari): Share › *Add to Home Screen*. Notifications only work once the app is opened from its icon (iOS 16.4 minimum). An app added before November 4, 2026 keeps a strip at the bottom of the screen (translucent status bar, read by iOS at install time): remove the icon and add it again.
   - **Android** (Chrome): ⋮ menu › *Install app*.
   - Then Profil › « Activer les notifications ».

### Updating

Every push to `main` triggers GitHub Actions, which builds the image and publishes it to `ghcr.io/gwenoler/pronos` with the tags `latest` and `sha-<short commit hash>` (e.g. `sha-daade27`). Once the build is done (Actions tab of the repo, about 2 min), on the server:

```bash
docker compose pull && docker compose up -d
```

To roll back to a specific version, replace `latest` with its `sha-…` tag in `docker-compose.yml`. To test a locally built image without going through GitHub: `docker build -t ghcr.io/gwenoler/pronos:latest .` in the repo, then `docker compose up -d`.

## Settings

All optional, in the `.env` next to `docker-compose.yml` (then `docker compose up -d`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | Prono NFL entre potes | App name: title, login screen, installed app |
| `APP_SHORT_NAME` | Prono | Name under the home screen icon |
| `APP_LANG` | `fr` | Language of the texts and notifications (only French exists for now) |
| `POINTS_REGULAR` | 1 | Points for a correct pick in the regular season |
| `POINTS_PLAYOFFS` | 2 | Points for a correct pick in the playoffs (Wild Card to Super Bowl) |
| `TZ` | Europe/Paris | Time zone for times in notifications. In the app, everyone sees times in their phone's time zone |

Scoring applies to the whole season, games already played included: changing it mid-season recomputes the leaderboard. An app already open on a phone picks up a new name or language on its next launch.

### Translating the app

All texts live in `shared/i18n/fr/`, one file per part of the app (games, leaderboard, profile, notifications…). For a new language: copy `fr/` to `en/`, translate, add it to `DICTIONARIES` in `shared/i18n/index.ts`, then set `APP_LANG=en`. Texts with values are functions (plurals, names, numbers): translate the whole sentence. The typecheck rejects a translation that is missing a text.

## Admin

The group's creator is an admin and can make other players admins. Admins see an Admin section in their profile:
- **Add a player**, with starting points if they join mid-season. Starting points only apply to the current season: everyone starts back at 0 the following season.
- For each player (tap their name): **rename**, **clear the PIN** (they pick a new one at their next login), **grant / revoke admin**, **delete** (their picks go with them). You can neither delete yourself nor revoke your own rights: there is always an admin left.
- **Import history**: weeks played elsewhere, as CSV. A header row `,Home,Away,Prono GW,Prono AU,…` (the first two letters of the first name, ignoring accents), then one row per game with the full team names (`Kansas City Chiefs`), `Week1` in the first column on the first game of each week, and an empty cell for a missing pick. The file is first checked in a dry run (how many picks, for whom), then imported on confirmation. It's all or nothing: on any error, nothing is written and every problem is listed. Starting points of the players in the file are reset to 0.

PIN security: 5 wrong attempts lock that name for 15 minutes, and 20 wrong attempts from the same connection lock it for an hour.

## Data

- Source: ESPN's public API (unofficial, free, no key). Everything goes through `server/espn.ts`; if ESPN changes its format, that's the only file to adapt. As a fallback, the `games.csv` file from [nflverse](https://github.com/nflverse/nfldata) has the same games along with the ESPN IDs.
- Tracked season: the current one based on the date (see above). To pin it (tests, demo), set `SEASON=2026`.
- Sync: full season once a day, current weeks every hour, **every 2 minutes during games**.
- SQLite database in the `prono-data` Docker volume (`/data/prono.db`).
  Backup:
  ```bash
  docker compose cp prono:/data/prono.db ./prono-backup.db
  ```

## Development

```bash
npm install
npm run dev
```

The UI runs on http://localhost:5173 and the API on port 3000. Other commands:

- `npm run build`: builds the UI and the server into `dist/`;
- `npm start`: runs the built version;
- `npm run typecheck`: checks types;
- `npm test`: runs the tests (`npm run test:watch` to rerun them on every change);
- `npm run icons`: regenerates the icons from `web/public/icon.svg`.

| Folder | Contents |
| --- | --- |
| `server/` | Fastify, SQLite (`node:sqlite`), ESPN sync, scoring, login, notifications |
| `server/routes/` | API routes, one file per domain (login, games, leaderboard, bonus, NFL, admin, notifications) |
| `server/schema.ts` | Database tables, as numbered migrations: to change the database, **append** a migration at the end |
| `shared/i18n/` | App and server texts, one dictionary per language (only `fr/` exists) |
| `shared/api.ts` | Shape of the API responses, shared by the server and the app |
| `web/src/ds/` | Design system tokens and components, one file per component with its CSS ([artifact](https://claude.ai/artifact/LumqadSKDa1KpdGUebdBNh)) |
| `web/src/screens/` | The screens ([mockups](https://claude.ai/artifact/1CmahETymQknWdhFefETvM)) |
| `web/src/sw.ts` | Service worker: offline cache and notifications |
| `tests/` | Vitest tests: in-memory SQLite database, ESPN responses recorded in `tests/fixtures/espn` |

### Tests

Every new feature or fix comes with its tests. They never touch `data/` and never call ESPN or the notification servers: each test file has its own in-memory database (see `tests/server/helpers.ts` to create players, games and picks). In CI, types and tests run before the Docker image is built: if either fails, nothing is published.

To refresh a recorded ESPN response, download it, then keep only the fields read by `server/espn.ts`.
