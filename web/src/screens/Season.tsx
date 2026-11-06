import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Icon, LeaderboardRow } from '../ds';
import { type AwardDto, type Me } from '../lib/api';
import { BackLink, Loading, OtherSeasons } from './shared';
import { pointsOrigin } from '../lib/labels';
import { useSeason } from '../lib/data';
import { t } from '../lib/i18n';

export function Season({ me, season }: { me: Me; season?: number }) {
  const q = useSeason(season);
  const s = q.data;
  const error = q.error?.message ?? null;
  const [open, setOpen] = useState<AwardDto | null>(null);

  if (!s) return error ? <p className="error-box">{error}</p> : <Loading />;
  const leader = s.rows[0];
  const won = s.awards.filter((a) => a.who);
  const toWin = s.awards.filter((a) => !a.who);

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/standings" label={t.leaderboard.title} />
      </header>
      <main className="stack" style={{ gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">
            {t.season.eyebrow(s.season, s.finished, s.finalGames)}
          </span>
          <h1 className="h1">{t.season.title}</h1>
        </div>

        {leader && (
          <section className="champion">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {t.season.championTitle(s.finished)}
              </span>
              <span className="who">{leader.name}</span>
            </div>
            <span className="pts">
              {leader.points}
              <small>{t.season.pointsUnit}</small>
            </span>
          </section>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {t.season.standingsTitle(s.finished)}
          </h2>
          <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.rows.map((r) => (
              <LeaderboardRow key={r.id} rank={r.rank} name={r.name} points={r.points} me={r.id === me.id} record={pointsOrigin(r)} />
            ))}
          </ol>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {t.season.trophiesTitle}
          </h2>
          {won.length === 0 && <div className="card card-pad muted small">{t.season.noTrophiesYet}</div>}
          {won.map((a) => (
            <AwardRow key={a.id} award={a} finished={s.finished} onOpen={() => setOpen(a)} />
          ))}
        </section>

        {toWin.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {t.season.toWinTitle(s.finished)}
            </h2>
            {toWin.map((a) => (
              <AwardRow key={a.id} award={a} finished={s.finished} onOpen={() => setOpen(a)} />
            ))}
          </section>
        )}
        <OtherSeasons
          seasons={s.seasons}
          shown={s.season}
          current={s.seasons[0]}
          label={s.season === s.seasons[0] ? t.season.previousSeasons : t.season.otherSeasons}
        />
      </main>
      <TrophyDialog award={open} me={me} finished={s.finished} onClose={() => setOpen(null)} />
    </div>
  );
}

function TrophyBadge({ won, size = 40 }: { won: boolean; size?: number }) {
  return (
    <span className={`trophy-badge${won ? ' trophy-won' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <Icon name="standings" size={Math.round(size * 0.55)} />
    </span>
  );
}

function AwardRow({ award, finished, onOpen }: { award: AwardDto; finished: boolean; onOpen: () => void }) {
  const won = !!award.who;
  return (
    <button type="button" className="card award award-btn" onClick={onOpen} aria-haspopup="dialog">
      {won ? <Avatar name={award.who!} /> : <TrophyBadge won={false} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{award.title}</span>
        <span className="muted small">{t.season.awardLine(award.who ?? null, award.detail, finished)}</span>
      </span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ color: 'var(--ink-muted)', flex: 'none' }}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Trophy explanation dialog (sheet sliding up from the bottom, closed by the button, the backdrop or Esc). */
function TrophyDialog({ award, me, finished, onClose }: { award: AwardDto | null; me: Me; finished: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (award && !d.open) d.showModal();
    if (!award && d.open) d.close();
  }, [award]);

  const won = !!award?.who;
  const mine = award?.who === me.name;
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="trophy-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {award && (
        <div className="sheet-body">
          <TrophyBadge won={won} size={64} />
          <h2 id="trophy-title" className="h1" style={{ textAlign: 'center' }}>
            {award.title}
          </h2>
          {won ? (
            <div className="sheet-holder">
              <Avatar name={award.who!} me={mine} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{mine ? t.season.itsYou : award.who}</span>
                <span className="muted small">{award.detail}</span>
              </span>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 15 }}>
              {t.season.nobody(finished)}
            </p>
          )}
          <div className="sheet-rule">
            <span className="section-title" style={{ margin: 0 }}>
              {t.season.howToWin}
            </span>
            <p style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>{award.rule}</p>
            <p className="muted small" style={{ margin: 0 }}>
              {t.season.ruleNote}
            </p>
          </div>
          <Button block onClick={onClose}>
            {t.season.close}
          </Button>
        </div>
      )}
    </dialog>
  );
}
