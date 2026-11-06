import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button } from '../ds';
import { api, type BonusDto, type BonusPickDto, type Me, type TeamDto } from '../lib/api';
import { dayLabel, timeLabel } from '../lib/format';
import { BackLink, Loading } from './shared';
import { keys } from '../lib/queries';
import { useBonus } from '../lib/data';
import { t } from '../lib/i18n';

/** Bonus de fin de saison : règles, choix (avant la Wild Card), puis révélation et résultats. */
export function Bonus({ me, theme, notify }: { me: Me; theme: 'dark' | 'light'; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useBonus();
  const d = q.data;
  const error = q.error?.message ?? null;
  const [afc, setAfc] = useState<string | null>(null);
  const [nfc, setNfc] = useState<string | null>(null);
  const [sb, setSb] = useState<string | null>(null);
  const [total, setTotal] = useState('');
  const [saving, setSaving] = useState(false);

  // Le formulaire part de mes choix enregistrés, une seule fois : un rafraîchissement ne doit pas
  // écraser ce que je suis en train de modifier.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (filled || !d) return;
    setFilled(true);
    if (!d.mine) return;
    setAfc(d.mine.afc?.abbr ?? null);
    setNfc(d.mine.nfc?.abbr ?? null);
    setSb(d.mine.sb?.abbr ?? null);
    setTotal(String(d.mine.sbTotal));
  }, [d, filled]);

  // Le vainqueur du Super Bowl doit rester un des deux champions choisis.
  useEffect(() => {
    if (sb && sb !== afc && sb !== nfc) setSb(null);
  }, [afc, nfc, sb]);

  if (!d) return error ? <p className="error-box">{error}</p> : <Loading />;
  const logo = (team: TeamDto) => (theme === 'dark' ? team.logoDark : team.logo);
  const teamOf = (abbr: string | null) => [...(d.field?.afc ?? []), ...(d.field?.nfc ?? [])].find((x) => x.team.abbr === abbr)?.team ?? null;
  const ready = afc && nfc && sb && total !== '' && Number.isInteger(Number(total));

  async function save() {
    setSaving(true);
    try {
      await api('/bonus', { method: 'PUT', body: { afc, nfc, sb, sbTotal: Number(total) } });
      notify(t.bonus.saved);
      await qc.invalidateQueries({ queryKey: keys.bonus });
    } catch (e) {
      notify((e as Error).message);
    }
    setSaving(false);
  }

  const max = d.points.afc + d.points.nfc + d.points.sb;

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/classement" label={t.leaderboard.title} />
      </header>
      <main className="stack" style={{ gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">{t.bonus.eyebrow(max)}</span>
          <h1 className="h1">{t.bonus.title}</h1>
        </div>

        {d.phase === 'off' && <div className="card card-pad muted">{t.bonus.off}</div>}

        {d.phase !== 'off' && (
          <section className="card card-pad bonus-rules">
            <div className="bonus-rule">
              <span>{t.bonus.champion('AFC')}</span>
              <b>{t.bonus.points(d.points.afc)}</b>
            </div>
            <div className="bonus-rule">
              <span>{t.bonus.champion('NFC')}</span>
              <b>{t.bonus.points(d.points.nfc)}</b>
            </div>
            <div className="bonus-rule">
              <span>{t.bonus.sbWinner}</span>
              <b>{t.bonus.points(d.points.sb)}</b>
            </div>
            <span className="muted small">{t.bonus.rules(d.reveal === 'superbowl')}</span>
          </section>
        )}

        {d.phase === 'waiting' && (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>{t.bonus.waitingTitle}</b>
            <span className="muted small">{t.bonus.waitingText}</span>
          </div>
        )}

        {d.phase === 'open' && d.field && (
          <>
            <p className="bonus-lock">
              {t.bonus.lockAt(dayLabel(d.lockAt!), timeLabel(d.lockAt!))}
              {d.mine && <span className="bonus-done">{t.bonus.alreadySaved}</span>}
            </p>

            {(['afc', 'nfc'] as const).map((conf) => (
              <section key={conf} className="bonus-conf">
                <h2 className="section-title" style={{ margin: 0 }}>
                  {t.bonus.champion(conf.toUpperCase())}
                </h2>
                <div className="bonus-grid">
                  {d.field![conf].map(({ seed, team }) => {
                    const on = (conf === 'afc' ? afc : nfc) === team.abbr;
                    return (
                      <button
                        key={team.abbr}
                        type="button"
                        className={`bonus-team${on ? ' bonus-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => (conf === 'afc' ? setAfc(team.abbr) : setNfc(team.abbr))}
                      >
                        <img src={logo(team)} alt="" width={36} height={36} />
                        <span className="bonus-team-name">{team.name}</span>
                        <span className="muted small">{t.bonus.seed(seed)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="bonus-conf">
              <h2 className="section-title" style={{ margin: 0 }}>
                {t.bonus.sbWinner}
              </h2>
              {!afc || !nfc ? (
                <span className="muted small">{t.bonus.pickChampionsFirst}</span>
              ) : (
                <div className="bonus-grid bonus-grid-2">
                  {[afc, nfc].map((abbr) => {
                    const team = teamOf(abbr)!;
                    const on = sb === abbr;
                    return (
                      <button key={abbr} type="button" className={`bonus-team${on ? ' bonus-on' : ''}`} aria-pressed={on} onClick={() => setSb(abbr)}>
                        <img src={logo(team)} alt="" width={44} height={44} />
                        <span className="bonus-team-name">{team.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bonus-conf">
              <label htmlFor="sb-total" className="section-title" style={{ margin: 0 }}>
                {t.bonus.totalLabel}
              </label>
              <span className="muted small">{t.bonus.totalHelp}</span>
              <input
                id="sb-total"
                className="bonus-total"
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                placeholder={t.bonus.totalPlaceholder}
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </section>

            <Button block disabled={!ready || saving} onClick={save}>
              {t.bonus.submit(!!d.mine)}
            </Button>

            <WhoChose players={d.players} me={me} />
          </>
        )}

        {d.phase === 'locked' && (
          <>
            {(d.result.afc || d.result.nfc || d.result.sb) && (
              <section className="card card-pad bonus-rules">
                <span className="section-title" style={{ margin: 0 }}>
                  {t.bonus.resultsTitle}
                </span>
                <div className="bonus-rule">
                  <span>{t.bonus.champion('AFC')}</span>
                  <b>{d.result.afc?.name ?? t.bonus.pending}</b>
                </div>
                <div className="bonus-rule">
                  <span>{t.bonus.champion('NFC')}</span>
                  <b>{d.result.nfc?.name ?? t.bonus.pending}</b>
                </div>
                <div className="bonus-rule">
                  <span>{t.bonus.superBowl}</span>
                  <b>{d.result.sb ? t.bonus.sbResult(d.result.sb.name, d.result.sbTotal) : t.bonus.pending}</b>
                </div>
              </section>
            )}
            {!d.revealed && (
              <>
                <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <b>{t.bonus.lockedTitle}</b>
                  <span className="muted small">
                    {t.bonus.lockedText(d.revealAt ? { day: dayLabel(d.revealAt), time: timeLabel(d.revealAt) } : null)}
                  </span>
                </div>
                <WhoChose players={d.players} me={me} locked />
              </>
            )}
            {d.revealed && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                {t.bonus.playersTitle}
              </h2>
              {d.players.map((p) => (
                <div key={p.name} className="card bonus-player">
                  <div className="bonus-player-head">
                    <Avatar name={p.name} size="sm" me={p.name === me.name} />
                    <b>{p.name === me.name ? t.bonus.you : p.name}</b>
                    {p.points != null && <span className="bonus-pts">+{p.points}</span>}
                  </div>
                  {p.pick ? <PickLine pick={p.pick} result={d.result} /> : <span className="muted small">{t.bonus.noPick}</span>}
                </div>
              ))}
            </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PickLine({ pick, result }: { pick: BonusPickDto; result: BonusDto['result'] }) {
  const mark = (mine: TeamDto | null, actual: TeamDto | null) => (!actual ? '' : mine?.abbr === actual.abbr ? ' ✓' : ' ✗');
  const cls = (mine: TeamDto | null, actual: TeamDto | null) => (!actual ? undefined : mine?.abbr === actual.abbr ? 'bonus-ok' : 'bonus-ko');
  return (
    <div className="bonus-line small">
      <span className={cls(pick.afc, result.afc)}>
        {t.bonus.pickLine('AFC', pick.afc?.name ?? '')}
        {mark(pick.afc, result.afc)}
      </span>
      <span className={cls(pick.nfc, result.nfc)}>
        {t.bonus.pickLine('NFC', pick.nfc?.name ?? '')}
        {mark(pick.nfc, result.nfc)}
      </span>
      <span className={cls(pick.sb, result.sb)}>
        {t.bonus.pickLine('SB', pick.sb?.name ?? '')}
        {mark(pick.sb, result.sb)}
        {t.bonus.pickTotal(pick.sbTotal)}
        {result.sbTotal != null && <span className="muted">{t.bonus.pickGap(Math.abs(pick.sbTotal - result.sbTotal))}</span>}
      </span>
    </div>
  );
}

/** Qui a déjà fait ses choix (sans dire lesquels), présenté comme sur la fiche match. */
function WhoChose({ players, me, locked }: { players: BonusDto['players']; me: Me; locked?: boolean }) {
  return (
    <section className="grid-2">
      {[
        { title: t.bonus.chose, list: players.filter((p) => p.done), color: 'var(--correct)' },
        { title: t.bonus.notChosen(!!locked), list: players.filter((p) => !p.done), color: 'var(--ink-muted)' }
      ].map((col) => (
        <div key={col.title} className="card people">
          <h2>
            {col.title}
            <span style={{ color: col.color, fontVariantNumeric: 'tabular-nums' }}>{col.list.length}</span>
          </h2>
          {col.list.length === 0 && <span className="muted small">{t.bonus.nobody}</span>}
          {col.list.map((p) => (
            <div key={p.name} className="person">
              <Avatar name={p.name} size="sm" me={p.name === me.name} />
              <span>{p.name === me.name ? t.bonus.you : p.name}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
