import { useEffect } from 'react';
import {
  analyticsAllowed,
  analyticsEnabled,
  trackPuzzleTime,
} from './analytics';

const INTERVAL_MS = 60_000;

export function usePuzzleTime(puzzleId: string | null) {
  useEffect(() => {
    if (!analyticsEnabled || !puzzleId) return;

    let start: number | undefined;
    let lastActivity = 0;
    let pageHidden = false;
    const eligible = () =>
      !pageHidden &&
      document.visibilityState === 'visible' &&
      analyticsAllowed();

    function resume() {
      if (!eligible() || start !== undefined) return;
      start = lastActivity = performance.now();
    }

    function flush() {
      const now = performance.now();
      if (start !== undefined) {
        const seconds = Math.floor(
          Math.max(0, Math.min(now, lastActivity + INTERVAL_MS) - start) / 1000,
        );
        // Drop before sending: failed or offline reports must never be replayed.
        start = undefined;
        if (seconds > 0 && analyticsAllowed())
          trackPuzzleTime(puzzleId!, seconds);
      }
    }

    function activity() {
      if (!eligible()) return;
      const now = performance.now();
      if (start === undefined || now > lastActivity + INTERVAL_MS) {
        flush();
        start = now;
      }
      lastActivity = now;
    }

    function visibility() {
      if (document.visibilityState === 'visible') resume();
      else flush();
    }
    function hide() {
      pageHidden = true;
      flush();
    }
    function show() {
      pageHidden = false;
      resume();
    }
    function offline() {
      start = undefined;
    }
    function online() {
      const now = performance.now();
      if (eligible() && start === undefined && now < lastActivity + INTERVAL_MS)
        start = now;
    }

    resume();
    const timer = window.setInterval(() => {
      flush();
      if (eligible() && performance.now() < lastActivity + INTERVAL_MS)
        start = performance.now();
    }, INTERVAL_MS);
    document.addEventListener('pointerdown', activity);
    document.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', activity);
      document.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      flush();
    };
  }, [puzzleId]);
}
