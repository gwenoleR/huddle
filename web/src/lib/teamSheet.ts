/** Opens a team's page from any screen (the sheet lives in App). */
export function openTeam(abbr: string) {
  dispatchEvent(new CustomEvent('open-team', { detail: abbr }));
}
