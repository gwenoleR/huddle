# Prono NFL entre potes

L'appli de pronos NFL de la bande : une PWA mobile à installer sur l'écran d'accueil, hébergée à la maison dans Docker et exposée par un tunnel Cloudflare.

- **Matchs** de la semaine avec les logos, un tap pour pronostiquer, la répartition de la bande sous chaque match.
- **Verrouillage** au coup d'envoi (côté serveur), **scores en direct**, points calculés automatiquement.
- **Classement** saison / semaine, **profil** semaine par semaine, **bilan de saison** avec trophées.
- **Notifications** : rappel 1 h avant un match sans prono, résultats quand une semaine est terminée.

Barème : 1 point par bon prono en saison régulière, **2 points en playoffs**. Les points des semaines 1 à 8 sont repris de l'ancien site (`seed/joueurs.json`).

## Mise en route sur le serveur

1. **Créer le tunnel Cloudflare** : Zero Trust › Networks › Tunnels › *Create a tunnel* (type Cloudflared).
   - Copier le jeton affiché dans l'onglet Docker.
   - Dans *Public Hostname*, ajouter `prono.ton-domaine.fr` → service `HTTP`, URL `prono:3000`.
2. **Configurer** :
   ```bash
   cp .env.example .env
   ```
   puis remplir `PUBLIC_URL` (l'adresse ci-dessus) et `TUNNEL_TOKEN`.
3. **Lancer** :
   ```bash
   docker compose up -d --build
   ```
   Au premier démarrage, l'appli crée les 5 joueurs, télécharge les 32 équipes, leurs logos et les 272 matchs de la saison (environ 30 s).
4. Ouvrir l'adresse sur le téléphone, choisir son prénom : **le premier code tapé devient son code**.
5. Installer l'appli :
   - **iPhone** (Safari) : Partager › *Sur l'écran d'accueil*. Les notifications ne marchent qu'une fois l'appli ouverte depuis l'icône (iOS 16.4 minimum).
   - **Android** (Chrome) : menu ⋮ › *Installer l'application*.
   - Puis Profil › *Activer les notifications*.

Mettre à jour après une modification du code :

```bash
docker compose up -d --build
```

## Admin

Le compte marqué `admin` dans `seed/joueurs.json` (Gwen) voit une section Admin dans son profil :
- **Effacer le code** d'un joueur qui l'a oublié : il en choisit un nouveau à sa prochaine connexion.
- **Ajouter un joueur** avec ses points de départ.

Sécurité du code PIN : 5 erreurs bloquent le prénom 15 minutes, et 20 erreurs depuis une même connexion la bloquent une heure.

## Données

- Source : l'API publique d'ESPN (non officielle, gratuite, sans clé). Tout passe par `server/espn.ts`. Si ESPN change son format, c'est le seul fichier à adapter. En secours, le fichier `games.csv` de [nflverse](https://github.com/nflverse/nfldata) contient les mêmes matchs et les identifiants ESPN.
- Synchronisation : saison complète 1 fois par jour, semaines en cours toutes les heures, **toutes les 2 minutes pendant les matchs**.
- Base SQLite dans le volume Docker `prono-data` (`/data/prono.db`).
  Sauvegarde :
  ```bash
  docker compose cp prono:/data/prono.db ./sauvegarde-prono.db
  ```

## Développement

```bash
npm install
npm run dev
```

L'interface tourne sur http://localhost:5173 et l'API sur le port 3000. Autres commandes :

- `npm run build` : construit l'interface et le serveur dans `dist/` ;
- `npm start` : lance la version construite ;
- `npm run typecheck` : vérifie les types ;
- `npm run icons` : régénère les icônes à partir de `web/public/icon.svg`.

| Dossier | Contenu |
| --- | --- |
| `server/` | Fastify, SQLite (`node:sqlite`), synchro ESPN, points, connexion, notifications |
| `web/src/ds/` | Tokens et composants du design system ([artefact](https://claude.ai/artifact/LumqadSKDa1KpdGUebdBNh)) |
| `web/src/screens/` | Les écrans ([maquettes](https://claude.ai/artifact/1CmahETymQknWdhFefETvM)) |
| `web/src/sw.ts` | Service worker : cache hors ligne et notifications |
| `seed/joueurs.json` | Joueurs et points de départ (lu au tout premier démarrage) |
