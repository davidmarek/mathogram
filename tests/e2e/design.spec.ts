import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test, answerEquation } from './helpers';
import { puzzles } from '../../src/content/animals';
import { createAttempt } from '../../src/domain/game';
import { emptyProgress, STORAGE_KEY } from '../../src/storage/progress';
import { messages } from '../../src/i18n';

for (const language of ['en', 'cs'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`picture park stays accessible and fits both layouts (${language}, ${theme})`, async ({
      page,
    }, testInfo) => {
      const t = messages[language];
      const puzzle = puzzles[0]!;
      const progress = emptyProgress(language);
      progress.theme = theme;
      const attempt = createAttempt(puzzle);
      attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
      progress.attempts[puzzle.id] = attempt;
      await page.addInitScript(
        ({ key, progress }) => {
          if (!localStorage.getItem(key))
            localStorage.setItem(key, JSON.stringify(progress));
        },
        { key: STORAGE_KEY, progress },
      );
      await page.goto('./');
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('.park-creature')).toHaveCount(3);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: testInfo.outputPath(`gallery-${width}.png`),
        });
      }
      await page.getByRole('link', { name: t.gallery, exact: true }).click();
      await expect(page.locator('#picture-collection')).toBeInViewport();
      await page
        .getByRole('button', { name: new RegExp(t[puzzle.name]) })
        .click();
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const keys = await page
          .locator('.keypad button')
          .evaluateAll((buttons) =>
            buttons.every((button) => {
              const bounds = button.getBoundingClientRect();
              return bounds.width >= 44 && bounds.height >= 44;
            }),
          );
        expect(keys).toBe(true);
        const coordinates = await page
          .locator('.axis')
          .evaluateAll((labels) =>
            labels.every(
              (label) => parseFloat(getComputedStyle(label).fontSize) >= 12,
            ),
          );
        expect(coordinates).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: testInfo.outputPath(`game-${width}.png`),
          fullPage: true,
        });
      }
      await answerEquation(page);
      await expect(page.locator('.completion')).toBeVisible();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: testInfo.outputPath(`completion-${width}.png`),
        });
      }
      await page.reload();
      await page
        .getByRole('button', { name: new RegExp(t[puzzle.name]) })
        .click();
      await expect(page.locator('.completion')).toBeVisible();
    });
  }
}
