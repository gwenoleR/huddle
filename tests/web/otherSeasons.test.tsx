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

describe('lien vers les autres saisons', () => {
  it('une seule saison : rien du tout', () => {
    act(() => root.render(<OtherSeasons seasons={[2026]} shown={2026} current={2026} label="Saisons précédentes" />));
    expect(el.innerHTML).toBe('');
  });

  it('depuis la saison en cours : les saisons passées, vers leur bilan', () => {
    act(() => root.render(<OtherSeasons seasons={[2026, 2025, 2024]} shown={2026} current={2026} label="Saisons précédentes" />));
    expect(el.textContent).toBe('Saisons précédentes : 2025 · 2024');
    expect(links()).toEqual([
      ['2025', '#/bilan/2025'],
      ['2024', '#/bilan/2024']
    ]);
  });

  it('depuis une saison passée : retour possible vers la saison en cours', () => {
    act(() => root.render(<OtherSeasons seasons={[2026, 2025]} shown={2025} current={2026} label="Autres saisons" />));
    expect(links()).toEqual([['2026', '#/bilan']]);
  });
});
