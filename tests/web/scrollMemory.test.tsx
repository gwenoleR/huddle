// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enterList, useScrollMemory } from '../../web/src/lib/scrollMemory';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Un écran de liste, comme Matchs : le premier élément dans la zone qui défile (.screen). */
function List({ week, ready = true }: { week: number; ready?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollMemory(ref, `matchs-${week}`, ready);
  return <div ref={ref}>semaine {week}</div>;
}

let screen: HTMLDivElement;
let root: Root;
beforeEach(() => {
  enterList('oublie'); // repart sans position retenue
  location.hash = '#/matchs';
  screen = document.createElement('div');
  document.body.appendChild(screen);
  root = createRoot(screen);
});
afterEach(() => {
  act(() => root.unmount());
  screen.remove();
});

/** Change de page comme l'appli : l'adresse d'abord, puis l'écran. */
function go(hash: string, el: React.ReactNode) {
  history.replaceState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  act(() => root.render(el));
}
const scrollTo = (top: number) => {
  screen.scrollTop = top;
  screen.dispatchEvent(new Event('scroll'));
};

describe('retour sur la liste des matchs', () => {
  it('reprend au même endroit en revenant d’une fiche match', () => {
    go('#/matchs/9', <List week={9} />);
    scrollTo(840);
    go('#/match/401873051', <p>fiche match</p>);
    screen.scrollTop = 0;
    go('#/matchs/9', <List week={9} />);
    expect(screen.scrollTop).toBe(840);
  });

  it('une seule fois : revenir plus tard sur la semaine repart en haut', () => {
    go('#/matchs/9', <List week={9} />);
    scrollTo(840);
    go('#/match/1', <p>fiche</p>);
    go('#/matchs/9', <List week={9} />);
    go('#/classement', <p>classement</p>);
    screen.scrollTop = 0;
    go('#/matchs/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('changer de semaine repart en haut', () => {
    go('#/matchs/9', <List week={9} />);
    scrollTo(840);
    go('#/matchs/10', <List week={10} />);
    expect(screen.scrollTop).toBe(0);
    // …et revenir sur la semaine 9 aussi.
    scrollTo(200);
    go('#/matchs/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('changer d’onglet repart en haut', () => {
    go('#/matchs/9', <List week={9} />);
    scrollTo(840);
    go('#/classement', <p>classement</p>);
    screen.scrollTop = 0;
    go('#/matchs/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('fiche, puis autre onglet, puis Matchs : en haut', () => {
    go('#/matchs/9', <List week={9} />);
    scrollTo(840);
    go('#/match/1', <p>fiche</p>);
    go('#/profil', <p>profil</p>);
    screen.scrollTop = 0;
    go('#/matchs/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('attend que les matchs soient affichés avant de se replacer', () => {
    go('#/matchs/12', <List week={12} />);
    scrollTo(500);
    go('#/match/1', <p>fiche</p>);
    screen.scrollTop = 0;
    go('#/matchs/12', <List week={12} ready={false} />);
    expect(screen.scrollTop).toBe(0);
    act(() => root.render(<List week={12} ready />));
    expect(screen.scrollTop).toBe(500);
  });
});
