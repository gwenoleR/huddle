/**
 * Huddle design system: one file per component, each with its own CSS.
 * Imported in main.tsx before app.css, so the app styles can override the ones here.
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
