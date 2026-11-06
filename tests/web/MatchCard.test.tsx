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
/** A team's button, by its name (as a screen reader reads it). */
const side = (name: string) => [...el.querySelectorAll<HTMLButtonElement>('button.pr-side')].find((b) => b.getAttribute('aria-label')?.startsWith(name))!;

describe('MatchCard: making a pick', () => {
  it('tapping a team picks it', () => {
    const onPick = vi.fn<(s: Side) => void>();
    card({ onPick });
    act(() => side('Chiefs').click());
    expect(onPick).toHaveBeenCalledWith('home');
    act(() => side('Bills').click());
    expect(onPick).toHaveBeenLastCalledWith('away');
  });

  it('my pick is marked, for me and for a screen reader', () => {
    card({ onPick: () => {}, myPick: 'away' });
    expect(side('Bills').getAttribute('aria-pressed')).toBe('true');
    expect(side('Bills').getAttribute('aria-label')).toBe('Bills, ton prono');
    expect(side('Chiefs').getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['locked', 'live', 'final'] as const)('nothing happens when the game is %s', (status) => {
    const onPick = vi.fn();
    card({ onPick, status, score: status === 'locked' ? null : { away: 7, home: 3 } });
    expect(side('Bills').disabled).toBe(true);
    act(() => side('Bills').click());
    expect(onPick).not.toHaveBeenCalled();
  });

  it('without onPick (page of a game that doesn\'t count), teams are not clickable', () => {
    card({ status: 'open' });
    expect(side('Bills').disabled).toBe(true);
  });
});

describe('MatchCard: what the group picked', () => {
  it('count on each side and avatars of those who picked', () => {
    card({ awayPickers: ['Gwen', 'Bea'], homePickers: ['Audrey'] });
    expect(el.querySelector('.pr-split-bar')!.getAttribute('aria-label')).toBe('2 pour Bills, 1 pour Chiefs');
    const names = [...el.querySelectorAll('.pr-stack .pr-avatar[title]')].map((a) => a.getAttribute('title'));
    expect(names).toEqual(['Gwen', 'Bea', 'Audrey']);
  });

  it('beyond 4, a "+N"', () => {
    card({ awayPickers: ['A', 'B', 'C', 'D', 'E', 'F'] });
    expect(el.querySelector('.pr-more')!.textContent).toBe('+2');
  });

  it('nobody has picked yet: a message, no avatars', () => {
    card({ emptyText: 'Sois le premier' });
    expect(el.textContent).toContain('Sois le premier');
    expect(el.querySelector('.pr-split-people')).toBeNull();
  });
});

describe('MatchCard: score and verdict', () => {
  it('before the game: "@"; after: the score', () => {
    card();
    expect(el.querySelector('.pr-at')!.textContent).toBe('@');
    card({ status: 'live', score: { away: 14, home: 10 } });
    expect(el.querySelector('.pr-score')!.textContent).toBe('14–10');
  });

  it('final game: correct pick in green, losing team faded', () => {
    card({ status: 'final', score: { away: 24, home: 17 }, myPick: 'away' });
    expect(el.querySelector('.pr-match')!.classList).toContain('pr-match-win');
    expect(el.querySelector('.pr-pill')!.textContent).toContain('Bon prono');
    expect(side('Chiefs').classList).toContain('pr-side-lost');
  });

  it('final game: missed pick', () => {
    card({ status: 'final', score: { away: 24, home: 17 }, myPick: 'home' });
    expect(el.querySelector('.pr-match')!.classList).toContain('pr-match-loss');
    expect(el.querySelector('.pr-pill')!.textContent).toContain('Raté');
  });
});

describe('avatar initials', () => {
  it('two letters, uppercase', () => {
    expect(initials('Gwen')).toBe('GW');
    expect(initials('jean pierre')).toBe('JP');
    expect(initials('')).toBe('?');
  });
});
