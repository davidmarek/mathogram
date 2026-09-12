import { puzzles } from './content/animals';

const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
export const analyticsEnabled =
  import.meta.env.PROD &&
  import.meta.env.VITE_ANALYTICS_ENABLED === 'true' &&
  typeof domain === 'string' &&
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(domain);

function send(name: string, props?: { animal: string }) {
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
    void fetch('https://plausible.io/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      keepalive: true,
      body: JSON.stringify({
        name,
        domain,
        url: new URL(import.meta.env.BASE_URL, window.location.origin).href,
        ...(props ? { props } : {}),
      }),
    }).catch(() => {});
  } catch {
    // Blocked or unavailable analytics must never interrupt play.
  }
}

export function trackPageview() {
  send('pageview');
}

export function trackPuzzle(
  event: 'Puzzle started' | 'Puzzle completed',
  animal: string,
) {
  if (puzzles.some((puzzle) => puzzle.id === animal)) send(event, { animal });
}
