import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function answerEquation(page: Page, keypad = false) {
  const answer = page.getByRole('textbox');
  await expect(answer).toBeEditable();
  const text = await page.getByTestId('equation').innerText();
  const match = /^(\d+) ([+−]) (\d+)$/.exec(text);
  expect(match).not.toBeNull();
  const result =
    match![2] === '+'
      ? Number(match![1]) + Number(match![3])
      : Number(match![1]) - Number(match![3]);
  if (keypad) {
    for (const digit of String(result))
      await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
  } else {
    await answer.fill(String(result));
    await answer.press('Enter');
  }
  return result;
}
