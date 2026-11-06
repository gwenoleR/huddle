// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dayLabel, kickoffLabel, ordinal, timeLabel } from '../../web/src/lib/format';
import { applyConfig, t } from '../../web/src/lib/i18n';
import { standingText } from '../../web/src/lib/labels';

// The app switches language from the instance settings, before the first render.
applyConfig({ appName: 'Huddle', appShortName: 'Huddle', lang: 'en', points: { regular: 1, playoffs: 2 } });

describe('app in English', () => {
  it('the page itself', () => {
    expect(document.documentElement.lang).toBe('en');
    expect(t.common.locale).toBe('en-US');
  });

  it('12-hour times, US dates (tests run on Paris time)', () => {
    const sunday = Date.parse('2026-11-08T18:00:00Z');
    expect(kickoffLabel(sunday)).toBe('Sun 7:00 PM');
    expect(timeLabel(Date.parse('2026-11-10T01:15:00Z'))).toBe('2:15 AM');
    expect(dayLabel(sunday)).toBe('Sun, Nov 8');
  });

  it('ordinals and NFL standing', () => {
    expect([ordinal(1), ordinal(2), ordinal(3), ordinal(11)]).toEqual(['1st', '2nd', '3rd', '11th']);
    const st = { conference: 'AFC', division: 'AFC East', divRank: 1, seed: 3, clinch: null } as never;
    expect(standingText(st)).toMatch(/^1st AFC East · 3rd seed$/);
  });
});
