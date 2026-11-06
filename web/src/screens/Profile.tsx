import { useEffect, useState } from 'react';
import { Avatar, Button } from '../ds';
import { api } from '../lib/api';
import { ordinal } from '../lib/format';
import { useProfile } from '../lib/data';
import { disablePush, enablePush, isIos, isStandalone, pushState, type PushState } from '../lib/push';
import type { ThemePref } from '../lib/theme';
import { APP_VERSION, reloadLatest } from '../lib/version';
import { config, t } from '../lib/i18n';
import { Loading } from './shared';

export function Profile({
  themePref,
  setThemePref,
  onLogout,
  notify
}: {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  onLogout: () => void;
  notify: (m: string) => void;
}) {
  const q = useProfile();
  const p = q.data;
  const error = q.error?.message ?? null;

  if (!p) return error ? <p className="error-box">{error}</p> : <Loading />;
  const pct = p.played ? t.profile.percent(Math.round((p.good * 100) / p.played)) : '–';

  return (
    <div className="screen-inner">
      <main className="stack" style={{ paddingTop: 24, gap: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={p.name} size="lg" me />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 className="h1">{p.name}</h1>
            <span className="muted small">
              {t.profile.subtitle(ordinal(p.rank), p.players, p.points, p.season)}
            </span>
          </div>
        </header>

        <section className="grid-3">
          <div className="card stat">
            <b>{p.good}</b>
            <span className="muted small">{t.profile.goodPicksLabel(p.startWeek)}</span>
          </div>
          <div className="card stat">
            <b>{pct}</b>
            <span className="muted small">{t.profile.successLabel}</span>
          </div>
          <div className="card stat">
            <b style={{ color: 'var(--brand)' }}>{p.streak}</b>
            <span className="muted small">{t.profile.streakLabel}</span>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {t.profile.byWeek}
          </h2>
          <ol className="week-rows card">
            {p.weeks.map((w) => {
              const r = w.finals ? w.good / w.finals : 0;
              return (
                <li key={w.week}>
                  <span className="wk">{w.label}</span>
                  <span className="bar">
                    <span style={{ width: `${Math.round(r * 100)}%`, background: r >= 0.7 ? 'var(--brand)' : 'var(--ink-muted)' }} />
                  </span>
                  <span className="val">
                    {w.good} / {w.finals}
                  </span>
                </li>
              );
            })}
            {p.startPoints > 0 && (
              <li>
                <span className="wk">{t.profile.carriedWeeks(p.startWeek)}</span>
                <span className="muted small">{t.profile.carriedFrom}</span>
                <span className="val">{t.profile.carriedPoints(p.startPoints)}</span>
              </li>
            )}
          </ol>
          <p className="muted small" style={{ margin: 0 }}>
            {t.profile.byWeekHelp(config.points.playoffs)}
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {t.profile.settings}
          </h2>
          <div className="card">
            <div className="settings-row">
              <span className="label">{t.profile.theme}</span>
              <div className="segmented">
                {(
                  [
                    ['dark', t.profile.themeDark],
                    ['light', t.profile.themeLight],
                    ['auto', t.profile.themeAuto]
                  ] as const
                ).map(([v, l]) => (
                  <Button key={v} variant={themePref === v ? 'primary' : 'secondary'} onClick={() => setThemePref(v)}>
                    {l}
                  </Button>
                ))}
              </div>
            </div>
            <PushSettings notify={notify} />
            {!isStandalone() && (
              <div className="settings-row">
                <span className="label">{t.profile.install}</span>
                <span className="muted small">
                  {isIos()
                    ? t.profile.installIos
                    : t.profile.installOther}
                </span>
              </div>
            )}
          </div>
        </section>

        {p.isAdmin && (
          <a href="#/admin" className="card admin-link">
            <span className="label">{t.profile.admin}</span>
            <span className="muted small">{t.profile.adminHelp}</span>
          </a>
        )}

        <Button variant="secondary" block onClick={onLogout}>
          {t.profile.logout}
        </Button>
        <VersionRow />
      </main>
    </div>
  );
}

function VersionRow() {
  const [server, setServer] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setServer(d.version ?? null))
      .catch(() => {});
  }, []);
  const outdated = server !== null && server !== APP_VERSION;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {outdated && (
        <Button block onClick={reloadLatest}>
          {t.profile.newVersion}
        </Button>
      )}
      <span className="muted small">
        {t.profile.version(APP_VERSION, outdated ? server : null)}
      </span>
    </div>
  );
}

function PushSettings({ notify }: { notify: (m: string) => void }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    try {
      setState(await fn());
    } catch (e) {
      notify((e as Error).message || t.profile.pushError);
    } finally {
      setBusy(false);
    }
  };

  const text: Record<PushState, string> = {
    on: t.profile.pushOn,
    off: t.profile.pushOff,
    denied: t.profile.pushDenied,
    'needs-install': t.profile.pushNeedsInstall,
    unsupported: t.profile.pushUnsupported
  };

  return (
    <div className="settings-row">
      <span className="label">{t.profile.notifications}</span>
      {state && <span className="muted small">{text[state]}</span>}
      {state === 'off' && (
        <Button disabled={busy} onClick={() => run(enablePush)}>
          {t.profile.pushEnable}
        </Button>
      )}
      {state === 'on' && (
        <div className="segmented">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              const { sent } = await api<{ sent: number }>('/push/test', { method: 'POST' });
              notify(sent ? t.profile.pushTestSent : t.profile.pushTestNoDevice);
            }}
          >
            {t.profile.pushTest}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => run(disablePush)}>
            {t.profile.pushDisable}
          </Button>
        </div>
      )}
    </div>
  );
}
