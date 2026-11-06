import { TeamLink } from './shared';
import { standingText } from '../lib/labels';
import { usePreview } from '../lib/data';
import { t } from '../lib/i18n';
import { type GameDto, type PreviewSideDto } from '../lib/api';

const fr = (n: number) => n.toLocaleString(t.common.locale);

/** Avant-match : bilan, forme, favori et blessés. Ne s'affiche que tant que le match n'a pas commencé. */
export function MatchPreview({ game }: { game: GameDto }) {
  const q = usePreview(game.id);
  const p = q.data;
  const error = p ? null : q.error?.message ?? null;

  if (error) return <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>{error}</p>;
  if (!p) return null;

  const sides = ['away', 'home'] as const;
  const team = (s: 'away' | 'home') => game[s];
  const fav = p.odds?.favorite ? team(p.odds.favorite) : null;
  const chances = p.away.winChance != null && p.home.winChance != null ? [p.away.winChance, p.home.winChance] : null;

  return (
    <>
      {(fav || chances) && (
        <section className="card card-pad preview">
          <span className="section-title" style={{ margin: 0 }}>{t.match.favoriteTitle}</span>
          {p.odds && (
            <p className="preview-fav">
              {fav ? (
                t.match.favorite(<b key="team">{fav.name}</b>, p.odds.spread ? fr(p.odds.spread) : null)
              ) : (
                t.match.tossUp
              )}
              <span className="muted small"> · {p.odds.provider}</span>
            </p>
          )}
          {chances && (
            <div className="pr-split">
              <div className="pr-split-labels">
                <span className="pr-split-lab">
                  <b className="pr-a">{t.match.percent(chances[0])}</b> {game.away.abbr}
                </span>
                <span>{t.match.winChancesEspn}</span>
                <span className="pr-split-lab">
                  {game.home.abbr} <b className="pr-b">{t.match.percent(chances[1])}</b>
                </span>
              </div>
              <div className="pr-split-bar" role="img" aria-label={t.match.chancesLabel(game.away.name, chances[0], game.home.name, chances[1])}>
                <span className="pr-split-a" style={{ width: `${chances[0]}%` }} />
                <span className="pr-split-b" style={{ width: `${chances[1]}%` }} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card card-pad preview">
        <span className="section-title" style={{ margin: 0 }}>{t.match.recordTitle}</span>
        <table className="preview-table">
          <thead>
            <tr>
              <th />
              <th>{t.match.colRecord}</th>
              <th>{t.match.colVenue}</th>
            </tr>
          </thead>
          <tbody>
            {sides.map((s) => (
              <tr key={s}>
                <th scope="row" className={s === 'away' ? 'pr-a' : 'pr-b'}>
                  <TeamLink abbr={team(s).abbr}>{team(s).name}</TeamLink>
                </th>
                <td>{p[s].record ?? '–'}</td>
                <td>
                  {p[s].venueRecord ?? '–'} <span className="muted small">{s === 'home' ? t.match.atHome : t.match.onTheRoad}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.standing && (p.standing.away || p.standing.home) && (
          <div className="preview-standing">
            {sides.map((s) => (
              <span key={s} className={s === 'home' ? 'preview-standing-home' : undefined}>
                <b className={s === 'away' ? 'pr-a' : 'pr-b'}>{team(s).abbr}</b> {standingText(p.standing![s])}
              </span>
            ))}
            <a className="detail-link" href="#/classement/nfl">
              {t.match.seeNflStandings}
            </a>
          </div>
        )}
        {sides.map((s) => (
          <Form key={s} name={team(s).name} abbr={team(s).abbr} side={p[s]} />
        ))}
        <span className="muted small">{t.match.recordHelp}</span>
      </section>

      <section className="card card-pad preview">
        <span className="section-title" style={{ margin: 0 }}>{t.match.injuriesTitle}</span>
        {sides.map((s) => (
          <Injuries key={s} name={team(s).name} side={p[s]} color={s === 'away' ? 'pr-a' : 'pr-b'} />
        ))}
        <span className="muted small">{t.match.injuriesHelp}</span>
      </section>
    </>
  );
}

function Form({ name, abbr, side }: { name: string; abbr: string; side: PreviewSideDto }) {
  if (!side.form.length) return null;
  return (
    <div className="preview-form">
      <TeamLink abbr={abbr} className="preview-form-name">
        {name}
      </TeamLink>
      <span className="preview-chips">
        {side.form.map((f, i) => (
          <span
            key={i}
            className={`preview-chip preview-chip-${f.result}`}
            title={t.match.formGame(f.result, f.home, f.opponent, f.score)}
          >
            {t.match.resultLetter[f.result]}
            <small>{f.home ? '' : t.team.at}{f.opponent}</small>
          </span>
        ))}
      </span>
    </div>
  );
}

function Injuries({ name, side, color }: { name: string; side: PreviewSideDto; color: string }) {
  return (
    <div className="preview-inj">
      <span className={`preview-inj-team ${color}`}>{name}</span>
      {side.injuries.length === 0 && <span className="muted small">{t.match.noInjuries}</span>}
      {side.injuries.map((i, k) => (
        <div key={k} className="preview-inj-row">
          <span className={`preview-status preview-status-${i.status}`}>{t.match.injuryStatus[i.status]}</span>
          <span className={i.position === 'QB' ? 'preview-qb' : undefined}>
            {i.name}
            {i.position && <span className="muted"> · {i.position}</span>}
          </span>
          {i.part && <span className="muted small preview-part">{i.part}</span>}
        </div>
      ))}
      {side.injuredReserve > 0 && (
        <span className="muted small">
          {t.match.injuredReserve(side.injuredReserve)}
        </span>
      )}
    </div>
  );
}

