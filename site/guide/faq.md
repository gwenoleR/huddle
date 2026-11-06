---
title: "FAQ: cost, betting, groups, scoring, security"
description: "Answers about Huddle, the self-hosted NFL pick’em app: is it free, is there betting, several groups, scoring changes, offseason, PIN security, NFL and ESPN."
---

# FAQ

## Does it cost anything?

No. Huddle is free and open source (MIT). You only need somewhere to run a small Docker container.

## Is there betting?

No. Picks have no stake and no prize: it's for bragging rights.

## Can one server host several groups?

One instance is one group. To host another group, run a second container with its own volume, port
and address.

## Someone joins in the middle of the season

Add them from the Administration page with starting points, so they don't start too far behind.
Starting points only count for the current season.

## Can we change the scoring?

Yes, with `POINTS_REGULAR` and `POINTS_PLAYOFFS` ([settings](./settings)). The standings are
recomputed for the whole season.

## What happens after the Super Bowl?

The finished season stays on screen, with its final standings and trophies, until June 1st. Then the
new season takes over by itself, and the old one stays available from the standings.

## Is a 4-digit PIN secure?

It's made for a group of friends: five wrong attempts lock a name for 15 minutes, twenty from the same
address lock it for an hour. It stops guessing, but don't reuse a PIN that protects anything else. See
the [security notes](https://github.com/gwenoleR/huddle/blob/main/SECURITY.md).

## Is Huddle affiliated with the NFL or ESPN?

No. It's an independent hobby project. Team names and logos belong to their owners and only identify
the games. Game data comes from ESPN's unofficial public API ([more](./data#where-the-games-come-from)).
