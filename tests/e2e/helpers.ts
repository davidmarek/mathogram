import { expect, test as base } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

const configuredEndpoint = URL.canParse(process.env.VITE_UMAMI_ENDPOINT ?? '')
  ? new URL(process.env.VITE_UMAMI_ENDPOINT!)
  : undefined;
export const analyticsEndpoint =
  configuredEndpoint?.href ?? 'https://cloud.umami.is/api/send';
export const analyticsExpected =
  process.env.VITE_ANALYTICS_ENABLED === 'true' &&
  configuredEndpoint?.protocol === 'https:' &&
  !configuredEndpoint.username &&
  !configuredEndpoint.password &&
  !configuredEndpoint.search &&
  !configuredEndpoint.hash &&
  configuredEndpoint.pathname.endsWith('/api/send') &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    process.env.VITE_UMAMI_WEBSITE_ID ?? '',
  );

export const test = base.extend<{ analyticsRequests: Request[] }>({
  analyticsRequests: [
    async ({ context, browserName, serviceWorkers }, use) => {
      const requests: Request[] = [];
      // WebKit worker-controlled fetches can bypass Playwright routing.
      // Dedicated analytics tests block workers; other WebKit tests opt out.
      if (browserName === 'webkit' && serviceWorkers !== 'block') {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
        });
      }
      // Never send acceptance-test traffic to the real analytics service.
      await context.route(analyticsEndpoint, async (route) => {
        if (route.request().method() === 'POST') requests.push(route.request());
        await route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
          body: '{}',
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
  const match = /^(\d+) ([+−]) (\d+)(?: ([+−]) (\d+))?$/.exec(text);
  expect(match).not.toBeNull();
  let result =
    match![2] === '+'
      ? Number(match![1]) + Number(match![3])
      : Number(match![1]) - Number(match![3]);
  if (match![4]) {
    result =
      match![4] === '+'
        ? result + Number(match![5])
        : result - Number(match![5]);
  }
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
