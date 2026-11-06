# Prono NFL entre potes

L'appli de pronos NFL de la bande : une PWA mobile à installer sur l'écran d'accueil, hébergée à la maison dans Docker et exposée par le tunnel Cloudflare déjà en place.

- **Matchs** de la semaine avec les logos, un tap pour pronostiquer, la répartition de la bande sous chaque match.
- **Verrouillage** au coup d'envoi (côté serveur), **scores en direct**, points calculés automatiquement.
- **Classement** saison / semaine, **profil** semaine par semaine, **bilan de saison** avec trophées.
- **Saison après saison** : la nouvelle saison prend le relais toute seule le 1er juin (calendrier ESPN publié, on peut déjà pronostiquer la semaine 1). Jusque-là, la saison finie reste affichée. Les saisons passées restent consultables : lien « Saisons précédentes » en bas du Classement, vers leur bilan (classement final et trophées).
- **Notifications** : rappel 1 h avant un match sans prono, résultats quand une semaine est terminée.

Barème : 1 point par bon prono en saison régulière, **2 points en playoffs**. Les pronos des semaines 1 à 8 viennent de l'ancien site (importés en CSV depuis l'écran admin).

## Mise en route sur le serveur

1. **Brancher le tunnel Cloudflare existant** : dans Zero Trust › Networks › Tunnels › ton tunnel › *Public Hostname*, ajouter `prono.ton-domaine.fr` → service `HTTP`, URL `<ip-du-serveur>:3847`. Si ton cloudflared est sur un réseau Docker partagé, voir la variante commentée dans `docker-compose.yml` : l'URL devient alors `prono:3000`.
2. **Se connecter au registre** (l'image est privée), une seule fois par serveur. Il faut un jeton GitHub *classic* avec le droit `read:packages` (Settings › Developer settings › Personal access tokens), collé comme mot de passe :
   ```bash
   docker login ghcr.io -u gwenoleR
   ```
3. **Préparer un dossier** : pas besoin de cloner le dépôt, tout est dans l'image. Il suffit de `docker-compose.yml` et d'un `.env` :
   ```bash
   mkdir -p ~/prono && cd ~/prono
   ```
   Y copier [`docker-compose.yml`](docker-compose.yml) (par `scp` depuis le Mac, ou en copiant-collant son contenu), puis créer le `.env` :
   ```bash
   echo "PUBLIC_URL=https://prono.ton-domaine.fr" > .env
   ```
   Si `docker compose pull` répond `unauthorized`, c'est que l'étape 2 manque.
4. **Lancer** :
   ```bash
   docker compose pull && docker compose up -d
   ```
   Au premier démarrage, l'appli télécharge les 32 équipes, leurs logos et les 272 matchs de la saison (environ 30 s). La base est vide : les logs disent « aucun joueur : ouvre … pour créer ton groupe ».
5. **Créer le groupe** : le premier qui ouvre l'adresse choisit son prénom et son code, et devient l'admin. Il ajoute ensuite les autres depuis Profil › Admin. Chacun choisit son prénom : **le premier code tapé devient son code**. Tant que le groupe n'est pas créé, n'importe qui ayant l'adresse peut le créer : fais-le juste après le premier démarrage.
6. Installer l'appli :
   - **iPhone** (Safari) : Partager › *Sur l'écran d'accueil*. Les notifications ne marchent qu'une fois l'appli ouverte depuis l'icône (iOS 16.4 minimum). Une appli ajoutée avant le 4 novembre 2026 garde une bande en bas d'écran (barre d'état translucide, lue par iOS à l'installation) : supprimer l'icône et la rajouter.
   - **Android** (Chrome) : menu ⋮ › *Installer l'application*.
   - Puis Profil › *Activer les notifications*.

### Mettre à jour

Chaque push sur `main` déclenche GitHub Actions, qui construit l'image et la publie sur `ghcr.io/gwenoler/pronos`, avec les tags `latest` et `sha-<hash court du commit>` (ex. `sha-daade27`). Une fois le build terminé (onglet Actions du dépôt, environ 2 min), sur le serveur :

```bash
docker compose pull && docker compose up -d
```

Pour revenir à une version précise, remplacer `latest` par son tag `sha-…` dans `docker-compose.yml`. Pour tester une image construite en local sans passer par GitHub : `docker build -t ghcr.io/gwenoler/pronos:latest .` dans le dépôt, puis `docker compose up -d`.

## Admin

Le créateur du groupe est admin, et peut nommer d'autres admins. Les admins voient une section Admin dans leur profil :
- **Ajouter un joueur**, avec des points de départ s'il arrive en cours de saison. Les points de départ valent pour la saison en cours seulement : tout le monde repart de 0 la saison suivante.
- Pour chaque joueur (toucher son nom) : **renommer**, **effacer le code** (il en choisit un nouveau à sa prochaine connexion), **nommer / retirer admin**, **supprimer** (ses pronos disparaissent avec lui). On ne peut ni se supprimer ni se retirer ses propres droits : il reste toujours un admin.
- **Importer l'historique** : les semaines jouées ailleurs, en CSV. Une ligne d'en-têtes `,Home,Away,Prono GW,Prono AU,…` (les deux premières lettres du prénom, sans tenir compte des accents), puis une ligne par match avec les noms complets des équipes (`Kansas City Chiefs`), `Week1` en première colonne sur le premier match de chaque semaine, une case vide pour un prono manquant. Le fichier est d'abord vérifié à blanc (combien de pronos, pour qui), puis importé sur confirmation. C'est tout ou rien : à la moindre erreur, rien n'est écrit et tous les problèmes sont listés. Les points de départ des joueurs du fichier repassent à 0.

Sécurité du code PIN : 5 erreurs bloquent le prénom 15 minutes, et 20 erreurs depuis une même connexion la bloquent une heure.

## Données

- Source : l'API publique d'ESPN (non officielle, gratuite, sans clé). Tout passe par `server/espn.ts`. Si ESPN change son format, c'est le seul fichier à adapter. En secours, le fichier `games.csv` de [nflverse](https://github.com/nflverse/nfldata) contient les mêmes matchs et les identifiants ESPN.
- Saison suivie : celle en cours d'après la date (voir plus haut). Pour la figer (tests, démo), variable `SEASON=2026`.
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
- `npm test` : lance les tests (`npm run test:watch` pour les relancer à chaque modification) ;
- `npm run icons` : régénère les icônes à partir de `web/public/icon.svg`.

| Dossier | Contenu |
| --- | --- |
| `server/` | Fastify, SQLite (`node:sqlite`), synchro ESPN, points, connexion, notifications |
| `server/routes/` | Routes de l'API, un fichier par domaine (connexion, matchs, classement, bonus, NFL, admin, notifications) |
| `server/schema.ts` | Tables de la base, en migrations numérotées : pour changer la base, **ajouter** une migration à la fin |
| `shared/api.ts` | Forme des réponses de l'API, partagée par le serveur et l'appli |
| `web/src/ds/` | Tokens et composants du design system, un fichier par composant avec son CSS ([artefact](https://claude.ai/artifact/LumqadSKDa1KpdGUebdBNh)) |
| `web/src/screens/` | Les écrans ([maquettes](https://claude.ai/artifact/1CmahETymQknWdhFefETvM)) |
| `web/src/sw.ts` | Service worker : cache hors ligne et notifications |
| `tests/` | Tests Vitest : base SQLite en mémoire, réponses ESPN enregistrées dans `tests/fixtures/espn` |

### Tests

Chaque nouvelle fonctionnalité ou correction arrive avec ses tests. Ils ne touchent jamais à `data/` et n'appellent ni ESPN ni les serveurs de notifications : chaque fichier de test a sa propre base en mémoire (voir `tests/server/helpers.ts` pour fabriquer joueurs, matchs et pronos). En CI, les types et les tests passent avant la construction de l'image Docker : si l'un échoue, rien n'est publié.

Pour rafraîchir une réponse ESPN enregistrée, la télécharger, puis ne garder que les champs lus par `server/espn.ts`.
