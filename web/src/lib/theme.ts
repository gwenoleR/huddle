import { useEffect, useState } from 'react';

export type ThemePref = 'dark' | 'light' | 'auto';
const KEY = 'prono-theme';
const COLORS = { dark: '#0d131d', light: '#f3f1ea' };

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light' || v === 'auto') return v;
  } catch {
    /* stockage indisponible : thème par défaut */
  }
  return 'dark';
}

const media = () => matchMedia('(prefers-color-scheme: light)');

function apply(pref: ThemePref) {
  const theme = pref === 'auto' ? (media().matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
  return theme;
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => apply(read()));

  useEffect(() => {
    setTheme(apply(pref));
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
    if (pref !== 'auto') return;
    const m = media();
    const onChange = () => setTheme(apply('auto'));
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [pref]);

  return { pref, setPref, theme };
}
