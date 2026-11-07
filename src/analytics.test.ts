import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn().mockResolvedValue(new Response());
const website = '00000000-0000-4000-8000-000000000001';
const endpoint = 'https://analytics.example.com/api/send';
const started = {
  replay: false,
  exercises: 'picture',
  display: 'browser',
} as const;
const startedData = { replay: false, exercises: 'picture', display: 'browser' };

beforeEach(() => {
  vi.resetModules();
  request.mockClear();
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', './');
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
  it('sends only positive whole-second durations for known puzzles', async () => {
    const { trackPuzzleTime } = await import('./analytics');
    for (const seconds of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      trackPuzzleTime('fish', seconds);
    trackPuzzleTime('unknown', 20);
    expect(request).not.toHaveBeenCalled();
    trackPuzzleTime('fish', 42);
    expect(JSON.parse(request.mock.calls[0]![1].body).payload).toEqual({
      website,
      hostname: window.location.hostname,
      url: '/',
      name: 'Puzzle time spent',
      data: { puzzleId: 'fish', activeSeconds: 42 },
    });
  });
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
    analytics.trackScreen(null);
    analytics.trackPuzzleStarted('fish', started);
    analytics.trackPuzzleTime('fish', 10);
    expect(request).not.toHaveBeenCalled();
  });

  it('sends only canonical pageviews and allowlisted puzzle events, without credentials or referrers', async () => {
    window.history.replaceState(null, '', '/private?name=private#secret');
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { trackScreen, trackPuzzleStarted, trackPuzzleCompleted } =
      await import('./analytics');
    trackScreen(null);
    trackPuzzleStarted('fish', started);
    trackPuzzleCompleted('owl');
    trackPuzzleStarted('private-user-input', started);

    expect(request).toHaveBeenCalledTimes(3);
    for (const [index, [name, data]] of [
      [undefined, undefined],
      ['Puzzle started', { puzzleId: 'fish', ...startedData }],
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
            url: '/',
            ...(name ? { name, data } : {}),
          },
        }),
      });
    }
    expect(storage).not.toHaveBeenCalled();
  });

  it('reports virtual screen pageviews with app language and screen size', async () => {
    vi.stubEnv('BASE_URL', '/mathogram/');
    vi.stubGlobal('screen', { width: 390, height: 844 });
    document.documentElement.lang = 'cs';
    try {
      const { trackScreen, trackPuzzleCompleted } = await import('./analytics');
      trackScreen(null);
      trackScreen('fish');
      trackScreen('../private');
      trackPuzzleCompleted('fish');
      const context = {
        website,
        hostname: window.location.hostname,
        language: 'cs',
        screen: '390x844',
      };
      expect(
        request.mock.calls.map(([, init]) => JSON.parse(init.body).payload),
      ).toEqual([
        { ...context, url: '/mathogram/' },
        { ...context, url: '/mathogram/puzzle/fish' },
        {
          ...context,
          url: '/mathogram/puzzle/fish',
          name: 'Puzzle completed',
          data: { puzzleId: 'fish' },
        },
      ]);
    } finally {
      document.documentElement.lang = '';
    }
  });

  it('omits unexpected languages and invalid screen sizes', async () => {
    vi.stubGlobal('screen', { width: 0, height: 844 });
    document.documentElement.lang = 'de';
    try {
      const { trackScreen } = await import('./analytics');
      trackScreen(null);
      expect(JSON.parse(request.mock.calls[0]![1].body).payload).toEqual({
        website,
        hostname: window.location.hostname,
        url: '/',
      });
    } finally {
      document.documentElement.lang = '';
    }
  });

  it('reports start context and coarse progress when leaving unfinished puzzles', async () => {
    const { trackPuzzleStarted, trackPuzzleLeft } = await import('./analytics');
    trackPuzzleStarted('fish', {
      replay: true,
      exercises: 'custom',
      display: 'standalone',
    });
    trackPuzzleLeft('fish', 0, 12);
    trackPuzzleLeft('fish', 11, 12);
    for (const [solved, total] of [
      [12, 12],
      [-1, 12],
      [1.5, 12],
      [1, NaN],
    ])
      trackPuzzleLeft('fish', solved!, total!);
    trackPuzzleLeft('unknown', 1, 12);
    expect(
      request.mock.calls.map(([, init]) => {
        const { name, data } = JSON.parse(init.body).payload;
        return { name, data };
      }),
    ).toEqual([
      {
        name: 'Puzzle started',
        data: {
          puzzleId: 'fish',
          replay: true,
          exercises: 'custom',
          display: 'standalone',
        },
      },
      { name: 'Puzzle left', data: { puzzleId: 'fish', progress: 0 } },
      { name: 'Puzzle left', data: { puzzleId: 'fish', progress: 90 } },
    ]);
  });

  it('reports only allowlisted dialogs, settings and values', async () => {
    const { trackDialogOpened, trackSettingChanged } =
      await import('./analytics');
    trackDialogOpened('help');
    trackDialogOpened('settings');
    trackDialogOpened('restart' as 'help');
    trackSettingChanged('language', 'cs');
    trackSettingChanged('theme', 'dark');
    trackSettingChanged('rowHints', false);
    trackSettingChanged('exercises', 'custom');
    trackSettingChanged('maxNumber', 12);
    trackSettingChanged('crossTen', true);
    trackSettingChanged('operations', 'subtract');
    trackSettingChanged('language', 'de');
    trackSettingChanged('theme', 'neon');
    trackSettingChanged('rowHints', 'yes');
    trackSettingChanged('maxNumber', 9);
    trackSettingChanged('maxNumber', 21);
    trackSettingChanged('maxNumber', 12.5);
    trackSettingChanged('operations', 'multiply');
    trackSettingChanged('toString' as 'theme', 'dark');
    trackSettingChanged('private' as 'theme', 'dark');
    expect(
      request.mock.calls.map(([, init]) => {
        const { name, data } = JSON.parse(init.body).payload;
        return [name, data];
      }),
    ).toEqual([
      ['Dialog opened', { dialog: 'help' }],
      ['Dialog opened', { dialog: 'settings' }],
      ...(
        [
          ['language', 'cs'],
          ['theme', 'dark'],
          ['rowHints', false],
          ['exercises', 'custom'],
          ['maxNumber', 12],
          ['crossTen', true],
          ['operations', 'subtract'],
        ] as const
      ).map(([setting, value]) => ['Setting changed', { setting, value }]),
    ]);
  });

  it('accepts non-animal IDs from the puzzle catalog without changing the event schema', async () => {
    vi.doMock('./content/animals', () => ({
      puzzles: [{ id: 'rocket' }],
    }));
    try {
      const { trackPuzzleStarted, trackPuzzleCompleted } =
        await import('./analytics');
      trackPuzzleStarted('rocket', started);
      trackPuzzleCompleted('rocket');
      trackPuzzleStarted('unknown', started);
      expect(request).toHaveBeenCalledTimes(2);
      for (const [index, name] of [
        'Puzzle started',
        'Puzzle completed',
      ].entries()) {
        expect(JSON.parse(request.mock.calls[index]![1].body).payload).toEqual({
          website,
          hostname: window.location.hostname,
          url: '/',
          name,
          data:
            name === 'Puzzle started'
              ? { puzzleId: 'rocket', ...startedData }
              : { puzzleId: 'rocket' },
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
    analytics.trackScreen(null);
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
    analytics.trackScreen(null);
    await Promise.resolve();
    analytics.trackPuzzleStarted('fish', started);
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
      analytics.trackScreen(null);
      analytics.trackPuzzleCompleted('fish');
      analytics.trackPuzzleTime('fish', 10);
      expect(request).not.toHaveBeenCalled();
      vi.stubGlobal('navigator', { onLine: true });
      await Promise.resolve();
      expect(request).not.toHaveBeenCalled();
      analytics.trackPuzzleStarted('cat', started);
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
    const { trackScreen } = await import('./analytics');
    for (let index = 0; index < 3; index++)
      expect(() => trackScreen(null)).not.toThrow();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('keeps working if fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    const { trackScreen } = await import('./analytics');
    expect(() => trackScreen(null)).not.toThrow();
  });
});
