import { useEffect, useState, type FormEvent } from 'react';
import { Avatar, Button } from '../ds/components';
import { api, type ApiError, type ProfileDto } from '../lib/api';
import { ordinal } from '../lib/format';
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

interface BonusSettings {
  enabled: boolean;
  points: { afc: number; nfc: number; sb: number };
  reveal: 'wildcard' | 'superbowl';
}

/** Bonus de fin de saison : activation et barème, modifiables à tout moment (les points sont recalculés). */
function BonusAdmin({ notify }: { notify: (m: string) => void }) {
  const [s, setS] = useState<BonusSettings | null>(null);
  const [draft, setDraft] = useState({ afc: '', nfc: '', sb: '' });
  useEffect(() => {
    api<BonusSettings>('/admin/bonus')
      .then((x) => {
        setS(x);
        setDraft({ afc: String(x.points.afc), nfc: String(x.points.nfc), sb: String(x.points.sb) });
      })
      .catch(() => {});
  }, []);
  if (!s) return null;

  async function save(body: Partial<BonusSettings>, msg: string) {
    try {
      const x = await api<BonusSettings>('/admin/bonus', { method: 'PUT', body });
      setS(x);
      setDraft({ afc: String(x.points.afc), nfc: String(x.points.nfc), sb: String(x.points.sb) });
      notify(msg);
    } catch (e) {
      notify((e as Error).message);
    }
  }

  const changed = draft.afc !== String(s.points.afc) || draft.nfc !== String(s.points.nfc) || draft.sb !== String(s.points.sb);
  const fields = [
    ['afc', 'Champion AFC'],
    ['nfc', 'Champion NFC'],
    ['sb', 'Vainqueur du Super Bowl']
  ] as const;

  return (
    <form
      className="settings-row"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ points: { afc: Number(draft.afc), nfc: Number(draft.nfc), sb: Number(draft.sb) } }, 'Barème du bonus enregistré');
      }}
    >
      <span className="label">Bonus de fin de saison</span>
      <span className="small muted">
        {s.enabled ? 'Activé : visible par tous, points comptés au classement.' : 'Désactivé : caché pour tout le monde, aucun point compté.'}
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={() => save({ enabled: !s.enabled }, s.enabled ? 'Bonus désactivé' : 'Bonus activé')}
      >
        {s.enabled ? 'Désactiver le bonus' : 'Activer le bonus'}
      </Button>
      {s.enabled && (
        <>
          {fields.map(([k, label]) => (
            <div key={k} className="bonus-admin-row">
              <label htmlFor={`bonus-${k}`} className="small">
                {label}
              </label>
              <input
                id={`bonus-${k}`}
                className="field bonus-admin-input"
                inputMode="numeric"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              />
              <span className="small muted">pts</span>
            </div>
          ))}
          <Button type="submit" disabled={!changed || Object.values(draft).some((v) => v === '')}>
            Enregistrer le barème
          </Button>
          <span className="small">Révéler les choix de la bande</span>
          <div className="segmented">
            {(
              [
                ['wildcard', 'À la Wild Card'],
                ['superbowl', 'Au Super Bowl']
              ] as const
            ).map(([v, label]) => (
              <Button
                key={v}
                type="button"
                variant={s.reveal === v ? 'primary' : 'secondary'}
                onClick={() => s.reveal !== v && save({ reveal: v }, `Choix révélés ${v === 'wildcard' ? 'à la Wild Card' : 'au Super Bowl'}`)}
              >
                {label}
              </Button>
            ))}
          </div>
          <span className="small muted">
            {s.reveal === 'wildcard'
              ? 'Dès la clôture des choix : on suit qui est encore en course pendant les playoffs.'
              : 'Au coup d’envoi du Super Bowl : suspense jusqu’au bout, points bonus ajoutés à ce moment-là.'}
          </span>
        </>
      )}
    </form>
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
        <BonusAdmin notify={notify} />
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
