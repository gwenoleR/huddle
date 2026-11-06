---
title: "Huddle : l’appli de pronos NFL entre potes, gratuite et auto-hébergée"
titleTemplate: false
description: "Faites vos pronostics NFL entre amis avec Huddle : un prono par match, scores en direct, classement, trophées et récap de la semaine. Gratuit, open source, à héberger soi-même avec Docker. Sans pub ni paris."
layout: home

hero:
  name: Huddle
  text: Les pronos NFL de la bande
  tagline: Une petite appli que vous hébergez vous-même pour votre groupe de potes. Un prono par match, les scores en direct, et enfin la réponse à la question qui fâche — qui s’y connaît vraiment. Sans pub, sans paris, sans compte à créer.
  image:
    src: /screens/games.jpg
    alt: Les matchs de la semaine dans Huddle, avec les pronos de chacun
  actions:
    - theme: brand
      text: L’installer en 5 minutes
      link: /guide/
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/gwenoleR/huddle

features:
  - icon: 🏈
    title: Un prono en un tap
    details: Tous les matchs de la semaine, avec les logos et les heures de coup d’envoi dans le fuseau du téléphone. Les pronos se verrouillent au coup d’envoi, côté serveur.
  - icon: 📈
    title: Les matchs en direct
    details: Les scores toutes les deux minutes les soirs de match, les chances de victoire, les actions et les stats. Le classement montre « si ça finit comme ça » pendant les matchs.
  - icon: 🏆
    title: Trophées et chambrage
    details: Classement de la saison et de la semaine, récap à envoyer dans le groupe, trophées comme le Sniper, le Chat noir ou Nostradamus. En playoffs, un bon prono compte double.
  - icon: 🔔
    title: Plus jamais de prono oublié
    details: Une notification une heure avant un match sans prono, les résultats de la semaine, et une alerte quand ton prono bascule en fin de match.
  - icon: 📱
    title: Une appli sur chaque téléphone
    details: S’installe depuis le navigateur sur iPhone et Android, marche hors ligne, suit le thème clair ou sombre. Connexion avec son prénom et un code à 4 chiffres.
  - icon: 🏠
    title: Chez vous, en français
    details: Un seul conteneur Docker, SQLite, rien à configurer à part une adresse web. Les données de la bande restent sur votre serveur. Open source (MIT), en français et en anglais.
---

<section class="hd-section">
  <h2 class="hd-section-title">Né d’une bande de potes</h2>
  <p class="hd-section-lead">
    Huddle est né pour remplacer le site de pronos plein de bugs qu’une bande de fans de NFL subissait
    chaque dimanche. Il est devenu l’appli qu’ils utilisent toutes les semaines, et il est maintenant
    à disposition de toutes les bandes. C’est un projet perso, gratuit, indépendant de la NFL et d’ESPN.
  </p>
  <p class="hd-section-lead">
    L’appli est en français par défaut. La <a href="../guide/">documentation d’installation</a> est en
    anglais : un serveur, Docker, une adresse en HTTPS, et c’est parti.
  </p>
</section>

<section class="hd-section hd-last">
  <h2 class="hd-section-title">En images</h2>
  <p class="hd-section-lead">Pensée pour le téléphone, autour du rituel du dimanche soir : on pronostique, on regarde, on chambre.</p>
  <Screens />
</section>
