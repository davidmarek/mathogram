import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Progress } from '../../src/storage/progress';
import { currentExercise } from '../../src/domain/game';
import { messages } from '../../src/i18n';
import {
  analyticsEndpoint,
  analyticsExpected,
  answerEquation,
  test,
} from './helpers';

async function saved(page: Page): Promise<Progress> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('mathogram.progress')!),
  );
}

test('complete introductory animal, retry, repeat guard, reload, resume and replay', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  const initial = (await saved(page)).attempts.fish!;
  await page.getByRole('textbox').fill('99');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: messages.en.range }),
  ).toBeVisible();
  const afterRange = (await saved(page)).attempts.fish!;
  expect(afterRange.solved).toEqual([]);
  expect(afterRange.queue.at(-1)).toEqual(initial.queue[0]);
  const missed = currentExercise(afterRange)!;
  await expect(page.getByRole('textbox')).toBeEditable();
  await page.getByRole('textbox').fill(missed.equation.c === 1 ? '2' : '1');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByText(messages.en.retry)).toBeVisible();
  const deferred = (await saved(page)).attempts.fish!;
  expect(deferred.solved).toEqual([]);
  expect(deferred.queue.at(-1)).toEqual(missed);
  const next = currentExercise(deferred)!;
  expect(next.pixelId).not.toBe(missed.pixelId);
  await answerEquation(page, true);
  await page.keyboard.press('Enter');
  expect((await saved(page)).attempts.fish!.solved).toHaveLength(1);
  await expect(page.getByTestId(`cell-${next.pixelId}`)).toHaveAttribute(
    'data-filled',
    'true',
  );
  await page.reload();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  expect((await saved(page)).attempts.fish!.queue).toEqual(deferred.queue);
  expect((await saved(page)).attempts.fish!.solved).toHaveLength(1);
  for (let index = 1; index < initial.queue.length; index++)
    await answerEquation(page, index % 2 === 0);
  await expect(
    page.getByRole('heading', { name: 'Look who you found!' }),
  ).toBeFocused();
  expect((await saved(page)).completed).toContain('fish');
  await page.getByRole('button', { name: 'Play again' }).click();
  expect((await saved(page)).attempts.fish!.solved).toEqual([]);
  expect((await saved(page)).completed).toContain('fish');
});

test('row hints are optional, accessible, translated and remembered after reopening', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await expect(page.locator('.row-pill')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  const hints = page.getByRole('checkbox', { name: 'Show row hints' });
  await expect(hints).toBeChecked();
  const label = hints.locator('..');
  expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await hints.uncheck();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: 'Back to play' }).click();
  await expect(
    page.locator('.row-pill, .active-row, .active-row-label'),
  ).toHaveCount(0);
  await expect(page.getByTestId('pixel-grid')).not.toHaveAccessibleName(/Row /);
  await answerEquation(page);
  await page.reload();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await expect(
    page.locator('.row-pill, .active-row, .active-row-label'),
  ).toHaveCount(0);
  expect((await saved(page)).showRowHints).toBe(false);
  await page.getByRole('button', { name: 'Language: Čeština' }).click();
  await page.getByRole('button', { name: 'Nastavení' }).click();
  const translated = page.getByRole('checkbox', {
    name: 'Zobrazovat nápovědu řádku',
  });
  await expect(translated).not.toBeChecked();
  await translated.check();
  await page.getByRole('button', { name: 'Zpátky ke hře' }).click();
  await expect(page.locator('.row-pill')).toBeVisible();
  expect((await saved(page)).showRowHints).toBe(true);
});

test('last missed pixel returns after a saved practice exercise without filling twice', async ({
  page,
}) => {
  await page.goto('./');
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
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  const before = (await saved(page)).attempts.fish!;
  const last = currentExercise(before)!;
  await page.getByRole('textbox').fill(last.equation.c === 1 ? '2' : '1');
  await page.getByRole('textbox').press('Enter');
  await expect(
    page.getByText('A LITTLE PRACTICE', { exact: true }),
  ).toBeVisible();
  const practice = (await saved(page)).attempts.fish!;
  expect(practice.solved).toEqual(before.solved);
  expect(practice.reviewPixelId).toBeDefined();
  await page.reload();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  expect((await saved(page)).attempts.fish).toEqual(practice);
  await expect(page.locator('.row-pill, .active-row')).toHaveCount(0);
  await answerEquation(page);
  await expect(page.getByText(messages.en.practiceCorrect)).toBeVisible();
  expect((await saved(page)).attempts.fish!.solved).toEqual(before.solved);
  expect((await saved(page)).completed).toEqual([]);
  await answerEquation(page);
  await expect(
    page.getByRole('heading', { name: 'Look who you found!' }),
  ).toBeVisible();
  expect((await saved(page)).attempts.fish!.solved).toHaveLength(
    before.queue.length,
  );
});

