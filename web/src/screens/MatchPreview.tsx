import { useEffect, useState } from 'react';
import { TeamLink } from './shared';
import { standingText } from '../lib/labels';
import { api, type GameDto, type PreviewDto, type PreviewSideDto, type TeamStandingDto } from '../lib/api';

const STATUS_LABEL = { out: 'Forfait', doubtful: 'Douteux', questionable: 'Incertain' } as const;
const fr = (n: number) => n.toLocaleString('fr-FR');

/** Avant-match : bilan, forme, favori et blessés. Ne s'affiche que tant que le match n'a pas commencé. */
export function MatchPreview({ game }: { game: GameDto }) {
  const [p, setP] = useState<PreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<PreviewDto>(`/games/${game.id}/preview`)
      .then(setP)
      .catch((e) => setError(e.message));
  }, [game.id]);

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
          <span className="section-title" style={{ margin: 0 }}>Le favori</span>
          {p.odds && (
            <p className="preview-fav">
              {fav ? (
                <>
                  Les <b>{fav.name}</b>
                  {p.odds.spread ? <>, avec environ {fr(p.odds.spread)} pts d’avance attendus</> : null}
                </>
              ) : (
                'Pile ou face pour les bookmakers'
              )}
              <span className="muted small"> · {p.odds.provider}</span>
            </p>
          )}
          {chances && (
            <div className="pr-split">
              <div className="pr-split-labels">
                <span className="pr-split-lab">
                  <b className="pr-a">{chances[0]} %</b> {game.away.abbr}
                </span>
                <span>Chances de victoire (ESPN)</span>
                <span className="pr-split-lab">
                  {game.home.abbr} <b className="pr-b">{chances[1]} %</b>
                </span>
              </div>
              <div className="pr-split-bar" role="img" aria-label={`${game.away.name} ${chances[0]} %, ${game.home.name} ${chances[1]} %`}>
                <span className="pr-split-a" style={{ width: `${chances[0]}%` }} />
                <span className="pr-split-b" style={{ width: `${chances[1]}%` }} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card card-pad preview">
        <span className="section-title" style={{ margin: 0 }}>Bilan et forme</span>
        <table className="preview-table">
          <thead>
            <tr>
              <th />
              <th>Bilan</th>
              <th>Dom. / ext.</th>
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
                  {p[s].venueRecord ?? '–'} <span className="muted small">{s === 'home' ? 'à dom.' : 'à l’ext.'}</span>
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
              Voir le classement NFL
            </a>
          </div>
        )}
        {sides.map((s) => (
          <Form key={s} name={team(s).name} abbr={team(s).abbr} side={p[s]} />
        ))}
        <span className="muted small">Bilan en victoires-défaites. Forme du plus ancien au plus récent.</span>
      </section>

      <section className="card card-pad preview">
        <span className="section-title" style={{ margin: 0 }}>Infirmerie</span>
        {sides.map((s) => (
          <Injuries key={s} name={team(s).name} side={p[s]} color={s === 'away' ? 'pr-a' : 'pr-b'} />
        ))}
        <span className="muted small">Les forfaits officiels tombent en général la veille ou l’avant-veille du match.</span>
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
            title={`${f.result === 'V' ? 'Victoire' : f.result === 'D' ? 'Défaite' : 'Nul'} ${f.home ? 'contre' : 'chez'} ${f.opponent} ${f.score}`}
          >
            {f.result}
            <small>{f.home ? '' : '@'}{f.opponent}</small>
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
      {side.injuries.length === 0 && <span className="muted small">Aucun blessé signalé pour ce match.</span>}
      {side.injuries.map((i, k) => (
        <div key={k} className="preview-inj-row">
          <span className={`preview-status preview-status-${i.status}`}>{STATUS_LABEL[i.status]}</span>
          <span className={i.position === 'QB' ? 'preview-qb' : undefined}>
            {i.name}
            {i.position && <span className="muted"> · {i.position}</span>}
          </span>
          {i.part && <span className="muted small preview-part">{i.part}</span>}
        </div>
      ))}
      {side.injuredReserve > 0 && (
        <span className="muted small">
          + {side.injuredReserve} en liste des blessés (absent{side.injuredReserve > 1 ? 's' : ''} depuis plusieurs semaines)
        </span>
      )}
    </div>
  );
}

