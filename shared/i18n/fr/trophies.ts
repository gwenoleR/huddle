/** Season trophies: titles, rules and details (computed by the server). Keys = trophy ids. */
import { common } from './common';

export const trophies = {
  'best-week': {
    title: 'Meilleure semaine',
    rule: 'Le plus grand nombre de bons pronos en une seule semaine. À égalité, la semaine avec le moins de matchs l’emporte (13 sur 13 bat 13 sur 16).',
    /** « 13 sur 14 en semaine 9 » (week = the week's long label). */
    detail: (good: number, finals: number, week: string) => `${good} sur ${finals} en ${week.toLowerCase()}`
  },
  sniper: {
    title: 'Le sniper',
    rule: 'Le meilleur taux de réussite de la saison. Il faut au moins 10 matchs joués pour être classé, histoire que 2 sur 2 ne suffise pas.',
    detail: (good: number, played: number) => `${Math.round((good * 100) / played)} % de réussite (${good} sur ${played})`
  },
  streak: {
    title: 'Inarrêtable',
    rule: 'La plus longue série de bons pronos d’affilée, dans l’ordre des coups d’envoi. Il faut au moins 5 bons de suite. Un match sans prono ne casse pas la série.',
    detail: (n: number) => `${n} bons pronos d’affilée`
  },
  contrarian: {
    title: 'À contre-courant',
    rule: 'Le plus de pronos contre l’avis de la majorité de la bande, bons ou mauvais. Les matchs où la bande est partagée à égalité ne comptent pas.',
    detail: (n: number) => `${common.pronos(n)} contre la majorité`
  },
  heart: {
    title: 'Le cœur avant la tête',
    rule: 'L’équipe choisie le plus souvent par un même joueur. Il faut l’avoir prise au moins 3 fois.',
    detail: (team: string, n: number) => `les ${team}, ${n} fois`
  },
  'black-cat': {
    title: 'Le chat noir',
    rule: 'L’équipe qui a fait perdre le plus de pronos à un même joueur : il l’a prise et elle a perdu. À partir de 3 trahisons.',
    detail: (team: string, n: number) => `les ${team} l’ont trahi ${n} fois`
  },
  'last-minute': {
    title: 'Sur le fil',
    rule: 'Le plus de pronos faits (ou changés) dans les 15 dernières minutes avant le coup d’envoi. À partir de 3.',
    detail: (n: number) => `${common.pronos(n)} dans le dernier quart d’heure`
  },
  nostradamus: {
    title: 'Nostradamus',
    rule: 'Avoir annoncé le vainqueur du Super Bowl dans le bonus de fin de saison, avant même la Wild Card. Si plusieurs l’ont trouvé, le plus proche du total de points du Super Bowl l’emporte.',
    /** gap = distance from the actual Super Bowl total points (0 = spot on). */
    detail: (team: string, total: number, gap: number) =>
      `Les ${team} champions, annoncés avant la Wild Card · ${total} pts au total (${gap ? `écart ${gap}` : 'pile poil !'})`
  }
};
