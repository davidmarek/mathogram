import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { installAudioMock, recordings } from './test/audio';
import { emptyProgress, STORAGE_KEY } from './storage/progress';
import type { Progress } from './storage/progress';
import { createAttempt } from './domain/game';
import { createSpellingAttempt, currentWord } from './domain/spelling';
import { puzzles } from './content/animals';
import { czechWordById } from './content/czechWords';

vi.mock('./pwa/usePwa', () => ({
  usePwa: () => ({
    ready: false,
    waiting: false,
    error: false,
    offline: false,
  }),
}));
const trackPuzzle = vi.hoisted(() => vi.fn());
vi.mock('./analytics', () => ({
  analyticsEnabled: false,
  analyticsAllowed: () => false,
  trackPuzzle,
}));

beforeEach(() => {
  localStorage.clear();
  installAudioMock();
  trackPuzzle.mockClear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en']);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function saved(): Progress {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!);
}
function switchToCzech() {
  fireEvent.click(screen.getByRole('button', { name: 'Czech spelling' }));
}
function openFish() {
  fireEvent.click(screen.getByRole('button', { name: /Sunny fish/ }));
}
async function listen() {
  fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
  await act(async () => {});
  act(() => recordings.at(-1)!.onended?.());
}
function answer(text: string) {
  fireEvent.change(
    screen.getByRole('textbox', { name: 'The word you heard' }),
    { target: { value: text } },
  );
}
function check() {
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}
function word() {
  return czechWordById.get(currentWord(saved().czech!.attempts.fish!)!.wordId)!
    .text;
}

it('separates subject from interface language and preserves math progress across spelling, switching and reload', async () => {
  const progress = {
    ...emptyProgress('en'),
    attempts: { fish: createAttempt(puzzles[0]!, () => 0) },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  const view = render(<App />);
  switchToCzech();
  expect(
    screen.queryByRole('heading', { name: 'Advanced' }),
  ).not.toBeInTheDocument();
  openFish();
  const expected = word();
  expect(screen.queryByTestId('equation')).not.toBeInTheDocument();
  expect(screen.queryByText(expected, { exact: true })).not.toBeInTheDocument();
  answer(expected);
  expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
  expect(saved().czech!.attempts.fish!.solved).toHaveLength(0);
  await listen();
  answer('wrong');
  check();
  expect(screen.getByText(/Not quite. Listen again/)).toBeInTheDocument();
  expect(saved().czech!.attempts.fish!.solved).toHaveLength(0);
  answer(expected.toUpperCase());
  check();
  check();
  expect(saved().czech!.attempts.fish!.solved).toHaveLength(1);
  expect(saved().attempts).toEqual(progress.attempts);
  expect(trackPuzzle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Math' }));
  openFish();
  expect(screen.getByTestId('equation')).toBeInTheDocument();
  switchToCzech();
  view.unmount();
  render(<App />);
  expect(
    screen.getByRole('button', { name: 'Czech spelling' }),
  ).toHaveAttribute('aria-pressed', 'true');
  openFish();
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(saved().czech!.attempts.fish!.solved).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }));
  expect(screen.getByRole('button', { name: 'Český jazyk' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    screen.getByRole('textbox', { name: 'Slovo, které jsi slyšel' }),
  ).toHaveAttribute('lang', 'cs');
});

it('reports missing recordings and stops audio when opening help or switching subjects', () => {
  render(<App />);
  switchToCzech();
  openFish();
  fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
  act(() => recordings[0]!.onerror?.());
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The recording could not be played',
  );
  expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  expect(recordings[1]!.pause).toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'One word, one little pixel',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Back to play' }));
  fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Math' }));
  expect(recordings[2]!.pause).toHaveBeenCalled();
});

it('inserts an accent at the selection instead of replacing or appending the whole answer', () => {
  render(<App />);
  switchToCzech();
  openFish();
  answer('mama');
  const field = screen.getByRole<HTMLInputElement>('textbox');
  field.setSelectionRange(1, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Insert letter á' }));
  expect(field).toHaveValue('máma');
  expect(field).toHaveFocus();
});

it('completes and replays only Czech pictures; confirmed resets clear both collections', async () => {
  const attempt = createSpellingAttempt(puzzles[0]!, () => 0);
  attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
  const progress: Progress = {
    ...emptyProgress('en'),
    subject: 'czech',
    attempts: { fish: createAttempt(puzzles[0]!, () => 0) },
    czech: { attempts: { fish: attempt }, completed: [] },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  render(<App />);
  openFish();
  await listen();
  answer(word());
  check();
  expect(
    screen.getByRole('heading', { name: 'Look what you found!' }),
  ).toHaveFocus();
  expect(saved().czech!.completed).toEqual(['fish']);
  expect(saved().completed).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
  expect(saved().czech!.attempts.fish!.solved).toEqual([]);
  expect(saved().czech!.completed).toEqual(['fish']);
  fireEvent.click(screen.getByRole('button', { name: 'Restart this picture' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Keep playing',
    }),
  );
  expect(saved().attempts).toEqual(progress.attempts);
  fireEvent.click(screen.getByRole('button', { name: 'Restart this picture' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
  expect(saved().czech!.completed).toEqual(['fish']);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset all my pictures' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
  expect(saved()).toEqual({ ...emptyProgress('en'), subject: 'czech' });
});
