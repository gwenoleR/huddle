// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCard, initials, type Side, type Team } from '../../web/src/ds';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BUF: Team = { abbr: 'BUF', name: 'Bills', logoUrl: '/logos/buf.png' };
const KC: Team = { abbr: 'KC', name: 'Chiefs', logoUrl: '/logos/kc.png' };

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

const card = (props: Partial<Parameters<typeof MatchCard>[0]> = {}) =>
  act(() => root.render(<MatchCard away={BUF} home={KC} kickoff="dim. 19:00" {...props} />));
/** Le bouton d'une équipe, par son nom (comme le lit un lecteur d'écran). */
const side = (name: string) => [...el.querySelectorAll<HTMLButtonElement>('button.pr-side')].find((b) => b.getAttribute('aria-label')?.startsWith(name))!;

describe('MatchCard : faire son prono', () => {
  it('un toucher sur une équipe la choisit', () => {
    const onPick = vi.fn<(s: Side) => void>();
    card({ onPick });
    act(() => side('Chiefs').click());
    expect(onPick).toHaveBeenCalledWith('home');
    act(() => side('Bills').click());
    expect(onPick).toHaveBeenLastCalledWith('away');
  });

  it('mon prono est marqué, pour moi et pour un lecteur d’écran', () => {
    card({ onPick: () => {}, myPick: 'away' });
    expect(side('Bills').getAttribute('aria-pressed')).toBe('true');
    expect(side('Bills').getAttribute('aria-label')).toBe('Bills, ton prono');
    expect(side('Chiefs').getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['locked', 'live', 'final'] as const)('rien ne se passe quand le match est %s', (status) => {
    const onPick = vi.fn();
    card({ onPick, status, score: status === 'locked' ? null : { away: 7, home: 3 } });
    expect(side('Bills').disabled).toBe(true);
    act(() => side('Bills').click());
    expect(onPick).not.toHaveBeenCalled();
  });

  it('sans onPick (fiche d’un match qui ne compte pas), les équipes ne sont pas cliquables', () => {
    card({ status: 'open' });
    expect(side('Bills').disabled).toBe(true);
  });
});

describe('MatchCard : ce que la bande a choisi', () => {
  it('compte de chaque côté et avatars de ceux qui ont choisi', () => {
    card({ awayPickers: ['Gwen', 'Bea'], homePickers: ['Audrey'] });
    expect(el.querySelector('.pr-split-bar')!.getAttribute('aria-label')).toBe('2 pour Bills, 1 pour Chiefs');
    const names = [...el.querySelectorAll('.pr-stack .pr-avatar[title]')].map((a) => a.getAttribute('title'));
    expect(names).toEqual(['Gwen', 'Bea', 'Audrey']);
  });

  it('au-delà de 4, un « +N »', () => {
    card({ awayPickers: ['A', 'B', 'C', 'D', 'E', 'F'] });
    expect(el.querySelector('.pr-more')!.textContent).toBe('+2');
  });

  it('personne n’a encore joué : un message, pas d’avatars', () => {
    card({ emptyText: 'Sois le premier' });
    expect(el.textContent).toContain('Sois le premier');
    expect(el.querySelector('.pr-split-people')).toBeNull();
  });
});

describe('MatchCard : score et verdict', () => {
  it('avant le match : « @ » ; après : le score', () => {
    card();
    expect(el.querySelector('.pr-at')!.textContent).toBe('@');
    card({ status: 'live', score: { away: 14, home: 10 } });
    expect(el.querySelector('.pr-score')!.textContent).toBe('14–10');
  });

  it('match terminé : bon prono en vert, l’équipe battue estompée', () => {
    card({ status: 'final', score: { away: 24, home: 17 }, myPick: 'away' });
    expect(el.querySelector('.pr-match')!.classList).toContain('pr-match-win');
    expect(el.querySelector('.pr-pill')!.textContent).toContain('Bon prono');
    expect(side('Chiefs').classList).toContain('pr-side-lost');
  });

  it('match terminé : prono raté', () => {
    card({ status: 'final', score: { away: 24, home: 17 }, myPick: 'home' });
    expect(el.querySelector('.pr-match')!.classList).toContain('pr-match-loss');
    expect(el.querySelector('.pr-pill')!.textContent).toContain('Raté');
  });
});

describe('initiales des avatars', () => {
  it('deux lettres, en majuscules', () => {
    expect(initials('Gwen')).toBe('GW');
    expect(initials('jean pierre')).toBe('JP');
    expect(initials('')).toBe('?');
  });
});
