export interface Team {
  abbr: string;
  name: string;
  color?: string;
  textColor?: string;
  logoUrl?: string;
}

export type Side = 'away' | 'home';
export type MatchStatus = 'open' | 'locked' | 'live' | 'final';
