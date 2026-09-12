import { expect, test as base } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

export const analyticsEndpoint = 'https://plausible.io/api/event';
export const analyticsExpected =
  process.env.VITE_ANALYTICS_ENABLED === 'true' &&
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(
    process.env.VITE_PLAUSIBLE_DOMAIN ?? '',
  );

export const test = base.extend<{ analyticsRequests: Request[] }>({
  analyticsRequests: [
    async ({ context }, use) => {
      const requests: Request[] = [];
      // Never send acceptance-test traffic to the real analytics service.
      await context.route(analyticsEndpoint, async (route) => {
        requests.push(route.request());
        await route.fulfill({
          status: 202,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: '',
        });
      });
      await use(requests);
    },
    { auto: true },
  ],
});

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
