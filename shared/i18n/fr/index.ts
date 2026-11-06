/**
 * Dictionnaire français : la référence. Une autre langue (en.ts…) doit avoir exactement la même forme
 * (type Messages) : le typecheck signale toute clé manquante ou en trop.
 * Un fichier par partie de l'appli ; les textes avec des valeurs sont des fonctions.
 */
import { common } from './common';
import { matches } from './matches';
import { match } from './match';
import { team } from './team';
import { leaderboard } from './leaderboard';
import { season } from './season';
import { recap } from './recap';
import { bonus } from './bonus';
import { login } from './login';
import { profile } from './profile';
import { admin } from './admin';
import { app } from './app';
import { api } from './api';
import { notifications } from './notifications';
import { trophies } from './trophies';
import { history } from './history';
import { sync } from './sync';
import { ds } from './ds';
import { espn } from './espn';

export const fr = { common, matches, match, team, leaderboard, season, recap, bonus, login, profile, admin, app, api, notifications, trophies, history, sync, ds, espn };
