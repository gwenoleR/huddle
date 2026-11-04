/** Ouvre la fiche d'une équipe depuis n'importe quel écran (la feuille vit dans App). */
export function openTeam(abbr: string) {
  dispatchEvent(new CustomEvent('open-team', { detail: abbr }));
}
