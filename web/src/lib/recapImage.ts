import type { RecapDto } from './api';
import { config, t } from './i18n';

/** Couleurs du thème « Nuit de match » : l'image est toujours sombre, quel que soit le thème du téléphone. */
const C = {
  ground: '#0d131d',
  card: '#172030',
  raised: '#212c3f',
  line: '#2c3850',
  ink: '#f1efe8',
  muted: '#9aa4b6',
  brand: '#39c97a',
  wrong: '#ff6f61',
  gold: '#f2c14e',
  onGold: '#141a24'
};
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = 'Barlow, system-ui, sans-serif';

export const RECAP_W = 1080;
export const RECAP_H = 1350;

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

function initials(n: string) {
  const p = n.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase();
}

/** Dessine l'image du récap (1080 × 1350, format portrait des messageries) et la renvoie en PNG. */
export async function drawRecap(r: RecapDto): Promise<Blob> {
  // Les polices doivent être chargées avant de dessiner, sinon le canvas prend la police par défaut.
  await Promise.all([
    document.fonts.load(`800 120px ${DISPLAY}`),
    document.fonts.load(`700 40px ${DISPLAY}`),
    document.fonts.load(`600 36px ${BODY}`),
    document.fonts.load(`500 32px ${BODY}`)
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = RECAP_W;
  canvas.height = RECAP_H;
  const ctx = canvas.getContext('2d')!;
  const pad = 72;

  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);

  // En-tête
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.brand;
  ctx.font = `700 36px ${DISPLAY}`;
  ctx.fillText(config.appName.toLocaleUpperCase(t.common.locale), pad, 112);
  ctx.fillStyle = C.ink;
  ctx.font = `800 120px ${DISPLAY}`;
  ctx.fillText(r.label, pad, 232);
  ctx.fillStyle = C.muted;
  ctx.font = `500 34px ${BODY}`;
  ctx.fillText(t.recap.image.subtitle(r.complete, r.finals, r.total), pad, 292);

  // Podium de la semaine : 2e, 1er, 3e
  const podium = r.rows.slice(0, 3);
  const slots = [
    { i: 1, x: 220, h: 190 },
    { i: 0, x: 540, h: 230 },
    { i: 2, x: 860, h: 160 }
  ];
  const base = 740;
  const bw = 280;
  ctx.textAlign = 'center';
  for (const s of slots) {
    const p = podium[s.i];
    if (!p) continue;
    const top = base - s.h;
    const first = p.rank === 1;
    // Avatar
    ctx.fillStyle = first ? C.gold : C.raised;
    ctx.beginPath();
    ctx.arc(s.x, top - 120, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = first ? C.onGold : C.ink;
    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillText(initials(p.name), s.x, top - 106);
    // Prénom
    ctx.fillStyle = C.ink;
    ctx.font = `600 36px ${BODY}`;
    ctx.fillText(fit(ctx, p.name, bw - 20), s.x, top - 24);
    // Marche
    ctx.fillStyle = first ? C.gold : C.card;
    ctx.beginPath();
    ctx.roundRect(s.x - bw / 2, top, bw, s.h, [24, 24, 0, 0]);
    ctx.fill();
    ctx.fillStyle = first ? C.onGold : C.ink;
    ctx.font = `800 72px ${DISPLAY}`;
    ctx.fillText(`${p.points}`, s.x, top + 86);
    ctx.font = `600 28px ${BODY}`;
    ctx.fillStyle = first ? C.onGold : C.muted;
    ctx.fillText(t.recap.image.points(p.points), s.x, top + 124);
  }
  ctx.textAlign = 'left';

  // Classement général
  let y = 810;
  ctx.fillStyle = C.muted;
  ctx.font = `600 28px ${BODY}`;
  ctx.fillText(t.recap.image.general, pad, y);
  y += 20;
  const general = [...r.rows].sort((a, b) => a.seasonRank - b.seasonRank).slice(0, 6);
  const rowH = 54;
  for (const p of general) {
    ctx.fillStyle = C.ink;
    ctx.font = `800 36px ${DISPLAY}`;
    ctx.fillText(`${p.seasonRank}`, pad, y + 42);
    ctx.font = `600 34px ${BODY}`;
    ctx.fillText(fit(ctx, p.name, 520), pad + 64, y + 42);
    ctx.textAlign = 'right';
    ctx.font = `800 40px ${DISPLAY}`;
    ctx.fillText(`${p.seasonPoints}`, RECAP_W - pad - 120, y + 42);
    ctx.fillStyle = p.points > 0 ? C.brand : C.muted;
    ctx.font = `700 32px ${DISPLAY}`;
    ctx.fillText(`+${p.points}`, RECAP_W - pad, y + 42);
    ctx.textAlign = 'left';
    y += rowH;
  }

  // La boulette
  if (r.blunder) {
    const b = r.blunder;
    const top = RECAP_H - 190;
    ctx.fillStyle = C.card;
    ctx.beginPath();
    ctx.roundRect(pad - 16, top, RECAP_W - 2 * (pad - 16), 150, 28);
    ctx.fill();
    ctx.fillStyle = C.wrong;
    ctx.font = `700 28px ${DISPLAY}`;
    ctx.fillText(t.recap.image.blunderTitle, pad + 16, top + 48);
    ctx.fillStyle = C.ink;
    ctx.font = `600 34px ${BODY}`;
    const everyone = b.wrong.length === b.total && b.total > 2;
    ctx.fillText(fit(ctx, t.recap.image.blunder(b.wrong, everyone, b.wrongTeam), RECAP_W - 2 * pad - 32), pad + 16, top + 96);
    ctx.fillStyle = C.muted;
    ctx.font = `500 30px ${BODY}`;
    ctx.fillText(`${b.away} ${b.awayScore} – ${b.homeScore} ${b.home}`, pad + 16, top + 134);
  } else {
    ctx.fillStyle = C.muted;
    ctx.font = `500 30px ${BODY}`;
    ctx.fillText(t.recap.image.noBlunder, pad, RECAP_H - 120);
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t.recap.image.failed))), 'image/png'));
}
