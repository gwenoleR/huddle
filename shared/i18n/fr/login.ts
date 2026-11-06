/** Login, group creation and 4-digit PIN. */
export const login = {
  whoTitle: 'Qui es-tu ?',
  whoHelp: 'Touche ton prénom, puis ton code.',
  notInList: 'Pas dans la liste ? Demande à l’admin de t’ajouter.',

  setupTitle: 'Crée ton groupe',
  setupHelp: 'Tu en seras l’admin : tu ajouteras ensuite ta bande depuis ton profil.',
  setupName: 'Ton prénom',
  next: 'Continuer',

  retypeToConfirm: 'Retape-le pour confirmer',
  pinMismatch: 'Les deux codes ne correspondent pas. On recommence.',
  choosePin: 'Choisis ton code',
  confirmPin: 'Confirme ton code',
  hello: (name: string) => `Salut ${name}`,
  newPinHelp: '4 chiffres, rien que pour toi',
  pinHelp: 'Ton code à 4 chiffres',
  changeName: 'Changer de prénom',
  notYou: 'Pas toi ?',
  /** Screen reader: « 2 chiffres sur 4 ». */
  pinProgress: (typed: number) => `${typed} chiffres sur 4`,
  eraseLabel: 'Effacer le dernier chiffre',
  erase: 'Effacer',
  staysLogged: 'Tu restes connecté sur ce téléphone.'
};
