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
      await expect(page.locator('.brand')).toHaveText('Mathixel');
      await expect(page.locator('.brand-icon')).toHaveCount(0);
      for (const width of [1280, 900, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('.park-creature')).toHaveCount(5);
        await expect(page.locator('.park-caption')).toHaveCount(0);
        const titleLines = await page
          .locator('.hero h1')
          .evaluate((heading) => {
            const range = document.createRange();
            range.selectNodeContents(heading);
            return range.getClientRects().length;
          });
        expect(titleLines).toBeLessThanOrEqual(3);
        const geometry = await page
          .locator('.picture-card')
          .evaluateAll((cards) =>
            cards.every((card) => {
              const style = getComputedStyle(card);
              const art = getComputedStyle(card.querySelector('.card-art')!);
              return (
                [
                  style.borderTopLeftRadius,
                  style.borderTopRightRadius,
                  style.borderBottomLeftRadius,
                  style.borderBottomRightRadius,
                ].every((radius) => radius === '20px') &&
                [
                  art.borderTopLeftRadius,
                  art.borderTopRightRadius,
                  art.borderBottomLeftRadius,
                  art.borderBottomRightRadius,
                ].every((radius) => radius === '0px')
              );
            }),
          );
        expect(geometry).toBe(true);
        const centered = await page
          .locator('.card-action-icon')
          .evaluateAll((icons) =>
            icons.every((icon) => {
              const circle = icon.getBoundingClientRect();
              const svg = icon.querySelector('svg')!.getBoundingClientRect();
              return (
                Math.abs(svg.x + svg.width / 2 - circle.x - circle.width / 2) <
                  1 &&
                Math.abs(
                  svg.y + svg.height / 2 - circle.y - circle.height / 2,
                ) < 1
              );
            }),
          );
        expect(centered).toBe(true);
        const centeredArtwork = await page
          .locator('.card-art svg')
          .evaluateAll((images) =>
            images.every((image) => {
              const svg = image as SVGSVGElement;
              const art = svg.getBBox();
              const frame = svg.viewBox.baseVal;
              return (
                Math.abs(art.x + art.width / 2 - frame.x - frame.width / 2) <
                  0.01 &&
                Math.abs(art.y + art.height / 2 - frame.y - frame.height / 2) <
                  0.01 &&
                art.x >= frame.x &&
                art.y >= frame.y &&
                art.x + art.width <= frame.x + frame.width &&
                art.y + art.height <= frame.y + frame.height
              );
            }),
          );
        expect(centeredArtwork).toBe(true);
        await expect(
          page.locator('.picture-butterfly .card-action > span:first-child'),
        ).toHaveClass('sr-only');
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
        const panelStyle = await page
          .locator('.picture-panel')
          .evaluate((panel) => {
            const style = getComputedStyle(panel);
            return {
              background: style.backgroundColor,
              radius: style.borderRadius,
              padding: style.padding,
            };
          });
        expect(panelStyle).toEqual({
          background: 'rgba(0, 0, 0, 0)',
          radius: '0px',
          padding: '0px',
        });
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
