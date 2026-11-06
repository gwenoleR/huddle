/** App shell: navigation, general messages, update, notifications on the phone side. */
import type { Messages } from '../index';
export const app = {
  sessionExpired: 'Your session expired. Please log in again.',

  updateTitle: 'New version of the app',
  updateText: 'An update is ready. It takes two seconds, and your picks are safe and sound.',
  updating: 'Updating…',
  update: 'Update',
  later: 'Later'
} satisfies Messages['app'];
