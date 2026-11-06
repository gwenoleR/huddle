/**
 * English dictionary. Must have exactly the same shape as the French reference (type Messages):
 * the typecheck flags any missing or extra key.
 * One file per part of the app; texts with values are functions.
 */
import type { Messages } from '../index';
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

export const en: Messages = { common, matches, match, team, leaderboard, season, recap, bonus, login, profile, admin, app, api, notifications, trophies, history, sync, ds, espn };
