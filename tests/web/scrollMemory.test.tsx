// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enterList, useScrollMemory } from '../../web/src/lib/scrollMemory';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A list screen, like Matches: the first element in the scrolling area (.screen). */
function List({ week, ready = true }: { week: number; ready?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollMemory(ref, `matches-${week}`, ready);
  return <div ref={ref}>week {week}</div>;
}

let screen: HTMLDivElement;
let root: Root;
beforeEach(() => {
  enterList('forget'); // start with no remembered position
  location.hash = '#/matches';
  screen = document.createElement('div');
  document.body.appendChild(screen);
  root = createRoot(screen);
});
afterEach(() => {
  act(() => root.unmount());
  screen.remove();
});

/** Navigates like the app: the URL first, then the screen. */
function go(hash: string, el: React.ReactNode) {
  history.replaceState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  act(() => root.render(el));
}
const scrollTo = (top: number) => {
  screen.scrollTop = top;
  screen.dispatchEvent(new Event('scroll'));
};

describe('back to the game list', () => {
  it('restores the same position when coming back from a game page', () => {
    go('#/matches/9', <List week={9} />);
    scrollTo(840);
    go('#/match/401873051', <p>game page</p>);
    screen.scrollTop = 0;
    go('#/matches/9', <List week={9} />);
    expect(screen.scrollTop).toBe(840);
  });

  it('only once: coming back to the week later starts at the top', () => {
    go('#/matches/9', <List week={9} />);
    scrollTo(840);
    go('#/match/1', <p>game</p>);
    go('#/matches/9', <List week={9} />);
    go('#/standings', <p>standings</p>);
    screen.scrollTop = 0;
    go('#/matches/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('changing week starts at the top', () => {
    go('#/matches/9', <List week={9} />);
    scrollTo(840);
    go('#/matches/10', <List week={10} />);
    expect(screen.scrollTop).toBe(0);
    // …and so does going back to week 9.
    scrollTo(200);
    go('#/matches/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('changing tab starts at the top', () => {
    go('#/matches/9', <List week={9} />);
    scrollTo(840);
    go('#/standings', <p>standings</p>);
    screen.scrollTop = 0;
    go('#/matches/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('game page, then another tab, then Matches: at the top', () => {
    go('#/matches/9', <List week={9} />);
    scrollTo(840);
    go('#/match/1', <p>game</p>);
    go('#/profile', <p>profile</p>);
    screen.scrollTop = 0;
    go('#/matches/9', <List week={9} />);
    expect(screen.scrollTop).toBe(0);
  });

  it('waits for the games to be displayed before restoring the position', () => {
    go('#/matches/12', <List week={12} />);
    scrollTo(500);
    go('#/match/1', <p>game</p>);
    screen.scrollTop = 0;
    go('#/matches/12', <List week={12} ready={false} />);
    expect(screen.scrollTop).toBe(0);
    act(() => root.render(<List week={12} ready />));
    expect(screen.scrollTop).toBe(500);
  });
});
