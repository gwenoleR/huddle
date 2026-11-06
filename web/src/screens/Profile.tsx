import { useEffect, useState } from 'react';
import { Avatar, Button } from '../ds';
import { api } from '../lib/api';
import { ordinal } from '../lib/format';
import { useProfile } from '../lib/data';
import { disablePush, enablePush, isIos, isStandalone, pushState, type PushState } from '../lib/push';
import type { ThemePref } from '../lib/theme';
import { APP_VERSION, reloadLatest } from '../lib/version';
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
  const pct = p.played ? `${Math.round((p.good * 100) / p.played)} %` : '–';

  return (
    <div className="screen-inner">
      <main className="stack" style={{ paddingTop: 24, gap: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={p.name} size="lg" me />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 className="h1">{p.name}</h1>
            <span className="muted small">
              {ordinal(p.rank)} sur {p.players} · {p.points} pts · saison {p.season}
            </span>
          </div>
        </header>

        <section className="grid-3">
          <div className="card stat">
            <b>{p.good}</b>
            <span className="muted small">{p.startWeek > 1 ? `bons pronos depuis la S${p.startWeek}` : 'bons pronos cette saison'}</span>
          </div>
          <div className="card stat">
            <b>{pct}</b>
            <span className="muted small">de réussite</span>
          </div>
          <div className="card stat">
            <b style={{ color: 'var(--brand)' }}>{p.streak}</b>
            <span className="muted small">bons d’affilée</span>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Semaine par semaine
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
                <span className="wk">{p.startWeek > 1 ? `S1–S${p.startWeek - 1}` : 'Avant'}</span>
                <span className="muted small">Repris de l’ancien site</span>
                <span className="val">{p.startPoints} pts</span>
              </li>
            )}
          </ol>
          <p className="muted small" style={{ margin: 0 }}>
            En vert, les semaines à 70 % ou plus. En playoffs, un bon prono vaut 2 pts.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Réglages
          </h2>
          <div className="card">
            <div className="settings-row">
              <span className="label">Thème</span>
              <div className="segmented">
                {(
                  [
                    ['dark', 'Nuit'],
                    ['light', 'Jour'],
                    ['auto', 'Auto']
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
                <span className="label">Mettre l’appli sur l’écran d’accueil</span>
                <span className="muted small">
                  {isIos()
                    ? 'Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ».'
                    : 'Dans Chrome : menu ⋮, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'}
                </span>
              </div>
            )}
          </div>
        </section>

        {p.isAdmin && (
          <a href="#/admin" className="card admin-link">
            <span className="label">Administration</span>
            <span className="muted small">Joueurs, bonus, données ESPN, import de l’historique</span>
          </a>
        )}

        <Button variant="secondary" block onClick={onLogout}>
          Se déconnecter
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
          Nouvelle version dispo : recharger
        </Button>
      )}
      <span className="muted small">
        Version {APP_VERSION}
        {outdated ? ` · serveur ${server}` : ''}
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
      notify((e as Error).message || 'Impossible d’activer les notifications.');
    } finally {
      setBusy(false);
    }
  };

  const text: Record<PushState, string> = {
    on: 'Activées : rappel 1 h avant un match sans prono, et résultats en fin de semaine.',
    off: 'Un rappel 1 h avant un match sans prono, et les résultats en fin de semaine.',
    denied: 'Bloquées dans les réglages du téléphone. Autorise-les pour ce site, puis reviens ici.',
    'needs-install': 'Sur iPhone, ajoute d’abord l’appli à l’écran d’accueil, puis ouvre-la depuis l’icône.',
    unsupported: 'Ce navigateur ne gère pas les notifications.'
  };

  return (
    <div className="settings-row">
      <span className="label">Notifications</span>
      {state && <span className="muted small">{text[state]}</span>}
      {state === 'off' && (
        <Button disabled={busy} onClick={() => run(enablePush)}>
          Activer les notifications
        </Button>
      )}
      {state === 'on' && (
        <div className="segmented">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              const { sent } = await api<{ sent: number }>('/push/test', { method: 'POST' });
              notify(sent ? 'Notification envoyée' : 'Aucun appareil abonné');
            }}
          >
            M’envoyer un test
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => run(disablePush)}>
            Désactiver
          </Button>
        </div>
      )}
    </div>
  );
}
