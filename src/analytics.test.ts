import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn().mockResolvedValue(new Response());

beforeEach(() => {
  vi.resetModules();
  request.mockClear();
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/mathogram/');
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true');
  vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'davidmarek.github.io');
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
    ['VITE_PLAUSIBLE_DOMAIN', ''],
    ['VITE_PLAUSIBLE_DOMAIN', 'https://example.com'],
    ['VITE_PLAUSIBLE_DOMAIN', 'user@example.com'],
    ['VITE_PLAUSIBLE_DOMAIN', 'example.com/?secret=value'],
  ] as const)('does not report with %s=%s', async (key, value) => {
    if (key === 'PROD') vi.stubEnv(key, value);
    else vi.stubEnv(key, value);
    const analytics = await import('./analytics');
    expect(analytics.analyticsEnabled).toBe(false);
    analytics.trackPageview();
    analytics.trackPuzzle('Puzzle started', 'fish');
    expect(request).not.toHaveBeenCalled();
  });

  it('sends only canonical pageviews and allowlisted animal events, without credentials or referrers', async () => {
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
    for (const [index, [name, props]] of [
      ['pageview', undefined],
      ['Puzzle started', { animal: 'fish' }],
      ['Puzzle completed', { animal: 'owl' }],
    ].entries()) {
      expect(request).toHaveBeenNthCalledWith(
        index + 1,
        'https://plausible.io/api/event',
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          keepalive: true,
          body: JSON.stringify({
            name,
            domain: 'davidmarek.github.io',
            url: `${window.location.origin}/mathogram/`,
            ...(props ? { props } : {}),
          }),
        },
      );
    }
    expect(storage).not.toHaveBeenCalled();
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
