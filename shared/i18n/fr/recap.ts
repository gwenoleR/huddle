/** Récap de la semaine à partager (écran et image). */
export const recap = {
  eyebrow: 'À envoyer dans le groupe',
  /** « Récap · Semaine 9 », ou « Récap de la semaine » avant chargement. */
  title: (label: string | null) => `Récap ${label ? `· ${label}` : 'de la semaine'}`,
  /** Texte alternatif de l'image ; `label` est le nom de la semaine (« Semaine 9 »). */
  imageAlt: (label: string) => `Récap de la ${label.toLowerCase()} : podium, classement général et boulette`,
  incomplete: (finals: number, total: number) =>
    `Semaine pas finie : ${finals} matchs joués sur ${total}. Le récap se complète au fil des matchs.`,
  share: 'Partager',
  save: 'Enregistrer l’image',
  /** Titre du partage : « Prono · Semaine 9 » */
  shareTitle: (appShortName: string, label: string) => `${appShortName} · ${label}`,
  shareFailed: 'Partage impossible, enregistre l’image à la place.',

  /** Textes dessinés sur l'image */
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
