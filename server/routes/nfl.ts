/** NFL standings and team page. */
import type { FastifyInstance } from 'fastify';
import type { NflStandingsDto, Replies, TeamSheetDto, TeamStandingDto } from '../../shared/api';
import { currentSeason, t, weekLabel } from '../config';
import { db, startWeek } from '../db';
import { fetchStandings, type NflStandings, type StandingTeam } from '../espn';
import { cached } from '../espnCache';
import { type GameRow, type TeamRow, playerNames, teamDto, teamsById } from './dto';
import { requireAuth } from './guards';

const MIN = 60_000;

/** NFL standings: they only change when games end. Fresh for 30 min, then served again while being refreshed. */
export const nflStandings = () => cached(`standings:${currentSeason()}`, () => fetchStandings(currentSeason()), { ttl: 30 * MIN, swr: 24 * 60 * MIN });

/** A team's position: « 1er AFC Est », seed in its conference. */
export function standingOf(s: NflStandings, teamId: string): TeamStandingDto | null {
  for (const c of s.conferences)
    for (const d of c.divisions) {
      const t = d.teams.find((x) => x.teamId === teamId);
      if (t) return { conference: c.abbr, division: d.name, divRank: t.divRank, seed: t.seed, clinch: t.clinch };
    }
  return null;
}

export async function nflRoutes(app: FastifyInstance) {
  app.get<{ Reply: Replies<NflStandingsDto> }>('/api/nfl/standings', { preHandler: requireAuth }, async (req, reply) => {
    let s: NflStandings;
    try {
      s = await nflStandings();
    } catch (e) {
      req.log.warn({ err: e }, 'NFL standings unavailable');
      return reply.code(502).send({ error: t.api.nflStandingsUnavailable });
    }
    const teams = teamsById();
    const row = (t: StandingTeam) => {
      const tr = teams.get(t.teamId);
      return tr ? { ...t, team: teamDto(tr) } : null;
    };
    return {
      season: currentSeason(),
      conferences: s.conferences.map((c) => {
        const divisions = c.divisions.map((d) => ({ name: d.name, teams: d.teams.map(row).filter((t) => t !== null) }));
        const seeds = divisions
          .flatMap((d) => d.teams.map((t) => ({ ...t, division: d.name })))
          .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
        return { abbr: c.abbr, divisions, seeds };
      })
    };
  });

  // Team page: standings position, season schedule and how the group did with it.
  app.get<{ Params: { abbr: string }; Reply: Replies<TeamSheetDto> }>('/api/teams/:abbr', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT * FROM teams WHERE abbr = ? COLLATE NOCASE').get(req.params.abbr) as unknown as TeamRow | undefined;
    if (!row) return reply.code(404).send({ error: t.api.teamNotFound });
    const teams = teamsById();

    const games = db
      .prepare('SELECT * FROM games WHERE season = ? AND (away_id = ? OR home_id = ?) ORDER BY kickoff')
      .all(currentSeason(), row.id, row.id) as unknown as GameRow[];
    const schedule: TeamSheetDto['schedule'] = games.map((g) => {
      const home = g.home_id === row.id;
      const opp = teams.get(home ? g.away_id : g.home_id)!;
      const us = home ? g.home_score : g.away_score;
      const them = home ? g.away_score : g.home_score;
      const result = g.status !== 'final' ? null : g.winner === 'tie' ? 'T' : g.winner === (home ? 'home' : 'away') ? 'W' : 'L';
      return {
        id: g.id,
        week: g.week,
        weekLabel: weekLabel(g.week),
        kickoff: g.kickoff,
        status: g.status,
        detail: g.detail,
        home,
        opponent: teamDto(opp),
        score: us != null && them != null ? `${us}-${them}` : null,
        result
      };
    });

    // The group's picks on this team's final games, since the start week.
    const rows = db
      .prepare(
        `SELECT p.id, p.name, k.side, g.winner, CASE WHEN g.home_id = ? THEN 'home' ELSE 'away' END AS teamSide
         FROM picks k JOIN players p ON p.id = k.player_id JOIN games g ON g.id = k.game_id
         WHERE g.season = ? AND g.week >= ? AND g.status = 'final' AND (g.away_id = ? OR g.home_id = ?)`
      )
      .all(row.id, currentSeason(), startWeek(), row.id, row.id) as { id: number; name: string; side: string; winner: string | null; teamSide: string }[];
    const band = playerNames()
      .map((p) => {
        const mine = rows.filter((r) => r.id === p.id);
        const withTeam = mine.filter((r) => r.side === r.teamSide);
        const against = mine.filter((r) => r.side !== r.teamSide);
        return {
          name: p.name,
          with: withTeam.length,
          withGood: withTeam.filter((r) => r.winner === r.side).length,
          against: against.length,
          againstGood: against.filter((r) => r.winner === r.side).length
        };
      })
      .sort((a, b) => b.with + b.against - (a.with + a.against) || a.name.localeCompare(b.name, t.common.locale));

    const s = await nflStandings().catch(() => null);
    const finals = schedule.filter((g) => g.result);
    const count = (r: string) => finals.filter((g) => g.result === r).length;
    const ties = count('T');
    return {
      team: teamDto(row),
      record: `${count('W')}-${count('L')}${ties ? `-${ties}` : ''}`,
      standing: s ? standingOf(s, row.id) : null,
      schedule,
      band
    };
  });
}
