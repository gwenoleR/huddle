/** Administration du groupe : joueurs, saison (bonus) et données (ESPN, historique). */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button } from '../ds';
import { api, type AdminPlayerDto, type ApiError, type BonusSettingsDto, type HistoryImportDto, type Me, type SyncStatusDto } from '../lib/api';
import { espnLine } from '../lib/labels';
import { plural } from '../lib/format';
import { keys } from '../lib/queries';
import { BackLink } from './shared';

export function Admin({ me, notify }: { me: Me; notify: (m: string) => void }) {
  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/profil" label="Profil" />
      </header>
      <main className="stack" style={{ gap: 24 }}>
        <h1 className="h1">Administration</h1>
        {me.isAdmin ? (
          <>
            <Players notify={notify} meId={me.id} />
            <Section title="Saison">
              <div className="card">
                <BonusAdmin notify={notify} />
              </div>
            </Section>
            <Section title="Données">
              <div className="card">
                <SyncRow notify={notify} />
                <HistoryImport notify={notify} />
              </div>
            </Section>
          </>
        ) : (
          <p className="muted">Réservé aux admins du groupe.</p>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const syncTime = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

function SyncRow({ notify }: { notify: (m: string) => void }) {
  const [status, setStatus] = useState<SyncStatusDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SyncStatusDto>('/admin/sync')
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    try {
      const s = await api<SyncStatusDto>('/admin/sync', { method: 'POST' });
      setStatus(s);
      notify(`Synchro faite : ${s.games} matchs`);
    } catch (e) {
      const err = e as ApiError;
      if (err.data?.at !== undefined) setStatus(err.data as SyncStatusDto);
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
      {status?.espn && (
        <span
          className="small"
          style={{
            color: status.espn.pausedUntil ? 'var(--wrong)' : 'var(--ink-muted)'
          }}
        >
          {espnLine(status.espn)}
        </span>
      )}
      <Button variant="secondary" disabled={busy} onClick={run}>
        {busy ? 'Synchro en cours… (≈ 15 s)' : 'Synchroniser maintenant'}
      </Button>
    </div>
  );
}

/** Bonus de fin de saison : activation et barème, modifiables à tout moment (les points sont recalculés). */
function BonusAdmin({ notify }: { notify: (m: string) => void }) {
  const qc = useQueryClient();
  const [s, setS] = useState<BonusSettingsDto | null>(null);
  const [draft, setDraft] = useState({ afc: '', nfc: '', sb: '' });
  useEffect(() => {
    api<BonusSettingsDto>('/admin/bonus')
      .then((x) => {
        setS(x);
        setDraft({
          afc: String(x.points.afc),
          nfc: String(x.points.nfc),
          sb: String(x.points.sb)
        });
      })
      .catch(() => {});
  }, []);
  if (!s) return null;

  async function save(body: Partial<BonusSettingsDto>, msg: string) {
    try {
      const x = await api<BonusSettingsDto>('/admin/bonus', {
        method: 'PUT',
        body
      });
      setS(x);
      setDraft({
        afc: String(x.points.afc),
        nfc: String(x.points.nfc),
        sb: String(x.points.sb)
      });
      // Le barème change les points de tout le monde : bonus, classement et profil sont à recharger.
      void qc.invalidateQueries({ queryKey: keys.bonus });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: keys.profile });
      void qc.invalidateQueries({ queryKey: keys.season });
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
        void save(
          {
            points: {
              afc: Number(draft.afc),
              nfc: Number(draft.nfc),
              sb: Number(draft.sb)
            }
          },
          'Barème du bonus enregistré'
        );
      }}
    >
      <span className="label">Bonus de fin de saison</span>
      <span className="small muted">
        {s.enabled ? 'Activé : visible par tous, points comptés au classement.' : 'Désactivé : caché pour tout le monde, aucun point compté.'}
      </span>
      <Button type="button" variant="secondary" onClick={() => save({ enabled: !s.enabled }, s.enabled ? 'Bonus désactivé' : 'Bonus activé')}>
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
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: e.target.value.replace(/\D/g, '').slice(0, 2)
                  })
                }
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

