/** Shareable weekly recap (screen and image). */
export const recap = {
  eyebrow: 'À envoyer dans le groupe',
  /** « Récap · Semaine 9 », or « Récap de la semaine » before loading. */
  title: (label: string | null) => `Récap ${label ? `· ${label}` : 'de la semaine'}`,
  /** The image's alt text; `label` is the week's name (« Semaine 9 »). */
  imageAlt: (label: string) => `Récap de la ${label.toLowerCase()} : podium, classement général et boulette`,
  incomplete: (finals: number, total: number) =>
    `Semaine pas finie : ${finals} matchs joués sur ${total}. Le récap se complète au fil des matchs.`,
  share: 'Partager',
  save: 'Enregistrer l’image',
  /** Share title: « Prono · Semaine 9 » */
  shareTitle: (appShortName: string, label: string) => `${appShortName} · ${label}`,
  shareFailed: 'Partage impossible, enregistre l’image à la place.',

  /** Texts drawn on the image */
  image: {
    subtitle: (complete: boolean, finals: number, total: number) =>
      complete ? `Le récap · ${total} matchs` : `Le récap provisoire · ${finals} matchs sur ${total}`,
    points: (n: number) => (n > 1 ? 'points' : 'point'),
    general: 'CLASSEMENT GÉNÉRAL',
    blunderTitle: '✗ LA BOULETTE',
    /** « Gwen et Bea ont pris les Jets », « Toute la bande a pris les Jets » */
    blunder: (wrong: string[], everyone: boolean, team: string) => {
      const who = everyone ? 'Toute la bande' : names(wrong);
      const verb = !everyone && wrong.length > 1 ? 'ont pris' : 'a pris';
      return `${who} ${verb} les ${team}`;
    },
    noBlunder: 'Aucune boulette cette semaine. Respect.',
    failed: 'Image impossible'
  }
};

/** « Gwen », « Gwen et Bea », « Gwen, Bea et Max » */
function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} et ${list.at(-1)}`;
}
