// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { BottomNav } from '../../web/src/ds';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('bottom navigation', () => {
  it('three tabs, each with its icon drawn, the active one marked', () => {
    const el = document.createElement('div');
    const root = createRoot(el);
    act(() => root.render(<BottomNav active="standings" />));
    const buttons = [...el.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Matchs', 'Classement', 'Profil']);
    expect(buttons.map((b) => b.querySelectorAll('svg path').length)).toEqual([5, 6, 2]);
    expect(buttons.map((b) => b.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    act(() => root.unmount());
  });
});
