// Translator guidance:
// - Translate the values, not the keys. English is the source catalog; cs.ts
//   must keep the same keys.
// - Write for young children and their caregivers: warm, playful, reassuring,
//   concise, and never blaming or pressuring the player.
// - Use plain picture names without alliteration or decorative modifiers.
//   Prefer direct wording over repeated praise, diminutives, or slogans.
// - A "sum" or "exercise" is a math problem. Solving one reveals one colored
//   square ("pixel") in a hidden picture. A "row hint" reveals which grid row
//   to use; the answer identifies the column.
// - Keep the arithmetic instructions and examples mathematically exact.
//   Mathixel is the product name and should not be translated.
export const en = {
  // Short brand tagline, shown at the top of the picture gallery.
  tagline: 'Math practice, one pixel at a time.',
  // Gallery welcome heading and instruction, shown above the picture cards.
  galleryTitle: 'What will you make today?',
  galleryIntro: 'Choose a picture, then solve sums to fill it in.',
  // Gallery heading and count of pictures the player has completed.
  collection: 'YOUR PICTURES',
  friends: 'pictures completed',
  // Names of picture puzzles in the gallery. These may be adapted naturally
  // for the target language; they are not character dialogue.
  fish: 'Fish',
  butterfly: 'Butterfly',
  bee: 'Bee',
  snail: 'Snail',
  turtle: 'Turtle',
  cat: 'Cat',
  duck: 'Duck',
  rabbit: 'Rabbit',
  fox: 'Fox',
  dog: 'Dog',
  owl: 'Owl',
  watermelon: 'Watermelon',
  fries: 'Fries',
  'cheddar-fingers': 'Cheddar fingers',
  hamburger: 'Hamburger',
  sushi: 'Sushi',
  cheetah: 'Cheetah',
  'german-shepherd': 'German shepherd',
  ferrari: 'Ferrari sports car',
  rocket: 'Rocket',
  'robot-face': 'Robot face',
  octopus: 'Octopus',
  dinosaur: 'Dinosaur',
  train: 'Train',
  lighthouse: 'Lighthouse',
  'hot-air-balloon': 'Hot-air balloon',
  dragon: 'Dragon',
  'space-shuttle': 'Space shuttle',
  sunflower: 'Sunflower',
  'chick-and-pig': 'Chick and piglet',
  donut: 'Donut',
  ambulance: 'Ambulance',
  'police-car': 'Police car',
  firetruck: 'Firetruck',
  helicopter: 'Helicopter',
  // Difficulty labels for arithmetic modes, not school grades.
  beginner: 'Beginner',
  standard: 'Standard',
  advanced: 'Advanced',
  // Picture-size categories based on how many colored pixels are revealed.
  small: 'Small · 1–40',
  medium: 'Medium · 41–70',
  large: 'Large · 71–100',
  extraLarge: 'Extra-large · 101+',
  // Number of math exercises needed to complete a picture.
  exercises: 'exercises',
  // Help text for puzzles whose equations contain three numbers. Preserve the
  // left-to-right rule, limits, and example exactly in meaning.
  threeNumbersHelp:
    'For three-number sums, work from left to right. Each step stays below 20 without crossing a ten. Landing on 10 lets the next step go below it: 14 − 4 − 3 = 7.',
  // Count of colored grid squares revealed in a picture.
  pixels: 'pixels',
  // Actions and status badges on picture cards.
  start: 'Let’s play',
  continue: 'Keep going',
  replay: 'Play again',
  completed: 'Completed',
  // Main navigation and settings labels.
  gallery: 'My pictures',
  settings: 'Settings',
  help: 'Help',
  language: 'Language',
  appearance: 'Appearance',
  systemTheme: 'System',
  lightTheme: 'Light',
  darkTheme: 'Dark',
  // Settings that control whether the current puzzle row is highlighted and
  // its letter is shown. Turning hints off does not hide grid coordinates.
  showRowHints: 'Show row hints',
  rowHintsHelp:
    'Highlight the row for the current sum and show its letter. Turn this off to hide the hint. Row and column labels stay visible.',
  close: 'Close',
  // Help dialog explaining the normal reveal rule and final-pixel practice.
  howTitle: 'How to play',
  exercisesTitle: 'Exercises',
  exerciseMode: 'Exercise type',
  modePicture: 'Picture difficulty',
  modeNoCrossing: 'Without crossing ten',
  modeCrossing: 'Crossing ten',
  numbersUpTo: 'Numbers up to',
  operations: 'Sums',
  operationsBoth: 'Adding and subtracting',
  operationsAdd: 'Adding only',
  operationsSubtract: 'Subtracting only',
  exercisesHelp:
    'Picture difficulty uses sums suited to each picture. Choose an exercise type and number limit for new, restarted, and replayed pictures. Pictures already in progress keep their current sums. A sum’s answer gives its column, so you may need to raise the number limit to start a wide picture. When crossing ten is on, sums such as 8 + 4 or 12 − 5 are used when they fit the picture.',
  needsNumbers: 'Requires numbers up to',
  howBody:
    'Solve the sum, enter your answer, then tap Check. A correct answer reveals a colored square, called a pixel. Your answer gives its column; row hints show which row it belongs in. If you get a sum wrong, you’ll try it again after other sums. When only one pixel remains, you’ll do a practice sum before trying again. Practice sums don’t reveal pixels. You don’t need to tap the picture.',
  gentle: 'Take as much time as you need.',
  // Installation instructions in the help dialog; platform menu names may
  // need the official localized wording for iOS/iPadOS.
  installTitle: 'Add Mathixel to your home screen',
  installBody:
    'On iPhone or iPad, open this page in Safari. Tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add. On other browsers, use their install app menu.',
  // Data storage and privacy sections in Settings/help.
  storageTitle: 'Saved on this device',
  analyticsTitle: 'Usage statistics — for parents',
  analyticsBody:
    'This site uses Umami to count online visits, which pictures are opened, started, left unfinished (with rough progress) or completed, and approximate active solving seconds, with the puzzle ID. Reports also include the game language, screen size, whether the game was installed, and whether picture or custom exercises were chosen. Timing pauses in the background, in dialogs, and after one minute without interaction. No cookies, saved progress, or answers are sent. The analytics service receives your IP address and browser information to estimate visitors. Do Not Track and Global Privacy Control stop these requests. Offline play is not reported.',
  analyticsPolicy: 'How Umami protects privacy',
  storageBody:
    'Your pictures are saved in this browser, not an account. Clearing browser data or device cleanup can remove progress and offline files. Home Screen and browser progress may be separate. Nothing syncs to another device.',
  offlineHelp:
    'Wait for “Ready for offline play” before going offline. You need an internet connection for your first visit. Your browser may remove offline files during storage cleanup.',
  // Requests the browser to protect locally saved progress from automatic
  // storage cleanup; this does not make the data permanent.
  persist: 'Ask to keep local data',
  persisted:
    'The browser granted persistent storage. You can still remove it in browser settings.',
  notPersisted:
    'The browser did not grant persistent storage. You can keep playing; device cleanup may remove data.',
  persistError:
    'The storage request failed. You can keep playing, but storage is not guaranteed.',
  // Confirmation dialog for clearing all local picture progress.
  resetAll: 'Reset all my pictures',
  resetTitle: 'Start all your pictures over?',
  resetBody:
    'This clears progress on every picture and removes all completion badges in Mathixel. Your language and row hint setting stay the same. Other apps are not affected.',
  // Action and confirmation dialog for clearing progress on the current
  // picture only.
  restart: 'Restart this picture',
  restartTitle: 'Start this picture over?',
  restartBody:
    'This clears the filled pixels in this picture. Your other pictures and completion badges will stay.',
  cancel: 'Cancel',
  confirm: 'Start over',
  // Grid coordinate labels: a row is horizontal; a column is vertical.
  row: 'Row',
  column: 'column',
  solve: 'SOLVE THE SUM',
  // Answer-entry controls. "Check" submits the entered answer.
  answer: 'Your answer',
  check: 'Check',
  erase: 'Erase last digit',
  // Feedback after a wrong answer. The missed exercise returns later; no
  // progress is lost and the tone should remain encouraging.
  retry: 'Not quite. Try another sum, then come back to this one.',
  // Feedback for an answer outside the valid range.
  range: 'Your answer needs to be between 1 and 20. Try another sum first.',
  // Wrong-answer feedback during the special final-pixel practice round;
  // there is no other regular exercise to switch to.
  retryOnly: 'Not quite. Take your time and try again.',
  // Feedback after a correct answer reveals a new colored square.
  correct: 'Correct! You revealed a pixel.',
  // When one unrevealed pixel remains, the game inserts a practice exercise.
  // It cannot reveal another pixel; its purpose is to return to the last one.
  practice: 'PRACTICE',
  practiceHint:
    'Try a practice sum before returning to the last pixel. This one won’t fill a square.',
  practiceCorrect: 'Correct! Now try the last pixel again.',
  // Progress count, hidden-picture accessibility description, and completed
  // picture description.
  filled: 'pixels revealed',
  hiddenGrid:
    'Hidden picture. All empty squares look the same. Solve sums to reveal its colored pixels.',
  fullGrid: 'Your finished pixel picture',
  coordinate: 'Pixel revealed:',
  // Celebration shown after every pixel in the picture has been revealed.
  completeTitle: 'You finished the picture!',
  completeBody: 'Play again or choose another picture.',
  // Notices shown when saved progress was partly invalid or cannot currently
  // be written. Explain the problem without implying the whole app is broken.
  recovered:
    'Some saved data could not be read or belongs to an older picture. Only affected progress was reset; valid pictures and language were kept.',
  unavailable:
    'Progress cannot be saved in this browser right now. You can play, but new progress may be lost when you close the app.',
  // Offline connection and service-worker setup/update status messages.
  offlineReady: 'Ready for offline play',
  offline: 'You’re offline',
  cacheError:
    'Offline setup or the update failed. Online play still works. Reconnect and try again.',
  updateTitle: 'An update is ready',
  updateBody:
    'Your picture will be saved before updating. Update whenever you’re ready.',
  update: 'Save & update',
  later: 'Later',
  updateBlocked:
    'We couldn’t save your picture. The update was not applied. Keep playing or allow browser storage and try again.',
  // Settings controls for retrying offline setup and applying a waiting app
  // update. "Later" leaves the current game running.
  retryOffline: 'Retry offline setup',
  saved: 'Progress saved in this browser',
  // Quiet encouragement shown during play; not an instruction or warning.
  playHint: 'You can stop and come back later.',
  // Accessible name for the brand button that returns to the picture gallery.
  homeLabel: 'Mathixel home',
} as const;

export type Messages = { [Key in keyof typeof en]: string };
