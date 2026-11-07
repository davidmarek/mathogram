import { expect } from '@playwright/test';
import type { Progress } from '../../src/storage/progress';
import {
  analyticsEndpoint,
  analyticsExpected,
  answerEquation,
  test,
} from './helpers';

test.describe('enabled analytics', () => {
  test.use({ serviceWorkers: 'block' });
  test.skip(
    !analyticsExpected,
    'Run against an explicitly analytics-enabled build.',
  );

  test('reports one canonical visit, new attempts and final reveals with only puzzle IDs', async ({
    page,
    context,
    analyticsRequests,
  }) => {
    const events = () =>
      analyticsRequests.filter(
        (request) =>
          request.postDataJSON().payload.name !== 'Puzzle time spent',
      );
    await context.addCookies([
      {
        name: 'unrelated',
        value: 'must-not-send',
        domain: new URL(analyticsEndpoint).hostname,
        path: '/',
        secure: true,
        sameSite: 'None',
      },
    ]);
    await page.goto('./?private=value#secret');
    await expect.poll(() => events().length).toBe(1);
    await page.getByRole('button', { name: /Fish/ }).click();
    await expect.poll(() => events().length).toBe(3);
    await page
      .getByRole('button', { name: 'My pictures', exact: true })
      .click();
    await expect.poll(() => events().length).toBe(5);
    await page.getByRole('button', { name: /Fish/ }).click();
    await expect.poll(() => events().length).toBe(6);
    await page.evaluate(() => {
      const progress: Progress = JSON.parse(
        localStorage.getItem('mathogram.progress')!,
      );
      const attempt = progress.attempts.fish!;
      attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
      localStorage.setItem('mathogram.progress', JSON.stringify(progress));
    });
    await page.reload();
    await expect.poll(() => events().length).toBe(7);
    await page.getByRole('button', { name: /Fish/ }).click();
    await answerEquation(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => events().length).toBe(9);
    await page
      .getByRole('button', { name: 'My pictures', exact: true })
      .click();
    await page.getByRole('button', { name: /Fish/ }).click();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect.poll(() => events().length).toBe(12);
    const gallery = { url: '/' };
    const fish = { url: '/puzzle/fish' };
    const started = (replay: boolean) => ({
      url: '/puzzle/fish',
      name: 'Puzzle started',
      data: {
        puzzleId: 'fish',
        replay,
        exercises: 'picture',
        display: 'browser',
      },
    });
    const payloads = events().map((request) => {
      const { type, payload } = request.postDataJSON();
      expect(type).toBe('event');
      return payload;
    });
    expect(
      payloads.map(({ url, name, data }) => ({
        url,
        ...(name ? { name, data } : {}),
      })),
    ).toEqual([
      gallery,
      { ...started(false), url: '/' },
      fish,
      {
        url: '/puzzle/fish',
        name: 'Puzzle left',
        data: { puzzleId: 'fish', progress: 0 },
      },
      gallery,
      fish,
      gallery,
      fish,
      {
        url: '/puzzle/fish',
        name: 'Puzzle completed',
        data: { puzzleId: 'fish' },
      },
      gallery,
      fish,
      started(true),
    ]);
    for (const payload of payloads)
      expect(Object.keys(payload).sort()).toEqual(
        [
          'website',
          'hostname',
          'url',
          'language',
          'screen',
          ...(payload.name ? ['name', 'data'] : []),
        ].sort(),
      );
    expect(payloads[0]).toEqual({
      website: process.env.VITE_UMAMI_WEBSITE_ID,
      hostname: '127.0.0.1',
      url: '/',
      language: 'en',
      screen: expect.stringMatching(/^[1-9][0-9]*x[1-9][0-9]*$/),
    });
    for (const request of analyticsRequests) {
      expect(request.method()).toBe('POST');
      const headers = await request.allHeaders();
      expect(headers.cookie).toBeUndefined();
      expect(headers.referer).toBeUndefined();
    }
  });

  test('reports active seconds, excluding time in Help and the gallery', async ({
    page,
    analyticsRequests,
  }) => {
    await page.clock.install();
    await page.goto('./');
    await page.getByRole('button', { name: /Fish/ }).click();
    await page.clock.runFor(10_000);
    await page.getByRole('button', { name: 'Help' }).click();
    const durations = () =>
      analyticsRequests
        .map((request) => request.postDataJSON().payload)
        .filter((payload) => payload.name === 'Puzzle time spent');
    await expect.poll(() => durations().length).toBe(1);
    expect(durations()[0]).toEqual({
      website: process.env.VITE_UMAMI_WEBSITE_ID,
      hostname: '127.0.0.1',
      url: '/puzzle/fish',
      language: 'en',
      screen: expect.any(String),
      name: 'Puzzle time spent',
      data: { puzzleId: 'fish', activeSeconds: 10 },
    });
    await page.clock.runFor(120_000);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.clock.runFor(5_000);
    await page
      .getByRole('button', { name: 'My pictures', exact: true })
      .click();
    await expect.poll(() => durations().length).toBe(2);
    expect(durations()[1].data).toEqual({ puzzleId: 'fish', activeSeconds: 5 });
    await page.clock.runFor(120_000);
    expect(durations()).toHaveLength(2);
  });

  test('reports online Home Screen-style launches as standalone starts', async ({
    page,
    context,
    analyticsRequests,
  }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { get: () => true });
    });
    await page.goto('./');
    await expect.poll(() => analyticsRequests.length).toBe(1);
    await page.getByRole('button', { name: 'Help' }).click();
    await expect(
      page.getByText('Add Mathixel to your home screen'),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /Fish/ }).click();
    await expect.poll(() => analyticsRequests.length).toBe(4);
    expect(
      analyticsRequests.map((request) => {
        const { url, name, data } = request.postDataJSON().payload;
        return { url, name, data };
      }),
    ).toEqual([
      { url: '/' },
      { url: '/', name: 'Dialog opened', data: { dialog: 'help' } },
      {
        url: '/',
        name: 'Puzzle started',
        data: {
          puzzleId: 'fish',
          replay: false,
          exercises: 'picture',
          display: 'standalone',
        },
      },
      { url: '/puzzle/fish' },
    ]);
  });

  test('reports opened dialogs and changed settings with allowlisted values', async ({
    page,
    analyticsRequests,
  }) => {
    await page.goto('./');
    await expect.poll(() => analyticsRequests.length).toBe(1);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page
      .getByRole('combobox', { name: 'Appearance' })
      .selectOption('dark');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /^Česky/ }).click();
    await expect.poll(() => analyticsRequests.length).toBe(4);
    expect(
      analyticsRequests.slice(1).map((request) => {
        const { url, language, name, data } = request.postDataJSON().payload;
        return { url, language, name, data };
      }),
    ).toEqual([
      {
        url: '/',
        language: 'en',
        name: 'Dialog opened',
        data: { dialog: 'settings' },
      },
      {
        url: '/',
        language: 'en',
        name: 'Setting changed',
        data: { setting: 'theme', value: 'dark' },
      },
      {
        url: '/',
        language: 'cs',
        name: 'Setting changed',
        data: { setting: 'language', value: 'cs' },
      },
    ]);
  });

  for (const failure of ['blocked', 'server error']) {
    test(`plays normally when analytics returns ${failure}`, async ({
      page,
      context,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await context.route(analyticsEndpoint, (route) =>
        failure === 'blocked'
          ? route.abort('blockedbyclient')
          : route.fulfill({
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
              },
              body: '',
            }),
      );
      await page.goto('./');
      await page.getByRole('button', { name: /Fish/ }).click();
      await answerEquation(page);
      await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }

  for (const signal of ['doNotTrack', 'globalPrivacyControl']) {
    test(`respects ${signal}`, async ({ page, context, analyticsRequests }) => {
      await context.addInitScript((signal) => {
        Object.defineProperty(navigator, signal, {
          get: () => (signal === 'doNotTrack' ? '1' : true),
        });
      }, signal);
      await page.goto('./');
      await page.getByRole('button', { name: /Fish/ }).click();
      await answerEquation(page);
      await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
      expect(analyticsRequests).toEqual([]);
    });
  }
});
