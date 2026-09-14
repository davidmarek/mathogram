import type { Messages } from './en';

export function practiceMessages(
  t: Messages,
  subject: 'math' | 'czech',
): Messages {
  if (subject === 'math') return t;
  return {
    ...t,
    tagline: t.spellingTagline,
    galleryIntro: t.spellingIntro,
    howTitle: t.spellingHowTitle,
    howBody: t.spellingHowBody,
    gentle: t.spellingGentle,
    completeBody: t.spellingComplete,
    hiddenGrid: t.spellingHiddenGrid,
  };
}
