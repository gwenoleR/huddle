/** Login, group creation and 4-digit PIN. */
import type { Messages } from '../index';
export const login = {
  whoTitle: 'Who are you?',
  whoHelp: 'Tap your name, then enter your PIN.',
  notInList: "Not on the list? Ask the admin to add you.",

  setupTitle: 'Create your group',
  setupHelp: "You'll be the admin: you can add your crew from your profile afterwards.",
  setupName: 'Your first name',
  next: 'Continue',

  retypeToConfirm: 'Type it again to confirm',
  pinMismatch: "The two PINs don't match. Let's try again.",
  choosePin: 'Choose your PIN',
  confirmPin: 'Confirm your PIN',
  hello: (name: string) => `Hey ${name}`,
  newPinHelp: '4 digits, just for you',
  pinHelp: 'Your 4-digit PIN',
  changeName: 'Change name',
  notYou: 'Not you?',
  /** Screen reader: "2 of 4 digits". */
  pinProgress: (typed: number) => `${typed} of 4 digits`,
  eraseLabel: 'Delete last digit',
  erase: 'Delete',
  staysLogged: "You'll stay logged in on this phone."
} satisfies Messages['login'];