/** Les joueurs : liste (toucher un nom pour ses actions) et ajout. */
function Players({ notify, meId }: { notify: (m: string) => void; meId: number }) {
  const qc = useQueryClient();
  const [players, setPlayers] = useState<AdminPlayerDto[]>([]);
  const [name, setName] = useState('');
  const [points, setPoints] = useState('0');
  const load = () =>
    api<AdminPlayerDto[]>('/admin/players')
      .then(setPlayers)
      .catch((e) => notify(e.message));
  useEffect(() => {
    void load();
  }, []);

  /** Après un changement de joueurs, classements, pronos et bilans sont à recharger. */
  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      notify(msg);
      void load();
      void qc.invalidateQueries();
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    await act(
      () =>
        api('/admin/players', {
          method: 'POST',
          body: { name, startPoints: Number(points) }
        }),
      `${name} ajouté`
    );
    setName('');
    setPoints('0');
  }

  const reset = (p: AdminPlayerDto) =>
    confirm(`Effacer le code de ${p.name} ? Il en choisira un nouveau à sa prochaine connexion.`) &&
    act(() => api(`/admin/players/${p.id}/reset-pin`, { method: 'POST' }), `Code de ${p.name} effacé`);

  const rename = (p: AdminPlayerDto) => {
    const next = prompt(`Nouveau prénom pour ${p.name}`, p.name)?.trim();
    if (next && next !== p.name)
      void act(
        () =>
          api(`/admin/players/${p.id}`, {
            method: 'PATCH',
            body: { name: next }
          }),
        `${p.name} s’appelle maintenant ${next}`
      );
  };

  const toggleAdmin = (p: AdminPlayerDto) =>
    act(
      () =>
        api(`/admin/players/${p.id}`, {
          method: 'PATCH',
          body: { isAdmin: !p.isAdmin }
        }),
      p.isAdmin ? `${p.name} n’est plus admin` : `${p.name} est admin`
    );

  const remove = (p: AdminPlayerDto) =>
    confirm(`Supprimer ${p.name} ? Ses pronos et ses points disparaissent pour de bon.`) &&
    act(() => api(`/admin/players/${p.id}`, { method: 'DELETE' }), `${p.name} supprimé`);

  return (
    <Section title={`Joueurs · ${players.length}`}>
      <div className="card">
        <div className="settings-row">
          {players.map((p) => (
            <details key={p.id} className="admin-player-box">
              <summary className="admin-player">
                <Avatar name={p.name} size="sm" />
                <span>{p.name}</span>
                <span className="muted small">
                  {[p.isAdmin && 'admin', !p.hasPin && 'pas encore connecté', p.startPoints > 0 && `${p.startPoints} pts de départ`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </summary>
              <div className="admin-actions">
                <Button variant="secondary" onClick={() => rename(p)}>
                  Renommer
                </Button>
                {p.hasPin && (
                  <Button variant="secondary" onClick={() => reset(p)}>
                    Effacer le code
                  </Button>
                )}
                {p.id !== meId && (
                  <>
                    <Button variant="secondary" onClick={() => toggleAdmin(p)}>
                      {p.isAdmin ? 'Retirer admin' : 'Nommer admin'}
                    </Button>
                    <Button variant="ghost" onClick={() => remove(p)}>
                      Supprimer
                    </Button>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
      <form className="card settings-row" onSubmit={add}>
        <span className="label">Ajouter un joueur</span>
        <label className="muted small" htmlFor="new-name">
          Prénom
        </label>
        <input id="new-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />
        <label className="muted small" htmlFor="new-points">
          Points de départ (s’il arrive en cours de saison)
        </label>
        <input id="new-points" className="field" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} />
        <Button type="submit">Ajouter</Button>
      </form>
    </Section>
  );
}

/**
 * Pronos des semaines jouées ailleurs, en CSV : vérifiés à blanc d'abord (l'admin voit ce qui va
 * être importé), puis importés pour de vrai.
 */
function HistoryImport({ notify }: { notify: (m: string) => void }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<HistoryImportDto | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(text: string, dryRun: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<HistoryImportDto>('/admin/history', {
        method: 'POST',
        body: { csv: text, dryRun }
      });
      if (dryRun) setPreview(r);
      else {
        notify(`${plural(r.picks, 'prono')} importés`);
        setCsv(null);
        setPreview(null);
        void qc.invalidateQueries();
      }
    } catch (e) {
      setPreview(null);
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-row">
      <span className="label">Importer l’historique</span>
      <span className="muted small">
        Les semaines jouées ailleurs, en CSV : une ligne d’en-têtes (« , Home, Away, Prono GW, Prono AU… », deux lettres du prénom), puis une ligne par match («
        Week1 » sur le premier match de chaque semaine). Les points de départ des joueurs du fichier repassent à 0.
      </span>
      <label className={`pr-btn pr-btn-secondary file-btn${busy ? ' is-disabled' : ''}`}>
        Choisir un fichier CSV
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const text = await f.text();
            setCsv(text);
            await send(text, true);
          }}
        />
      </label>
      {problem && (
        <p className="small" style={{ margin: 0, color: 'var(--wrong)', whiteSpace: 'pre-wrap' }}>
          {problem}
        </p>
      )}
      {preview && csv && (
        <>
          <span className="small">
            {plural(preview.picks, 'prono')} sur {plural(preview.games, 'match')}, pour {preview.players.join(', ')}.
          </span>
          <Button disabled={busy} onClick={() => send(csv, false)}>
            Importer
          </Button>
        </>
      )}
    </div>
  );
}
