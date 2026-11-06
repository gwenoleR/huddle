/** Group administration: players, season (bonus) and data (ESPN, history). */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button } from '../ds';
import { api, type AdminPlayerDto, type ApiError, type BonusSettingsDto, type HistoryImportDto, type Me, type SyncStatusDto } from '../lib/api';
import { espnLine } from '../lib/labels';
import { dayTimeLabel } from '../lib/format';
import { t } from '../lib/i18n';
import { keys } from '../lib/queries';
import { BackLink } from './shared';

export function Admin({ me, notify }: { me: Me; notify: (m: string) => void }) {
  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/profile" label={t.admin.back} />
      </header>
      <main className="stack" style={{ gap: 24 }}>
        <h1 className="h1">{t.admin.title}</h1>
        {me.isAdmin ? (
          <>
            <Players notify={notify} meId={me.id} />
            <Section title={t.admin.seasonSection}>
              <div className="card">
                <BonusAdmin notify={notify} />
              </div>
            </Section>
            <Section title={t.admin.dataSection}>
              <div className="card">
                <SyncRow notify={notify} />
                <HistoryImport notify={notify} />
              </div>
            </Section>
          </>
        ) : (
          <p className="muted">{t.admin.adminsOnly}</p>
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
      notify(t.admin.syncDone(s.games));
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
      <span className="label">{t.admin.syncLabel}</span>
      {status && (
        <span className="small" style={{ color: status.ok ? 'var(--ink-muted)' : 'var(--wrong)' }}>
          {status.at ? t.admin.syncWhen(status.ok, dayTimeLabel(status.at)) : ''}
          {status.ok ? t.admin.syncGames(status.games) : status.message}
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
        {busy ? t.admin.syncing : t.admin.syncNow}
      </Button>
    </div>
  );
}

/** End-of-season bonus: toggle and scoring, editable at any time (points are recomputed). */
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
      // The scoring changes everyone's points: bonus, leaderboard and profile must be reloaded.
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
    ['afc', t.admin.bonusAfc],
    ['nfc', t.admin.bonusNfc],
    ['sb', t.admin.bonusSb]
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
          t.admin.bonusScaleSaved
        );
      }}
    >
      <span className="label">{t.admin.bonusLabel}</span>
      <span className="small muted">
        {s.enabled ? t.admin.bonusOnHelp : t.admin.bonusOffHelp}
      </span>
      <Button type="button" variant="secondary" onClick={() => save({ enabled: !s.enabled }, s.enabled ? t.admin.bonusDisabled : t.admin.bonusEnabled)}>
        {s.enabled ? t.admin.bonusDisable : t.admin.bonusEnable}
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
              <span className="small muted">{t.admin.pointsUnit}</span>
            </div>
          ))}
          <Button type="submit" disabled={!changed || Object.values(draft).some((v) => v === '')}>
            {t.admin.bonusSaveScale}
          </Button>
          <span className="small">{t.admin.revealLabel}</span>
          <div className="segmented">
            {(
              [
                ['wildcard', t.admin.revealWildcard],
                ['superbowl', t.admin.revealSuperbowl]
              ] as const
            ).map(([v, label]) => (
              <Button
                key={v}
                type="button"
                variant={s.reveal === v ? 'primary' : 'secondary'}
                onClick={() => s.reveal !== v && save({ reveal: v }, t.admin.revealed(v))}
              >
                {label}
              </Button>
            ))}
          </div>
          <span className="small muted">
            {s.reveal === 'wildcard'
              ? t.admin.revealWildcardHelp
              : t.admin.revealSuperbowlHelp}
          </span>
        </>
      )}
    </form>
  );
}

/** Players: list (tap a name for its actions) and add. */
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

  /** After a players change, leaderboards, picks and recaps must be reloaded. */
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
      t.admin.added(name)
    );
    setName('');
    setPoints('0');
  }

  const reset = (p: AdminPlayerDto) =>
    confirm(t.admin.confirmResetPin(p.name)) &&
    act(() => api(`/admin/players/${p.id}/reset-pin`, { method: 'POST' }), t.admin.pinReset(p.name));

  const rename = (p: AdminPlayerDto) => {
    const next = prompt(t.admin.renamePrompt(p.name), p.name)?.trim();
    if (next && next !== p.name)
      void act(
        () =>
          api(`/admin/players/${p.id}`, {
            method: 'PATCH',
            body: { name: next }
          }),
        t.admin.renamed(p.name, next)
      );
  };

  const toggleAdmin = (p: AdminPlayerDto) =>
    act(
      () =>
        api(`/admin/players/${p.id}`, {
          method: 'PATCH',
          body: { isAdmin: !p.isAdmin }
        }),
      p.isAdmin ? t.admin.noLongerAdmin(p.name) : t.admin.nowAdmin(p.name)
    );

  const remove = (p: AdminPlayerDto) =>
    confirm(t.admin.confirmRemove(p.name)) &&
    act(() => api(`/admin/players/${p.id}`, { method: 'DELETE' }), t.admin.removed(p.name));

  return (
    <Section title={t.admin.playersSection(players.length)}>
      <div className="card">
        <div className="settings-row">
          {players.map((p) => (
            <details key={p.id} className="admin-player-box">
              <summary className="admin-player">
                <Avatar name={p.name} size="sm" />
                <span>{p.name}</span>
                <span className="muted small">
                  {[p.isAdmin && t.admin.tagAdmin, !p.hasPin && t.admin.tagNoPin, p.startPoints > 0 && t.admin.tagStartPoints(p.startPoints)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </summary>
              <div className="admin-actions">
                <Button variant="secondary" onClick={() => rename(p)}>
                  {t.admin.rename}
                </Button>
                {p.hasPin && (
                  <Button variant="secondary" onClick={() => reset(p)}>
                    {t.admin.resetPin}
                  </Button>
                )}
                {p.id !== meId && (
                  <>
                    <Button variant="secondary" onClick={() => toggleAdmin(p)}>
                      {p.isAdmin ? t.admin.removeAdmin : t.admin.makeAdmin}
                    </Button>
                    <Button variant="ghost" onClick={() => remove(p)}>
                      {t.admin.remove}
                    </Button>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
      <form className="card settings-row" onSubmit={add}>
        <span className="label">{t.admin.addPlayer}</span>
        <label className="muted small" htmlFor="new-name">
          {t.admin.firstName}
        </label>
        <input id="new-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />
        <label className="muted small" htmlFor="new-points">
          {t.admin.startPoints}
        </label>
        <input id="new-points" className="field" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} />
        <Button type="submit">{t.admin.add}</Button>
      </form>
    </Section>
  );
}

/**
 * Picks from weeks played elsewhere, as CSV: dry-run first (the admin sees what is going to be
 * imported), then imported for real.
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
        notify(t.admin.imported(r.picks));
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
      <span className="label">{t.admin.importLabel}</span>
      <span className="muted small">
        {t.admin.importHelp}
      </span>
      <label className={`pr-btn pr-btn-secondary file-btn${busy ? ' is-disabled' : ''}`}>
        {t.admin.chooseCsv}
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
            {t.admin.importPreview(preview.picks, preview.games, preview.players)}
          </span>
          <Button disabled={busy} onClick={() => send(csv, false)}>
            {t.admin.importNow}
          </Button>
        </>
      )}
    </div>
  );
}
