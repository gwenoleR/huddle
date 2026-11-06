# Settings

Everything is set with environment variables in the `.env` file next to `docker-compose.yml`, then
applied with `docker compose up -d`. Only `PUBLIC_URL` is required.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | — | The address players open, e.g. `https://huddle.example.com` |
| `APP_NAME` | Huddle | App name: title, login screen, installed app |
| `APP_SHORT_NAME` | Huddle | Name under the home screen icon |
| `APP_LANG` | `fr` | Language of the app and notifications: `en` or `fr` |
| `POINTS_REGULAR` | 1 | Points for a correct pick in the regular season |
| `POINTS_PLAYOFFS` | 2 | Points for a correct pick in the playoffs (Wild Card to Super Bowl) |
| `TZ` | Europe/Paris | Time zone of the times written in notifications |
| `VAPID_SUBJECT` | `PUBLIC_URL` | Contact given to the push notification services |

::: tip English or French?
`APP_LANG` defaults to French, where Huddle comes from. Set `APP_LANG=en` for English, with 12-hour
times and US date formats.
:::

## Good to know

- **Scoring** applies to the whole season, games already played included: changing it mid-season
  recomputes the standings.
- **Times in the app** follow each phone's time zone; `TZ` only matters for notification texts.
- A phone that already has the app open picks up a new name or language on its next launch.
- The end-of-season bonus (AFC and NFC champions, Super Bowl winner) is set from the app's
  Administration page, not here.