test('later animal reveals columns above ten and keeps other attempts on confirmed restart', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await answerEquation(page);
  const fish = (await saved(page)).attempts.fish;
  await page.getByRole('button', { name: 'My animals', exact: true }).click();
  await page.getByRole('button', { name: /Twilight owl/ }).click();
  let aboveTen = false;
  const count = (await saved(page)).attempts.owl!.queue.length;
  for (let index = 0; index < count && !aboveTen; index++) {
    aboveTen = (await answerEquation(page)) > 10;
  }
  expect(aboveTen).toBe(true);
  const before = (await saved(page)).attempts.owl!;
  const last = before.solved.at(-1)!;
  expect(Number(last.split(':')[1])).toBeGreaterThan(10);
  await expect(page.getByTestId(`cell-${last}`)).toHaveAttribute(
    'data-filled',
    'true',
  );
  await page.getByRole('button', { name: 'Restart this picture' }).click();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  expect((await saved(page)).attempts.owl).toEqual(before);
  await page.getByRole('button', { name: 'Restart this picture' }).click();
  await page.getByRole('button', { name: 'Yes, start over' }).click();
  expect((await saved(page)).attempts.owl!.solved).toEqual([]);
  expect((await saved(page)).attempts.fish).toEqual(fish);
});

test('Czech detection, translated help, focus trapping, recovery and isolated reset', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'cs-CZ' });
  await context.route(analyticsEndpoint, (route) => route.abort());
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/mathogram/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await page.evaluate(() => {
    localStorage.setItem('other-project', 'untouched');
    localStorage.setItem(
      'mathogram.progress',
      JSON.stringify({
        version: 1,
        language: 'cs',
        attempts: { fish: {} },
        completed: ['cat'],
      }),
    );
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    'Některá data nešla přečíst',
  );
  await page.getByRole('button', { name: 'Nápověda' }).click();
  await expect(page.getByRole('dialog', { name: 'Nápověda' })).toBeVisible();
  await expect(page.getByText(/Otevřít jako webovou aplikaci/)).toBeVisible();
  await page.getByRole('button', { name: 'Zpátky ke hře' }).focus();
  await page.keyboard.press('Tab');
  expect(
    await page
      .getByRole('dialog')
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nápověda' })).toBeFocused();
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await expect(page.getByRole('dialog', { name: 'Nastavení' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Smazat všechna moje zvířátka' })
    .click();
  await page.getByRole('button', { name: 'Ano, začít znovu' }).click();
  expect((await saved(page)).completed).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('other-project'))).toBe(
    'untouched',
  );
  await page.getByRole('button', { name: 'Jazyk: English' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await context.close();
});

for (const [name, width, height] of [
  ['narrow phone', 320, 568],
  ['phone portrait', 390, 844],
  ['phone landscape', 844, 390],
  ['iPad portrait', 768, 1024],
  ['iPad landscape', 1024, 768],
  ['iPad split', 375, 1024],
] as const) {
  test(`responsive touch layout and accessibility: ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    if (width === 390 || width === 1024)
      await page.screenshot({
        path: test.info().outputPath('gallery.png'),
        fullPage: true,
      });
    if (width === 390) {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
    await page.getByRole('button', { name: 'Language: Čeština' }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: /Soumračná sovička/ }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const controls = page.locator(
      '.keypad button, .check-button, .header-actions button, .back-button',
    );
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page
      .getByRole('button', { name: 'Ověřit', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Ověřit', exact: true }),
    ).toBeInViewport();
    if (width === 390 || width === 1024) {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
    for (const name of [messages.cs.settings, messages.cs.help]) {
      const opener = page.getByRole('button', { name, exact: true });
      await expect(opener).toHaveText(new RegExp(name));
      await opener.click();
      const dialog = page.getByRole('dialog', { name, exact: true });
      await expect(dialog).toBeVisible();
      if (name === messages.cs.settings) {
        await expect(dialog.getByRole('checkbox')).toBeVisible();
        await expect(dialog.getByText(messages.cs.howBody)).toHaveCount(0);
      } else {
        await expect(dialog.getByText(messages.cs.howBody)).toBeVisible();
        await expect(dialog.getByRole('checkbox')).toHaveCount(0);
        await expect(
          dialog.getByRole('button', { name: messages.cs.resetAll }),
        ).toHaveCount(0);
      }
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width === 390) {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      }
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    }
    await page.screenshot({
      path: test.info().outputPath(`${name}.png`),
      fullPage: true,
    });
  });
}

test('production subpath serves local assets and only configured analytics without errors', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/'))
      external.push(request.url());
  });
  await page.goto('./');
  const manifestURL = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href');
  await expect(page.getByText('Ready for offline play')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save & update' })).toHaveCount(
    0,
  );
  expect(manifestURL).toBe('/mathogram/manifest.webmanifest');
  const response = await request.get(manifestURL!);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: '/mathogram/',
    start_url: '/mathogram/',
    scope: '/mathogram/',
    display: 'standalone',
  });
  for (const icon of manifest.icons) {
    const response = await request.get(`/mathogram/${icon.src}`);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]));
    expect(png.readUInt32BE(20)).toBe(Number(icon.sizes.split('x')[1]));
  }
  const apple = await request.get('/mathogram/icons/apple-touch-icon.png');
  expect((await apple.body()).readUInt32BE(16)).toBe(180);
  expect(external).toEqual(analyticsExpected ? [analyticsEndpoint] : []);
  expect(errors).toEqual([]);
});
