import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test, answerEquation } from './helpers';
import { messages } from '../../src/i18n';
import { STORAGE_KEY, emptyProgress } from '../../src/storage/progress';
import { puzzles } from '../../src/content/animals';
import { createAttempt } from '../../src/domain/game';

for (const language of ['en', 'cs'] as const) {
  test(`appearance follows the system and remembers overrides (${language})`, async ({
    page,
  }) => {
    const t = messages[language];
    await page.addInitScript(
      ({ key, progress }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(progress));
      },
      { key: STORAGE_KEY, progress: emptyProgress(language) },
    );
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('./');
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    expect(
      await root.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe('rgb(28, 37, 40)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#1c2528',
    );
    const colors = await page
      .locator('.card-art svg rect')
      .evaluateAll((pixels) =>
        pixels.map((pixel) => pixel.getAttribute('fill')),
      );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: t.settings, exact: true }).click();
    const appearance = page.getByRole('combobox', { name: t.appearance });
    await expect(appearance).toHaveValue('system');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await appearance.selectOption('light');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: t.close }).click();
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: t.settings, exact: true }).click();
    await appearance.selectOption('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await appearance.selectOption('system');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: t.close }).click();
    expect(
      await page
        .locator('.card-art svg rect')
        .evaluateAll((pixels) =>
          pixels.map((pixel) => pixel.getAttribute('fill')),
        ),
    ).toEqual(colors);
  });
}

test('dark gameplay, feedback and completion retain progress and artwork', async ({
  page,
}) => {
  const puzzle = puzzles[0]!;
  const progress = emptyProgress('en');
  progress.theme = 'dark';
  const attempt = createAttempt(puzzle);
  attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
  progress.attempts[puzzle.id] = attempt;
  await page.addInitScript(
    ({ key, progress }) => localStorage.setItem(key, JSON.stringify(progress)),
    { key: STORAGE_KEY, progress },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await expect(page.getByTestId('equation')).toHaveText(
    `${attempt.queue.at(-1)!.equation.a} ${attempt.queue.at(-1)!.equation.op === '+' ? '+' : '−'} ${attempt.queue.at(-1)!.equation.b}`,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('textbox').fill('99');
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('.feedback')).not.toBeEmpty();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Practice comes before the final pixel after a wrong answer.
  await answerEquation(page);
  await answerEquation(page);
  await expect(page.locator('.completion')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page
      .locator('.celebration-art svg rect')
      .evaluateAll((pixels) =>
        pixels.map((pixel) => pixel.getAttribute('fill')),
      ),
  ).toEqual(puzzle.pixels.map((pixel) => puzzle.palette[pixel.color]));
});
