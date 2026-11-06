/**
 * All the app's data, one function per piece of data: each cache key always goes with the same
 * request and the same settings (refresh, freshness). Screens only call these.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  api,
  type BonusDto,
  type GameDetailDto,
  type GameDto,
  type LeaderboardDto,
  type LiveDto,
  type Me,
  type NflStandingsDto,
  type PreviewDto,
  type ProfileDto,
  type RecapDto,
  type SeasonDto,
  type Side,
  type TeamSheetDto,
  type WeekDto,
  type WeeksDto
} from './api';
import { applyPick, keys, weekRefreshInterval } from './queries';

const MIN = 60_000;

export const useWeeks = () => useQuery({ queryKey: keys.weeks, queryFn: () => api<WeeksDto>('/weeks') });

/** A week's games: every 30 s during games, every 5 min otherwise. */
export const useWeek = (week: number | undefined) =>
  useQuery({
    queryKey: keys.week(week ?? 0),
    queryFn: () => api<WeekDto>(`/weeks/${week}`),
    enabled: !!week,
    refetchInterval: (q) => weekRefreshInterval(q.state.data?.games)
  });

export const useGame = (id: string) =>
  useQuery({ queryKey: keys.game(id), queryFn: () => api<GameDetailDto>(`/games/${id}`), refetchInterval: MIN });

export const usePreview = (gameId: string) =>
  useQuery({ queryKey: keys.preview(gameId), queryFn: () => api<PreviewDto>(`/games/${gameId}/preview`), staleTime: 20 * MIN });

/** During the game: every 30 s (paused while the app is in the background). */
export const useLive = (gameId: string, live: boolean) =>
  useQuery({
    queryKey: keys.live(gameId),
    queryFn: () => api<LiveDto>(`/games/${gameId}/live`),
    refetchInterval: live ? 30_000 : false,
    staleTime: live ? 20_000 : 60 * MIN
  });

/** Leaderboard of a season (current by default) or of a week; every 30 s during games. */
export const useLeaderboard = (week: number | undefined, season?: number, enabled = true) =>
  useQuery({
    queryKey: keys.leaderboard(week, season),
    queryFn: () => api<LeaderboardDto>(`/leaderboard${query({ week, season })}`),
    enabled,
    refetchInterval: (q) => (q.state.data?.live ? 30_000 : false)
  });

export const useBonus = () => useQuery({ queryKey: keys.bonus, queryFn: () => api<BonusDto>('/bonus') });
export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api<ProfileDto>('/profile') });
/** Recap of a season (current by default). */
export const useSeason = (season?: number) =>
  useQuery({ queryKey: keys.seasonOf(season), queryFn: () => api<SeasonDto>(`/season${query({ season })}`) });

/** "?week=10&season=2025", without the missing values. */
export function query(params: Record<string, number | undefined>): string {
  const parts = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const useRecap = (week: number | undefined) =>
  useQuery({ queryKey: keys.recap(week), queryFn: () => api<RecapDto>(week ? `/recap?week=${week}` : '/recap') });

export const useNflStandings = () =>
  useQuery({ queryKey: keys.nflStandings, queryFn: () => api<NflStandingsDto>('/nfl/standings'), staleTime: 30 * MIN });

export const useTeam = (abbr: string | null) =>
  useQuery({ queryKey: keys.team(abbr ?? ''), queryFn: () => api<TeamSheetDto>(`/teams/${abbr}`), enabled: !!abbr });

/**
 * Make a pick, from the list or the match page: shown right away in both places, reverted if the
 * server refuses (game started…), then confirmed with the server.
 */
export function usePick(me: Me, notify: (m: string) => void) {
  const qc = useQueryClient();
  return useCallback(
    async (game: Pick<GameDto, 'id' | 'week' | 'myPick'>, side: Side) => {
      if (game.myPick === side) return;
      const weekKey = keys.week(game.week);
      const gameKey = keys.game(game.id);
      await Promise.all([qc.cancelQueries({ queryKey: weekKey }), qc.cancelQueries({ queryKey: gameKey })]);
      const before = { week: qc.getQueryData<WeekDto>(weekKey), game: qc.getQueryData<GameDetailDto>(gameKey) };
      qc.setQueryData<WeekDto>(weekKey, (d) => d && { ...d, games: d.games.map((g) => (g.id === game.id ? applyPick(g, side, me.name) : g)) });
      qc.setQueryData<GameDetailDto>(gameKey, (d) => d && { ...applyPick(d, side, me.name), waiting: d.waiting.filter((n) => n !== me.name) });
      try {
        await api(`/picks/${game.id}`, { method: 'PUT', body: { side } });
      } catch (e) {
        qc.setQueryData(weekKey, before.week);
        qc.setQueryData(gameKey, before.game);
        notify((e as Error).message);
      }
      void qc.invalidateQueries({ queryKey: weekKey });
      void qc.invalidateQueries({ queryKey: gameKey });
    },
    [qc, me.name, notify]
  );
}
