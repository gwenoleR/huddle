---
layout: home

hero:
  name: Huddle
  text: NFL picks with your crew
  tagline: A small app you host yourself for your group of friends. Pick every game, follow them live, and settle once and for all who really knows football. No ads, no betting, no account to create.
  image:
    src: /screens/games.jpg
    alt: The week's games in Huddle, with everyone's picks
  actions:
    - theme: brand
      text: Install it in 5 minutes
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/gwenoleR/huddle

features:
  - icon: 🏈
    title: One tap per game
    details: Every game of the week with logos and kickoff times in your phone's time zone. Picks lock at kickoff, checked by the server — no late edits.
  - icon: 📈
    title: Follow it live
    details: Live scores every two minutes on game days, win probability, scoring plays and team stats. Standings show "if it ends like this" while games are on.
  - icon: 🏆
    title: Trophies and bragging rights
    details: Season standings, weekly recaps to drop in the group chat, and trophies like Sharpshooter, Black cat or Nostradamus. Playoff picks count double.
  - icon: 🔔
    title: Never forget a pick
    details: A push notification an hour before a game you haven't picked, the week's results, and a heads-up when your pick flips late in the fourth quarter.
  - icon: 📱
    title: An app on everyone's phone
    details: Installs from the browser on iPhone and Android, works offline, follows dark and light mode. Log in with your name and a 4-digit PIN.
  - icon: 🏠
    title: Yours, on your server
    details: One Docker container, SQLite, nothing to configure beyond a web address. Your group's data stays on your server. MIT licensed, in English and French.
---

<section class="hd-section">
  <h2 class="hd-section-title">See it in action</h2>
  <p class="hd-section-lead">Made for phones, built around the Sunday ritual: pick, watch, argue, repeat.</p>
  <Screens />
</section>

<section class="hd-section">
  <h2 class="hd-section-title">Up and running before kickoff</h2>
  <p class="hd-section-lead">Three steps, then the app takes care of the schedule, the scores and the standings — season after season.</p>
  <Steps />
</section>

<section class="hd-section hd-last">
  <h2 class="hd-section-title">Why Huddle?</h2>
  <p class="hd-section-lead">
    It started as a fix for the buggy pick'em site a group of friends was stuck with, and became the app
    they use every week. The big pick'em platforms come with ads, accounts and betting offers; Huddle is just your group,
    on your own server. It's a hobby project, independent from the NFL and ESPN.
  </p>
  <p class="hd-section-lead">
    <a href="./guide/">Install it</a> · <a href="https://github.com/gwenoleR/huddle/releases">Releases</a> ·
    <a href="https://github.com/gwenoleR/huddle/blob/main/CONTRIBUTING.md">Contribute</a>
  </p>
</section>
