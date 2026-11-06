---
title: "Backups and where the NFL data comes from"
description: "Back up and restore your Huddle database (one SQLite file), and learn how the NFL schedule, scores and stats sync from ESPN’s public API."
---

# Backups & data

## Where your data lives

Everything is in one SQLite file, `/data/huddle.db`, in the `huddle-data` Docker volume: players,
picks, standings, settings. Nothing is stored elsewhere.

## Backups

Stop the app for a moment so the copy is complete (SQLite keeps recent writes in a side file while
it runs), copy the file, start it again:

```bash
docker compose stop huddle
docker compose cp huddle:/data/huddle.db ./huddle-backup.db
docker compose start huddle
```

To restore, the same the other way round:

```bash
docker compose stop huddle
docker compose cp ./huddle-backup.db huddle:/data/huddle.db
docker compose start huddle
```

## Where the games come from

Schedule, scores, logos and stats come from **ESPN's public but unofficial API**, called by your
server only — phones never talk to ESPN. The full season syncs once a day, the current weeks every
hour, and games in progress **every two minutes**. Answers are cached, and the app slows down by
itself if ESPN asks it to.

That API isn't documented for this use and could change: if it does, syncing stops until Huddle is
updated (everything ESPN-related lives in one file, `server/espn.ts`). Huddle is a non-commercial
project, not affiliated with the NFL or ESPN.
