---
title: "Run your group: players, CSV import, bonus, seasons"
description: "Manage your NFL pick’em group in Huddle: add players, import past weeks’ picks from CSV, set up the end-of-season bonus, and move on to the next season."
---

# Your group

The person who created the group is its admin and can make other players admins. Admins have an
**Administration** page, reached from their profile.

## Players

- **Add a player**, with starting points if they join mid-season. Starting points only count for the
  current season: everyone starts back at 0 the next one.
- Tap a player's name to **rename** them, **clear their PIN** (they choose a new one at their next
  login), **make them admin** or **remove** them (their picks go with them).
- You can neither remove yourself nor revoke your own admin rights: there is always an admin left.

## Import past weeks

Started the season somewhere else? Import those weeks from a CSV file, from the Administration page:

```csv
,Home,Away,Pick AL,Pick JO
Week1,Kansas City Chiefs,Baltimore Ravens,Kansas City Chiefs,Baltimore Ravens
,Philadelphia Eagles,Dallas Cowboys,Philadelphia Eagles,
Week2,...
```

- One column per player, named `Pick` (or `Prono`) followed by the **first two letters** of their
  name in the app, accents ignored.
- One row per game, with the teams' **full names**; the week (`Week1`) on the first game of each
  week; an empty cell for a missing pick.
- The file is first checked in a dry run — how many picks, for whom — then imported once you confirm.
  It's all or nothing: on any error nothing is written, and every problem is listed.
- The starting points of the players in the file go back to 0: their points now come from the
  imported picks.

## End-of-season bonus

Before the Wild Card round, everyone picks the AFC and NFC champions, the Super Bowl winner and the
Super Bowl's total score (the tiebreaker). From the Administration page, the admin can switch the
bonus off, change its points, and choose when picks are revealed: at the Wild Card or at the Super
Bowl.

## Seasons

The current season switches by itself on **June 1st**, once ESPN has published the schedule: week 1
is open for picks right away. Until then, the finished season stays on screen. Past seasons remain
available from the bottom of the standings (final standings and trophies).
