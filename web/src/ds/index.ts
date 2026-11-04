/**
 * Design system « Prono NFL entre potes » : un fichier par composant, chacun avec son CSS.
 * Source : https://claude.ai/artifact/LumqadSKDa1KpdGUebdBNh
 * Importé dans main.tsx avant app.css, pour que les styles de l'appli puissent surcharger ceux d'ici.
 */
import './base.css';

export { Avatar, AvatarStack, initials } from './Avatar';
export { BottomNav } from './BottomNav';
export { Button } from './Button';
export { Icon } from './Icon';
export { LeaderboardRow } from './LeaderboardRow';
export { MatchCard, PickSplit } from './MatchCard';
export { StatusPill } from './StatusPill';
export { TeamBadge } from './TeamBadge';
export type { MatchStatus, Side, Team } from './types';
export { WeekPicker } from './WeekPicker';
