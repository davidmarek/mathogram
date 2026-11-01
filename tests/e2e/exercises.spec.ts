import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test, answerEquation } from './helpers';
import { messages } from '../../src/i18n';
import { STORAGE_KEY, emptyProgress } from '../../src/storage/progress';

for (const language of ['en', 'cs'] as const) {
  test(`exercise presets limit new pictures (${language})`, async ({
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
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('./');
    await page.getByRole('button', { name: t.settings, exact: true }).click();
    await page
      .getByRole('combobox', { name: t.exerciseMode })
      .selectOption('crossing');
    await page
      .getByRole('combobox', { name: t.numbersUpTo })
      .selectOption('12');
    await expect(
      page.getByRole('combobox', { name: t.operations }),
    ).toHaveValue('both');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: t.close }).click();

    await expect(
      page.getByRole('button', {
        name: `${t.dog} · ${t.needsNumbers} 13`,
      }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.reload();
    await page
      .getByRole('button', { name: new RegExp(`^${t.cat} · `) })
      .click();
    await expect(page.locator('.level-pill')).toHaveText(
      `${t.modeCrossing} · ${t.numbersUpTo} 12`,
    );
    for (let index = 0; index < 3; index += 1) {
      const text = await page.getByTestId('equation').innerText();
      const numbers = text.match(/\d+/g)!.map(Number);
      expect(numbers).toHaveLength(2);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(12);
      const result = await answerEquation(page);
      expect(result).toBeLessThanOrEqual(12);
    }
  });
}
