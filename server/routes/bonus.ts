/** End-of-season bonus: players' picks and admin settings. */
import type { FastifyInstance } from 'fastify';
import type { BonusDto, BonusPickDto, BonusSettingsDto, OkDto, Replies } from '../../shared/api';
import {
  type BonusPick,
  bonusField,
  bonusLockAt,
  bonusPhase,
  bonusPicks,
  bonusPointsByPlayer,
  bonusResult,
  bonusRevealAt,
  bonusRevealed,
  bonusSettings,
  saveBonusPick,
  saveBonusSettings
} from '../bonus';
import { t } from '../config';
import { db } from '../db';
import { playerNames, teamDto, teamsById } from './dto';
import { requireAdmin, requireAuth } from './guards';

export async function bonusRoutes(app: FastifyInstance) {
  app.get<{ Reply: Replies<BonusDto> }>('/api/bonus', { preHandler: requireAuth }, async (req) => {
    const settings = bonusSettings();
    const field = bonusField();
    const teams = teamsById();
    const team = (id: string | null) => (id && teams.has(id) ? teamDto(teams.get(id)!) : null);
    const picks = bonusPicks();
    const mine = picks.find((p) => p.playerId === req.me.id) ?? null;
    const result = bonusResult();
    const points = bonusPointsByPlayer();
    const revealed = bonusRevealed();
    const pickDto = (p: BonusPick): BonusPickDto => ({ afc: team(p.afc), nfc: team(p.nfc), sb: team(p.sb), sbTotal: p.sbTotal });
    const fieldDto = (list: { teamId: string; seed: number }[]) => list.map((t) => ({ seed: t.seed, team: team(t.teamId)! }));
    return {
      enabled: settings.enabled,
      points: settings.points,
      reveal: settings.reveal,
      phase: bonusPhase(),
      lockAt: bonusLockAt(),
      revealed,
      revealAt: bonusRevealAt(),
      field: field ? { afc: fieldDto(field.afc), nfc: fieldDto(field.nfc) } : null,
      mine: mine ? pickDto(mine) : null,
      // Before the reveal: only who has picked (not what). After: everyone's picks.
      players: playerNames().map((pl) => {
        const p = picks.find((x) => x.playerId === pl.id);
        return {
          name: pl.name,
          done: !!p,
          pick: revealed && p ? pickDto(p) : null,
          points: revealed && p ? points.get(pl.id) ?? 0 : null
        };
      }),
      result: { afc: team(result.afc), nfc: team(result.nfc), sb: team(result.sb), sbTotal: result.sbTotal }
    };
  });

  app.put<{ Body: { afc?: string; nfc?: string; sb?: string; sbTotal?: number }; Reply: Replies<OkDto> }>(
    '/api/bonus',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (bonusPhase() !== 'open') return reply.code(409).send({ error: t.api.bonusClosed });
      const field = bonusField()!;
      const byAbbr = (abbr: unknown) =>
        typeof abbr === 'string'
          ? (db.prepare('SELECT id FROM teams WHERE abbr = ? COLLATE NOCASE').get(abbr) as { id: string } | undefined)?.id
          : undefined;
      const afc = byAbbr(req.body?.afc);
      const nfc = byAbbr(req.body?.nfc);
      const sb = byAbbr(req.body?.sb);
      const total = Number(req.body?.sbTotal);
      if (!afc || !field.afc.some((t) => t.teamId === afc)) return reply.code(400).send({ error: t.api.bonusPickAfc });
      if (!nfc || !field.nfc.some((t) => t.teamId === nfc)) return reply.code(400).send({ error: t.api.bonusPickNfc });
      if (!sb || (sb !== afc && sb !== nfc)) return reply.code(400).send({ error: t.api.bonusPickSuperBowl });
      if (!Number.isInteger(total) || total < 0 || total > 200) return reply.code(400).send({ error: t.api.bonusTiebreak });
      saveBonusPick({ playerId: req.me.id, afc, nfc, sb, sbTotal: total });
      return { ok: true };
    }
  );

  app.get<{ Reply: Replies<BonusSettingsDto> }>('/api/admin/bonus', { preHandler: requireAdmin }, async () => bonusSettings());

  app.put<{ Body: { enabled?: boolean; reveal?: string; points?: { afc?: number; nfc?: number; sb?: number } }; Reply: Replies<BonusSettingsDto> }>(
    '/api/admin/bonus',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const cur = bonusSettings();
      const pts = { ...cur.points, ...(req.body?.points ?? {}) };
      for (const v of Object.values(pts))
        if (!Number.isInteger(v) || v < 0 || v > 50) return reply.code(400).send({ error: t.api.bonusInvalidPoints });
      const reveal = req.body?.reveal ?? cur.reveal;
      if (reveal !== 'wildcard' && reveal !== 'superbowl') return reply.code(400).send({ error: t.api.bonusUnknownReveal });
      const next: BonusSettingsDto = { enabled: req.body?.enabled ?? cur.enabled, points: pts, reveal };
      saveBonusSettings(next);
      return next;
    }
  );
}
