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
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await expect.poll(() => events().length).toBe(2);
    await page.getByRole('button', { name: 'My pictures', exact: true }).click();
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await page.evaluate(() => {
      const progress: Progress = JSON.parse(
        localStorage.getItem('mathogram.progress')!,
      );
      const attempt = progress.attempts.fish!;
      attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
      localStorage.setItem('mathogram.progress', JSON.stringify(progress));
    });
    await page.reload();
    await expect.poll(() => events().length).toBe(3);
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await answerEquation(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => events().length).toBe(4);
    await page.getByRole('button', { name: 'My pictures', exact: true }).click();
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect.poll(() => events().length).toBe(5);
    expect(events().map((request) => request.postDataJSON())).toEqual(
      [
        'pageview',
        'Puzzle started',
        'pageview',
        'Puzzle completed',
        'Puzzle started',
      ].map((name) => ({
        type: 'event',
        payload: {
          website: process.env.VITE_UMAMI_WEBSITE_ID,
          hostname: '127.0.0.1',
          url: '/mathogram/',
          ...(name === 'pageview' ? {} : { name, data: { puzzleId: 'fish' } }),
        },
      })),
    );
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
    await page.getByRole('button', { name: /Sunny fish/ }).click();
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
      url: '/mathogram/',
      name: 'Puzzle time spent',
      data: { puzzleId: 'fish', activeSeconds: 10 },
    });
    await page.clock.runFor(120_000);
    await page.getByRole('button', { name: 'Back to play' }).click();
    await page.clock.runFor(5_000);
    await page.getByRole('button', { name: 'My pictures', exact: true }).click();
    await expect.poll(() => durations().length).toBe(2);
    expect(durations()[1].data).toEqual({ puzzleId: 'fish', activeSeconds: 5 });
    await page.clock.runFor(120_000);
    expect(durations()).toHaveLength(2);
  });

  test('reports online Home Screen-style launches without adding a launch-mode property', async ({
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
    await expect(page.getByText('Make yourself at home')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to play' }).click();
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await expect.poll(() => analyticsRequests.length).toBe(2);
    expect(analyticsRequests.map((request) => request.postDataJSON())).toEqual([
      {
        type: 'event',
        payload: {
          website: process.env.VITE_UMAMI_WEBSITE_ID,
          hostname: '127.0.0.1',
          url: '/mathogram/',
        },
      },
      {
        type: 'event',
        payload: {
          website: process.env.VITE_UMAMI_WEBSITE_ID,
          hostname: '127.0.0.1',
          url: '/mathogram/',
          name: 'Puzzle started',
          data: { puzzleId: 'fish' },
        },
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
      await page.getByRole('button', { name: /Sunny fish/ }).click();
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
      await page.getByRole('button', { name: /Sunny fish/ }).click();
      await answerEquation(page);
      await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
      expect(analyticsRequests).toEqual([]);
    });
  }
});
