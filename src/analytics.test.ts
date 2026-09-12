import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn().mockResolvedValue(new Response());
const website = '00000000-0000-4000-8000-000000000001';
const endpoint = 'https://analytics.example.com/api/send';

beforeEach(() => {
  vi.resetModules();
  request.mockClear();
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/mathogram/');
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true');
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', website);
  vi.stubEnv('VITE_UMAMI_ENDPOINT', endpoint);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('optional analytics', () => {
  it.each([
    ['PROD', false],
    ['VITE_ANALYTICS_ENABLED', ''],
    ['VITE_ANALYTICS_ENABLED', 'false'],
    ['VITE_ANALYTICS_ENABLED', 'TRUE'],
    ['VITE_UMAMI_WEBSITE_ID', ''],
    ['VITE_UMAMI_WEBSITE_ID', 'not-a-uuid'],
    ['VITE_UMAMI_ENDPOINT', ''],
    ['VITE_UMAMI_ENDPOINT', 'not-a-url'],
    ['VITE_UMAMI_ENDPOINT', 'http://analytics.example.com/api/send'],
    ['VITE_UMAMI_ENDPOINT', 'https://user@analytics.example.com/api/send'],
    [
      'VITE_UMAMI_ENDPOINT',
      'https://analytics.example.com/api/send?private=value',
    ],
    ['VITE_UMAMI_ENDPOINT', 'https://analytics.example.com/api/send#private'],
    ['VITE_UMAMI_ENDPOINT', 'https://analytics.example.com/script.js'],
  ] as const)('does not report with %s=%s', async (key, value) => {
    if (key === 'PROD') vi.stubEnv(key, value);
    else vi.stubEnv(key, value);
    const analytics = await import('./analytics');
    expect(analytics.analyticsEnabled).toBe(false);
    analytics.trackPageview();
    analytics.trackPuzzle('Puzzle started', 'fish');
    expect(request).not.toHaveBeenCalled();
  });

  it('sends only canonical pageviews and allowlisted puzzle events, without credentials or referrers', async () => {
    window.history.replaceState(
      null,
      '',
      '/mathogram/private?name=private#secret',
    );
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { trackPageview, trackPuzzle } = await import('./analytics');
    trackPageview();
    trackPuzzle('Puzzle started', 'fish');
    trackPuzzle('Puzzle completed', 'owl');
    trackPuzzle('Puzzle started', 'private-user-input');

    expect(request).toHaveBeenCalledTimes(3);
    for (const [index, [name, data]] of [
      [undefined, undefined],
      ['Puzzle started', { puzzleId: 'fish' }],
      ['Puzzle completed', { puzzleId: 'owl' }],
    ].entries()) {
      expect(request).toHaveBeenNthCalledWith(index + 1, endpoint, {
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
            url: '/mathogram/',
            ...(name ? { name, data } : {}),
          },
        }),
      });
    }
    expect(storage).not.toHaveBeenCalled();
  });

  it('accepts non-animal IDs from the puzzle catalog without changing the event schema', async () => {
    vi.doMock('./content/animals', () => ({
      puzzles: [{ id: 'rocket' }],
    }));
    try {
      const { trackPuzzle } = await import('./analytics');
      trackPuzzle('Puzzle started', 'rocket');
      trackPuzzle('Puzzle completed', 'rocket');
      trackPuzzle('Puzzle started', 'unknown');
      expect(request).toHaveBeenCalledTimes(2);
      for (const [index, name] of [
        'Puzzle started',
        'Puzzle completed',
      ].entries()) {
        expect(JSON.parse(request.mock.calls[index]![1].body).payload).toEqual({
          website,
          hostname: window.location.hostname,
          url: '/mathogram/',
          name,
          data: { puzzleId: 'rocket' },
        });
      }
    } finally {
      vi.doUnmock('./content/animals');
    }
  });

  it.each([
    'https://cloud.umami.is/api/send',
    'https://analytics.example.com/umami/api/send',
  ])('supports Cloud and self-hosted endpoints: %s', async (endpoint) => {
    vi.stubEnv('VITE_UMAMI_ENDPOINT', endpoint);
    const analytics = await import('./analytics');
    expect(analytics.analyticsEnabled).toBe(true);
    analytics.trackPageview();
    expect(request).toHaveBeenCalledWith(endpoint, expect.any(Object));
  });

  it('does not reuse server-issued cache or visitor IDs', async () => {
    request.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cache: 'server-cache',
          sessionId: 'server-session',
          visitId: 'server-visit',
        }),
      ),
    );
    const analytics = await import('./analytics');
    analytics.trackPageview();
    await Promise.resolve();
    analytics.trackPuzzle('Puzzle started', 'fish');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![1].headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(request.mock.calls[1]![1].body).not.toMatch(
      /server-|sessionId|visitId|cache/,
    );
  });
  it.each([
    { onLine: false },
    { onLine: true, doNotTrack: '1' },
    { onLine: true, globalPrivacyControl: true },
  ])(
    'drops events when offline or privacy signals apply: %j',
    async (navigator) => {
      vi.stubGlobal('navigator', navigator);
      const analytics = await import('./analytics');
      analytics.trackPageview();
      analytics.trackPuzzle('Puzzle completed', 'fish');
      expect(request).not.toHaveBeenCalled();
      vi.stubGlobal('navigator', { onLine: true });
      await Promise.resolve();
      expect(request).not.toHaveBeenCalled();
      analytics.trackPuzzle('Puzzle started', 'cat');
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it('ignores synchronous errors, rejected requests and HTTP failures without retrying', async () => {
    request
      .mockImplementationOnce(() => {
        throw new TypeError('blocked');
      })
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { trackPageview } = await import('./analytics');
    for (let index = 0; index < 3; index++)
      expect(() => trackPageview()).not.toThrow();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('keeps working if fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    const { trackPageview } = await import('./analytics');
    expect(() => trackPageview()).not.toThrow();
  });
});
