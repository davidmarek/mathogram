import { puzzles } from './content/animals';

const website = import.meta.env.VITE_UMAMI_WEBSITE_ID;
function configuredEndpoint(): string | undefined {
  try {
    const url = new URL(import.meta.env.VITE_UMAMI_ENDPOINT);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.endsWith('/api/send')
    )
      return url.href;
  } catch {
    return undefined;
  }
}
const endpoint = configuredEndpoint();
export const analyticsEnabled =
  import.meta.env.PROD &&
  import.meta.env.VITE_ANALYTICS_ENABLED === 'true' &&
  endpoint !== undefined &&
  typeof website === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    website,
  );

export function analyticsAllowed(): boolean {
  return (
    analyticsEnabled &&
    navigator.onLine &&
    navigator.doNotTrack !== '1' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl !== true
  );
}

type EventData = Record<string, string | number | boolean>;

const isPuzzle = (puzzleId: string) =>
  puzzles.some((puzzle) => puzzle.id === puzzleId);

function context() {
  const language = document.documentElement.lang;
  const { width, height } = window.screen ?? {};
  return {
    ...(language === 'en' || language === 'cs' ? { language } : {}),
    ...(Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0
      ? { screen: `${width}x${height}` }
      : {}),
  };
}

let screenPath = '';

function send(name?: string, data?: EventData) {
  try {
    if (!analyticsAllowed()) return;

    // Never send the current query, fragment, referrer, or saved game state.
    void fetch(endpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      keepalive: true,
      body: JSON.stringify({
        type: 'event',
        payload: {
          website,
          hostname: window.location.hostname,
          url:
            new URL(import.meta.env.BASE_URL, window.location.href).pathname +
            screenPath,
          ...context(),
          ...(name ? { name, data } : {}),
        },
      }),
    }).catch(() => {});
  } catch {
    // Blocked or unavailable analytics must never interrupt play.
  }
}

/** A virtual pageview: the gallery, or `puzzle/<id>` below the app base path. */
export function trackScreen(puzzleId: string | null) {
  if (puzzleId !== null && !isPuzzle(puzzleId)) return;
  // Later events are attributed to this screen.
  screenPath = puzzleId === null ? '' : `puzzle/${puzzleId}`;
  send();
}

export function trackPuzzleStarted(
  puzzleId: string,
  details: {
    replay: boolean;
    exercises: 'picture' | 'custom';
    display: 'standalone' | 'browser';
  },
) {
  if (isPuzzle(puzzleId))
    send('Puzzle started', {
      puzzleId,
      replay: details.replay === true,
      exercises: details.exercises === 'custom' ? 'custom' : 'picture',
      display: details.display === 'standalone' ? 'standalone' : 'browser',
    });
}

export function trackPuzzleCompleted(puzzleId: string) {
  if (isPuzzle(puzzleId)) send('Puzzle completed', { puzzleId });
}

/** Leaving an unfinished picture; progress is floored to 10% steps. */
export function trackPuzzleLeft(
  puzzleId: string,
  solved: number,
  total: number,
) {
  if (
    isPuzzle(puzzleId) &&
    Number.isSafeInteger(solved) &&
    Number.isSafeInteger(total) &&
    solved >= 0 &&
    solved < total
  )
    send('Puzzle left', {
      puzzleId,
      progress: Math.floor((solved / total) * 10) * 10,
    });
}

export function trackPuzzleTime(puzzleId: string, activeSeconds: number) {
  if (
    isPuzzle(puzzleId) &&
    Number.isSafeInteger(activeSeconds) &&
    activeSeconds > 0
  )
    send('Puzzle time spent', { puzzleId, activeSeconds });
}
