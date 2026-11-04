import { useEffect, useState, type FormEvent } from 'react';
import { Avatar, Button } from '../ds/components';
import { api, type ApiError, type ProfileDto } from '../lib/api';
import { ordinal } from '../lib/format';
import { disablePush, enablePush, isIos, isStandalone, pushState, type PushState } from '../lib/push';
import type { ThemePref } from '../lib/theme';
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
  const [p, setP] = useState<ProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProfileDto>('/profile').then(setP).catch((e) => setError(e.message));
  }, []);

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
            <span className="muted small">bons pronos depuis la S{p.startWeek}</span>
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
            <li>
              <span className="wk">S1–S{p.startWeek - 1}</span>
              <span className="muted small">Repris de l’ancien site</span>
              <span className="val">{p.startPoints} pts</span>
            </li>
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

        {p.isAdmin && <AdminPanel notify={notify} />}

        <Button variant="secondary" block onClick={onLogout}>
          Se déconnecter
        </Button>
      </main>
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

interface SyncStatus {
  at: number | null;
  ok: boolean;
  message: string;
  games: number;
}

const syncTime = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit' });

function SyncRow({ notify }: { notify: (m: string) => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SyncStatus>('/admin/sync').then(setStatus).catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    try {
      const s = await api<SyncStatus>('/admin/sync', { method: 'POST' });
      setStatus(s);
      notify(`Synchro faite : ${s.games} matchs`);
    } catch (e) {
      const err = e as ApiError;
      if (err.data?.at !== undefined) setStatus(err.data as SyncStatus);
      notify(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-row">
      <span className="label">Données ESPN</span>
      {status && (
        <span className="small" style={{ color: status.ok ? 'var(--ink-muted)' : 'var(--wrong)' }}>
          {status.at ? `${status.ok ? 'Dernière synchro' : 'Échec'} ${syncTime.format(status.at)} · ` : ''}
          {status.ok ? `${status.games} matchs en base` : status.message}
        </span>
      )}
      <Button variant="secondary" disabled={busy} onClick={run}>
        {busy ? 'Synchro en cours… (≈ 15 s)' : 'Synchroniser maintenant'}
      </Button>
    </div>
  );
}

interface AdminPlayer {
  id: number;
  name: string;
  startPoints: number;
  isAdmin: boolean;
  hasPin: boolean;
}

function AdminPanel({ notify }: { notify: (m: string) => void }) {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [name, setName] = useState('');
  const [points, setPoints] = useState('0');
  const load = () => api<AdminPlayer[]>('/admin/players').then(setPlayers).catch((e) => notify(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/admin/players', { method: 'POST', body: { name, startPoints: Number(points) } });
      notify(`${name} ajouté`);
      setName('');
      setPoints('0');
      void load();
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function reset(p: AdminPlayer) {
    if (!confirm(`Effacer le code de ${p.name} ? Il en choisira un nouveau à sa prochaine connexion.`)) return;
    await api(`/admin/players/${p.id}/reset-pin`, { method: 'POST' });
    notify(`Code de ${p.name} effacé`);
    void load();
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        Admin
      </h2>
      <div className="card">
        <SyncRow notify={notify} />
        <div className="settings-row">
          {players.map((p) => (
            <div key={p.id} className="admin-player">
              <Avatar name={p.name} size="sm" />
              <span>{p.name}</span>
              {p.hasPin ? (
                <Button variant="ghost" onClick={() => reset(p)}>
                  Effacer le code
                </Button>
              ) : (
                <span className="muted small">Pas encore connecté</span>
              )}
            </div>
          ))}
        </div>
        <form className="settings-row" onSubmit={add}>
          <span className="label">Ajouter un joueur</span>
          <label className="muted small" htmlFor="new-name">
            Prénom
          </label>
          <input id="new-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />
          <label className="muted small" htmlFor="new-points">
            Points de départ
          </label>
          <input id="new-points" className="field" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} />
          <Button type="submit">Ajouter</Button>
        </form>
      </div>
    </section>
  );
}
