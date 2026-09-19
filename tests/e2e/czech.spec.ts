import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './helpers';
import { czechWords } from '../../src/content/czechWords';

test.use({ serviceWorkers: 'block' });

// Synthetic silence exercises browser media decoding/events, not pronunciation.
function recording(): Buffer {
  const samples = 2400;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24000, 24);
  buffer.writeUInt32LE(48000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

test('Czech dictation requires listening and accents, saves separately and fits a narrow screen', async ({
  page,
  browserName,
}) => {
  if (browserName === 'webkit' && process.platform === 'win32') {
    test.info().annotations.push({
      type: 'media limitation',
      description:
        'Windows WebKit rejects even a standalone PCM WAV with NotSupportedError. Playback events are mocked here; Chromium uses native decoding. Verify real MP3s on Safari before release.',
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Audio', {
        value: class {
          src = '';
          playbackRate = 1;
          onplaying: (() => void) | null = null;
          onended: (() => void) | null = null;
          onerror: (() => void) | null = null;
          timer?: ReturnType<typeof setTimeout>;
          play() {
            this.onplaying?.();
            this.timer = setTimeout(() => this.onended?.(), 100);
            return Promise.resolve();
          }
          pause() {
            clearTimeout(this.timer);
          }
        },
      });
    });
  }
  await page.route('**/audio/cs/v2/*.mp3', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: recording() }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page
    .getByRole('button', { name: 'Czech spelling', exact: true })
    .click();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('mathogram.progress')!);
    progress.czech.attempts.fish.queue[0].wordId = 'cs-005';
    localStorage.setItem('mathogram.progress', JSON.stringify(progress));
  });
  await page.reload();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  const savedWord = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('mathogram.progress')!);
    return progress.czech.attempts.fish.queue[0].wordId as string;
  });
  const word = czechWords.find(({ id }) => id === savedWord)!.text;
  const answer = page.getByRole('textbox', { name: 'The word you heard' });
  await answer.fill(word);
  await expect(
    page.getByRole('button', { name: 'Check', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Listen again', exact: true }),
  ).toBeEnabled();
  const withoutAccents = word.normalize('NFD').replace(/\p{M}/gu, '');
  expect(withoutAccents).not.toBe(word);
  await answer.fill(withoutAccents);
  await answer.press('Enter');
  await expect(page.getByText(/Not quite. Listen again/)).toBeVisible();
  await answer.fill(word);
  await answer.press('Enter');
  await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Check', exact: true }),
  ).toBeDisabled();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Math', exact: true }).click();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await expect(page.getByTestId('equation')).toBeVisible();
  await expect(page.locator('[data-filled="true"]')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Czech spelling', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Czech spelling', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
});

test('missing audio shows a recoverable error without revealing a pixel', async ({
  page,
}) => {
  await page.route('**/audio/cs/v2/*.mp3', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('./');
  await page
    .getByRole('button', { name: 'Czech spelling', exact: true })
    .click();
  await page.getByRole('button', { name: /Sunny fish/ }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.locator('.audio-status[role="alert"]')).toContainText(
    'The recording could not be played',
  );
  await expect(
    page.getByRole('button', { name: 'Listen', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Check', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('[data-filled="true"]')).toHaveCount(0);
});
