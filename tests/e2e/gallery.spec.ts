import { expect } from '@playwright/test';
import { test } from './helpers';
import { puzzles } from '../../src/content/animals';
import { createAttempt } from '../../src/domain/game';
import { emptyProgress, STORAGE_KEY } from '../../src/storage/progress';
import { messages } from '../../src/i18n';

for (const language of ['en', 'cs'] as const) {
  test(`gallery filters, short advanced play and artwork fit phones (${language})`, async ({
    page,
  }) => {
    const t = messages[language];
    await page.addInitScript(
      ({ key, progress }) =>
        localStorage.setItem(key, JSON.stringify(progress)),
      { key: STORAGE_KEY, progress: emptyProgress(language) },
    );
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('./');
    await page
      .getByRole('combobox', { name: t.difficulty, exact: true })
      .selectOption('advanced');
    await page
      .getByRole('combobox', { name: t.length, exact: true })
      .selectOption('small');
    await expect(page.locator('.picture-card')).toHaveCount(2);
    await expect(page.getByText(`${t.matchingPictures}: 2 / 29`)).toBeVisible();
    await page.getByRole('button', { name: new RegExp(t.rocket) }).click();
    await expect(page.getByTestId('equation')).toHaveText(
      /^\d+ [+−] \d+ [+−] \d+$/,
    );
    await page.getByRole('button', { name: t.gallery, exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: t.difficulty, exact: true }),
    ).toHaveValue('advanced');
    await page
      .getByRole('combobox', { name: t.difficulty, exact: true })
      .selectOption('standard');
    await expect(page.locator('.picture-card')).toHaveCount(0);
    await expect(page.getByText(t.noPictures)).toBeVisible();
    await page.getByRole('button', { name: t.clearFilters }).click();
    await expect(page.locator('.picture-card')).toHaveCount(29);
    const counts = await page.locator('.card-exercises').allTextContents();
    const lengths = counts.map((count) => Number(count.split(' ')[0]));
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const fits = await page.locator('.card-art').evaluateAll((elements) =>
      elements.every((art) => {
        const bounds = art.getBoundingClientRect();
        const image = art.querySelector('svg')!.getBoundingClientRect();
        return (
          image.left >= bounds.left &&
          image.right <= bounds.right &&
          image.top >= bounds.top &&
          image.bottom <= bounds.bottom
        );
      }),
    );
    expect(fits).toBe(true);
  });
}

for (const language of ['en', 'cs'] as const) {
  for (const hasProgress of [false, true]) {
    test(`gallery backgrounds fill every artwork area (${language}, ${hasProgress ? 'saved' : 'new'})`, async ({
      page,
    }) => {
      const progress = emptyProgress(language);
      if (hasProgress) {
        const puzzle = puzzles[0]!;
        const attempt = createAttempt(puzzle);
        attempt.solved = [attempt.queue[0]!.pixelId];
        progress.attempts[puzzle.id] = attempt;
      }
      await page.addInitScript(
        ({ key, progress }) =>
          localStorage.setItem(key, JSON.stringify(progress)),
        { key: STORAGE_KEY, progress },
      );
      await page.goto('./');
      const cards = page.locator('.picture-card');
      await expect(cards).toHaveCount(puzzles.length);
      await expect(cards.locator('progress')).toHaveCount(hasProgress ? 1 : 0);

      for (const width of [1280, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const layouts = await cards.evaluateAll((elements) =>
          elements.map((card) => {
            const art = card.querySelector('.card-art')!;
            const halo = card.querySelector('.art-halo')!;
            const bounds = card.getBoundingClientRect();
            const artBounds = art.getBoundingClientRect();
            const style = getComputedStyle(card);
            return {
              name: card.getAttribute('aria-label'),
              background: getComputedStyle(art).backgroundColor,
              halo: getComputedStyle(halo).backgroundColor,
              cardBackground: style.backgroundColor,
              topGap:
                artBounds.top - bounds.top - parseFloat(style.borderTopWidth),
              leftGap:
                artBounds.left -
                bounds.left -
                parseFloat(style.borderLeftWidth),
              rightGap:
                bounds.right -
                artBounds.right -
                parseFloat(style.borderRightWidth),
              height: artBounds.height,
            };
          }),
        );
        for (const layout of layouts) {
          const context = `${layout.name} at ${width}px`;
          expect(layout.background, context).not.toBe('rgba(0, 0, 0, 0)');
          expect(layout.background, context).not.toBe(layout.cardBackground);
          expect(layout.halo, context).not.toBe('rgba(0, 0, 0, 0)');
          expect(Math.abs(layout.topGap), context).toBeLessThan(1);
          expect(Math.abs(layout.leftGap), context).toBeLessThan(1);
          expect(Math.abs(layout.rightGap), context).toBeLessThan(1);
          expect(layout.height, context).toBe(
            width <= 360 ? 125 : width <= 700 ? 145 : 162,
          );
        }
      }
    });
  }
}
