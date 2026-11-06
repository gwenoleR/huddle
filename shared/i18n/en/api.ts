/** Error messages returned by the server. */
import type { Messages } from '../index';
export const api = {
  // Login and permissions
  groupExists: 'The group already exists: log in.',
  loginFirst: 'Log in first',
  adminOnly: 'Admins only',
  invalidName: 'Invalid name.',
  nameTaken: 'That name is already taken.',
  invalidPin: 'The PIN is 4 digits.',
  unknownPlayer: 'Unknown player.',
  tooManyTriesFromIp: 'Too many attempts from this connection. Try again in an hour.',
  tooManyTries: (minutes: number) => `Too many attempts. Try again in ${minutes} min.`,
  wrongPin: (left: number) => `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`,

  // Administration
  cannotRevokeOwnAdmin: "You can't remove your own admin rights.",
  invalidStartPoints: 'Invalid starting points.',
  cannotDeleteSelf: "You can't remove yourself.",
  /** Forced sync that fails, with the reason given by the sync status. */
  syncFailed: (reason: string) => `Sync failed: ${reason}`,

  // Games and picks
  /** API address or logo that doesn't exist. */
  notFound: 'Not found',
  gameNotFound: 'Game not found.',
  invalidPick: 'Invalid pick.',
  gameStarted: 'Too late, the game has started.',
  gameNotStarted: "The game hasn't started.",
  previewUnavailable: 'Pregame info is unavailable right now.',
  liveUnavailable: "ESPN's live feed isn't responding right now.",

  // Leaderboards
  unknownSeason: 'Unknown season.',
  noFinishedGame: 'No finished games yet.',
  nflStandingsUnavailable: "NFL standings aren't responding right now.",
  teamNotFound: 'Team not found.',

  // End-of-season bonus
  bonusClosed: 'Bonus picks are not open.',
  bonusPickAfc: 'Pick an AFC champion from the playoff teams.',
  bonusPickNfc: 'Pick an NFC champion from the playoff teams.',
  bonusPickSuperBowl: 'Your Super Bowl winner must be one of your two champions.',
  bonusTiebreak: 'Enter a point total between 0 and 200.',
  bonusInvalidPoints: 'Points must be whole numbers between 0 and 50.',
  bonusUnknownReveal: 'Unknown reveal option.',

  // Notifications
  invalidSubscription: 'Invalid subscription.'
} satisfies Messages['api'];
