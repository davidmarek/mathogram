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

function send(name?: string, data?: { animal: string }) {
  try {
    if (
      !analyticsEnabled ||
      !navigator.onLine ||
      navigator.doNotTrack === '1' ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl === true
    )
      return;

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
          url: import.meta.env.BASE_URL,
          ...(name ? { name, data } : {}),
        },
      }),
    }).catch(() => {});
  } catch {
    // Blocked or unavailable analytics must never interrupt play.
  }
}

export function trackPageview() {
  send();
}

export function trackPuzzle(
  event: 'Puzzle started' | 'Puzzle completed',
  animal: string,
) {
  if (puzzles.some((puzzle) => puzzle.id === animal)) send(event, { animal });
}
