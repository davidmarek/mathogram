import { expect } from '@playwright/test';
import { answerEquation, test } from './helpers';

test.describe('real Workbox lifecycle', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Real SW lifecycle is exercised in Chromium; WebKit game tests are separate from physical iOS acceptance.',
  );
  test('successful precache supports cold offline reopening, every animal, both locales and scoped caches', async ({
    page,
    context,
    analyticsRequests,
  }) => {
    await page.goto('./');
    await expect(page.getByText('Ready for offline play')).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const other = await caches.open('other-project-precaches-v1');
      await other.put('/other-project/keep', new Response('keep me'));
    });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('checkbox', { name: 'Show row hints' }).uncheck();
    await page.getByRole('button', { name: 'Back to play' }).click();
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    const queue = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('mathogram.progress')!).attempts.fish
          .queue,
    );
    await page.close();
    const onlineEvents = analyticsRequests.length;
    await context.setOffline(true);
    const cold = await context.newPage();
    await cold.goto('http://127.0.0.1:4173/mathogram/');
    await expect(
      cold.getByRole('heading', { name: 'Who will you discover?' }),
    ).toBeVisible();
    for (const name of [
      'Sunny fish',
      'Berry butterfly',
      'Ginger cat',
      'Clover bunny',
      'Biscuit pup',
      'Twilight owl',
    ]) {
      await cold.getByRole('button', { name: new RegExp(name) }).click();
      await expect(
        cold.locator('.row-pill, .active-row, .active-row-label'),
      ).toHaveCount(0);
      await expect(cold.getByTestId('equation')).toBeVisible();
      await answerEquation(cold);
      await expect(cold.locator('[data-filled="true"]')).toHaveCount(1);
      await cold
        .getByRole('button', { name: 'My animals', exact: true })
        .click();
    }
    expect(
      await cold.evaluate(
        () =>
          JSON.parse(localStorage.getItem('mathogram.progress')!).attempts.fish
            .queue,
      ),
    ).toEqual(queue);
    await cold.getByRole('button', { name: 'Language: Čeština' }).click();
    await cold.reload();
    await expect(
      cold.getByRole('heading', { name: 'Koho dnes objevíš?' }),
    ).toBeVisible();
    for (const name of [
      'Slunečná rybka',
      'Borůvkový motýl',
      'Zrzavá kočka',
      'Jetelový králíček',
      'Sušenkový pejsek',
      'Soumračná sovička',
    ]) {
      await cold.getByRole('button', { name: new RegExp(name) }).click();
      await expect(
        cold.getByRole('button', { name: 'Ověřit', exact: true }),
      ).toBeVisible();
      await answerEquation(cold);
      await expect(cold.locator('[data-filled="true"]')).toHaveCount(2);
      await cold
        .getByRole('button', { name: 'Moje zvířátka', exact: true })
        .click();
    }
    expect(
      await cold.evaluate(async () =>
        (await caches.open('other-project-precaches-v1'))
          .match('/other-project/keep')
          .then((response) => response?.text()),
      ),
    ).toBe('keep me');
    const scopes = await cold.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).map(
        (registration) => registration.scope,
      ),
    );
    expect(scopes).toEqual(['http://127.0.0.1:4173/mathogram/']);
    expect(analyticsRequests).toHaveLength(onlineEvents);
    await context.setOffline(false);
    await cold.getByRole('button', { name: 'Nastavení' }).click();
    expect(analyticsRequests).toHaveLength(onlineEvents);
  });

  test('waiting update never reloads midgame, saves on acceptance, and precaches updated shell', async ({
    page,
    request,
    context,
  }) => {
    const origin = 'http://127.0.0.1:4174';
    await request.post(`${origin}/__release?version=1`);
    await page.goto(`${origin}/mathogram/`);
    await expect(page.getByText('Ready for offline play')).toBeVisible();
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mathogram.progress')!),
    );
    await page
      .getByRole('textbox')
      .fill(String(state.attempts.fish.queue[0].equation.c));
    await page.getByRole('textbox').press('Enter');
    const before = await page.evaluate(() =>
      localStorage.getItem('mathogram.progress'),
    );
    await request.post(`${origin}/__release?version=2`);
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(
      page.getByRole('button', { name: 'Save & update' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Sunny fish' }),
    ).toBeVisible();
    expect(await page.locator('meta[name="mathogram-release"]').count()).toBe(
      0,
    );
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.getByTestId('equation')).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Save & update' }).click();
    await expect(
      page.locator('meta[name="mathogram-release"]'),
    ).toHaveAttribute('content', '2');
    expect(
      await page.evaluate(() => localStorage.getItem('mathogram.progress')),
    ).toBe(before);
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.locator('meta[name="mathogram-release"]'),
    ).toHaveAttribute('content', '2');
    await page.getByRole('button', { name: /Sunny fish/ }).click();
    await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
    await expect(page.getByTestId('equation')).toBeVisible();
    await context.setOffline(false);
    await request.post(`${origin}/__release?version=1`);
  });
});
