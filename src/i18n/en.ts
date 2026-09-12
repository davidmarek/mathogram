export const en = {
  tagline: 'Little sums. Lovely discoveries.',
  galleryTitle: 'Who will you discover?',
  galleryIntro: 'Pick a little friend. Solve a sum. Bring them to life!',
  collection: 'YOUR LITTLE WORLD',
  friends: 'friends discovered',
  fish: 'Sunny fish',
  butterfly: 'Berry butterfly',
  cat: 'Ginger cat',
  rabbit: 'Clover bunny',
  dog: 'Biscuit pup',
  owl: 'Twilight owl',
  easy: 'Little steps',
  adventurous: 'A little adventure',
  pixels: 'pixels',
  start: 'Let’s play',
  continue: 'Keep going',
  replay: 'Play again',
  completed: 'Discovered',
  gallery: 'My animals',
  settings: 'Settings',
  help: 'Help',
  language: 'Language',
  showRowHints: 'Show row hints',
  rowHintsHelp:
    'Highlight the current row and show its letter. Turn this off to solve without hints from the picture.',
  close: 'Back to play',
  howTitle: 'One sum, one little pixel',
  howBody:
    'Solve the sum and type your answer. Tap Check and a pixel appears in that column. Row hints can show its letter. A missed sum comes back after other exercises. If only one pixel is left, a practice sum comes first without adding a pixel. No need to tap the picture!',
  gentle: 'Take your time. One little sum at a time.',
  installTitle: 'Make yourself at home',
  installBody:
    'On iPhone or iPad, open this page in Safari. Tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add. On other browsers, use their install app menu.',
  storageTitle: 'Saved on this device',
  analyticsTitle: 'Usage statistics — for parents',
  analyticsBody:
    'This site uses Umami to count online visits and pictures started or completed, with the puzzle ID. No cookies, saved progress, or answers are sent. The analytics service receives your IP address and browser information to estimate visitors. Do Not Track and Global Privacy Control stop these requests. Offline play is not reported.',
  analyticsPolicy: 'How Umami protects privacy',
  storageBody:
    'Your animals are saved in this browser, not an account. Clearing browser data or device cleanup can remove progress and offline files. Home Screen and browser progress may be separate. Nothing syncs to another device.',
  offlineHelp:
    'Wait for “Ready for offline play” before going offline. A first-ever visit needs the internet. Offline storage is best-effort, not permanent.',
  persist: 'Ask to keep local data',
  persisted:
    'The browser granted persistent storage. You can still remove it in browser settings.',
  notPersisted:
    'The browser did not grant persistent storage. You can keep playing; device cleanup may remove data.',
  persistError:
    'The storage request failed. You can keep playing, but storage is not guaranteed.',
  resetAll: 'Reset all my animals',
  resetTitle: 'Start your collection over?',
  resetBody:
    'This removes every saved picture and discovery badge in Mathogram. Your language and row hint setting stay the same. Other apps are not affected.',
  restart: 'Restart this picture',
  restartTitle: 'Start this picture over?',
  restartBody:
    'Only this picture’s filled pixels will be cleared. Your other animals and discovery badges stay safe.',
  cancel: 'Keep playing',
  confirm: 'Yes, start over',
  row: 'Row',
  column: 'column',
  solve: 'SOLVE & REVEAL',
  answer: 'Your answer',
  check: 'Check',
  erase: 'Erase last digit',
  retry: 'Not quite. Let’s try another sum and come back to this one.',
  range: 'Answers are from 1 to 20. Let’s try another sum first.',
  retryOnly: 'Not quite. Take a moment and work through the sum.',
  correct: 'Lovely! A new pixel!',
  practice: 'A LITTLE PRACTICE',
  practiceHint:
    'A practice sum, then back to the last pixel. No new pixel here.',
  practiceCorrect: 'Well done! Back to the last pixel.',
  filled: 'pixels revealed',
  hiddenGrid:
    'Hidden animal. All empty squares look the same. Solve sums to reveal its colored pixels.',
  fullGrid: 'Your finished pixel animal',
  coordinate: 'Pixel revealed:',
  completeTitle: 'Look who you found!',
  completeBody: 'One little sum at a time. You made something lovely.',
  recovered:
    'Some saved data could not be read or belongs to an older picture. Only affected progress was reset; valid animals and language were kept.',
  unavailable:
    'Progress cannot be saved in this browser right now. You can play, but new progress may be lost when you close the app.',
  offlineReady: 'Ready for offline play',
  offline: 'You’re offline',
  cacheError:
    'Offline setup or the update failed. Online play still works. Reconnect and try again.',
  updateTitle: 'A fresh little update is ready',
  updateBody:
    'Your picture will be saved before updating. Update whenever you’re ready.',
  update: 'Save & update',
  later: 'Later',
  updateBlocked:
    'We couldn’t save your picture. The update was not applied. Keep playing or allow browser storage and try again.',
  retryOffline: 'Retry offline setup',
  saved: 'Every little step is saved here',
  playHint: 'No hurry. Just you and a little discovery.',
  homeLabel: 'Mathogram home',
} as const;

export type Messages = { [Key in keyof typeof en]: string };
