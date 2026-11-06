// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OtherSeasons } from '../../web/src/screens/shared';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement('div');
  root = createRoot(el);
});
afterEach(() => act(() => root.unmount()));

const links = () => [...el.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);

describe('link to other seasons', () => {
  it('a single season: nothing at all', () => {
    act(() => root.render(<OtherSeasons seasons={[2026]} shown={2026} current={2026} label="Saisons précédentes" />));
    expect(el.innerHTML).toBe('');
  });

  it('from the current season: past seasons, linking to their summary', () => {
    act(() => root.render(<OtherSeasons seasons={[2026, 2025, 2024]} shown={2026} current={2026} label="Saisons précédentes" />));
    expect(el.textContent).toBe('Saisons précédentes : 2025 · 2024');
    expect(links()).toEqual([
      ['2025', '#/season/2025'],
      ['2024', '#/season/2024']
    ]);
  });

  it('from a past season: can go back to the current season', () => {
    act(() => root.render(<OtherSeasons seasons={[2026, 2025]} shown={2025} current={2026} label="Autres saisons" />));
    expect(links()).toEqual([['2026', '#/season']]);
  });
});
