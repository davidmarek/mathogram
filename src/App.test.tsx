import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { puzzles } from './content/animals';
import { createAttempt } from './domain/game';
import { emptyProgress, STORAGE_KEY } from './storage/progress';
import type { Progress } from './storage/progress';
import { detectLanguage, messages } from './i18n';

const pwa = vi.hoisted(() => ({
  ready: false,
  waiting: false,
  error: false,
  offline: false,
  acceptUpdate: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  retry: vi.fn(),
}));
vi.mock('./pwa/usePwa', () => ({ usePwa: () => pwa }));

function saved(): Progress {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!);
}
function firstAnswer(): string {
  const attempt = saved().attempts.fish!;
  return String(attempt.queue[attempt.solved.length]!.equation.c);
}
function openFish() {
  fireEvent.click(screen.getByRole('button', { name: /Sunny fish/ }));
}
function enter(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), {
    target: { value },
  });
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Math, 'random').mockReturnValue(0.4);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
    })),
  );
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  pwa.ready = pwa.waiting = pwa.error = pwa.offline = false;
  pwa.acceptUpdate.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('bilingual gallery and settings', () => {
  it('offers all six animals without locks and switches every translation', () => {
    render(<App />);
    for (const puzzle of puzzles)
      expect(
        screen.getByRole('button', {
          name: new RegExp(messages.en[puzzle.name]),
        }),
      ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }));
    expect(document.documentElement.lang).toBe('cs');
    expect(saved().language).toBe('cs');
    expect(
      screen.getByRole('heading', { name: 'Koho dnes objevíš?' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Slunečná rybka/ }));
    expect(
      screen.getByRole('textbox', { name: 'Tvůj výsledek' }),
    ).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Ověřit' })).toBeDisabled();
  });
  it('detects Czech device languages and respects saved English', () => {
    expect(detectLanguage(['sk', 'cs-CZ'])).toBe('cs');
    expect(detectLanguage(['csb', 'en'])).toBe('en');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['cs-CZ']);
    const view = render(<App />);
    expect(document.documentElement.lang).toBe('cs');
    view.unmount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyProgress('en')));
    render(<App />);
    expect(document.documentElement.lang).toBe('en');
  });
  it('explains installation and storage and requires confirmation for resets', () => {
    localStorage.setItem('another-app', 'safe');
    render(<App />);
    openFish();
    enter(firstAnswer());
    submit();
    const before = saved();
    fireEvent.click(screen.getByRole('button', { name: 'Help & settings' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(/Turn on Open as Web App/)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset all my animals' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(saved()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Help & settings' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset all my animals' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(saved()).toEqual(emptyProgress('en'));
    expect(localStorage.getItem('another-app')).toBe('safe');
  });
  it('hides installation instructions in standalone mode', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Help & settings' }));
    expect(screen.queryByText('Make yourself at home')).not.toBeInTheDocument();
  });
});

describe('pixel game', () => {
  it('normalizes two digits, handles empty/range/wrong answers without changing progress', () => {
    render(<App />);
    openFish();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    enter('009');
    expect(screen.getByRole('textbox')).toHaveValue('0');
    submit();
    expect(screen.getByText('Try a number from 1 to 20.')).toBeVisible();
    enter('99');
    submit();
    expect(saved().attempts.fish!.solved).toEqual([]);
    enter(firstAnswer() === '1' ? '2' : '1');
    submit();
    expect(screen.getByText('Not quite. Give it another try!')).toBeVisible();
    expect(saved().attempts.fish!.solved).toEqual([]);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
  it('saves and fills exactly the answer coordinate before animation, with repeat protection', () => {
    vi.useFakeTimers();
    render(<App />);
    openFish();
    const before = saved().attempts.fish!;
    const expected = before.queue[0]!;
    const displayedEquation = screen.getByTestId('equation').textContent;
    enter(firstAnswer());
    submit();
    submit();
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      repeat: true,
    });
    expect(saved().attempts.fish!.solved).toEqual([expected.pixelId]);
    expect(screen.getByTestId(`cell-${expected.pixelId}`)).toHaveAttribute(
      'data-filled',
      'true',
    );
    expect(document.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
    expect(screen.getByTestId('equation').textContent).toBe(displayedEquation);
    expect(screen.getByRole('textbox')).toHaveValue(
      String(expected.equation.c),
    );
    expect(screen.getByText(/Lovely! A new pixel!/)).toHaveAttribute(
      'class',
      'feedback positive',
    );
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(saved().attempts.fish!.queue).toEqual(before.queue);
  });
  it('supports keypad, erase, and physical keyboard while a keypad button has focus', () => {
    render(<App />);
    openFish();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByRole('textbox')).toHaveValue('10');
    fireEvent.click(screen.getByRole('button', { name: 'Erase last digit' }));
    expect(screen.getByRole('textbox')).toHaveValue('1');
    fireEvent.keyDown(screen.getByRole('button', { name: '1' }), {
      key: 'Backspace',
    });
    for (const key of firstAnswer())
      fireEvent.keyDown(screen.getByRole('button', { name: '1' }), { key });
    fireEvent.keyDown(screen.getByRole('button', { name: '1' }), {
      key: 'Enter',
    });
    expect(saved().attempts.fish!.solved).toHaveLength(1);
  });
  it('keeps background and unsolved targets visually indistinguishable', () => {
    render(<App />);
    openFish();
    const target = puzzles[0]!.pixels[0]!;
    const targetCell = screen.getByTestId(`cell-${target.id}`);
    const backgroundCell = screen.getByTestId(`${'cell-'}${target.row}:1`);
    expect(targetCell.className).toBe(backgroundCell.className);
    expect(targetCell.getAttribute('style')).toBe(
      backgroundCell.getAttribute('style'),
    );
    expect(
      screen.getByTestId('pixel-grid').querySelectorAll('button'),
    ).toHaveLength(0);
  });
  it('preserves queue on navigation/reload and restarts only after confirmation', () => {
    render(<App />);
    openFish();
    enter(firstAnswer());
    submit();
    const before = saved();
    fireEvent.click(screen.getByRole('button', { name: 'My animals' }));
    openFish();
    expect(saved()).toEqual(before);
    fireEvent.click(
      screen.getByRole('button', { name: 'Restart this picture' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(saved()).toEqual(before);
    fireEvent.click(
      screen.getByRole('button', { name: 'Restart this picture' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(saved().attempts.fish!.solved).toEqual([]);
  });
  it('finishes the final pixel, focuses celebration, and replays with retained badge', () => {
    const progress = emptyProgress('en');
    const attempt = createAttempt(puzzles[0]!, () => 0.2);
    attempt.solved = attempt.queue.slice(0, -1).map((entry) => entry.pixelId);
    progress.attempts.fish = attempt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    render(<App />);
    openFish();
    enter(firstAnswer());
    submit();
    expect(
      screen.getByRole('heading', { name: 'Look who you found!' }),
    ).toHaveFocus();
    expect(saved().completed).toEqual(['fish']);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(saved().attempts.fish!.solved).toEqual([]);
    expect(saved().completed).toEqual(['fish']);
  });
});

describe('visible persistence and PWA failures', () => {
  it('reports corrupt progress while retaining independent valid data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...emptyProgress('cs'),
        attempts: { fish: {} },
        completed: ['cat'],
      }),
    );
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Některá data nešla přečíst',
    );
    expect(screen.getByText(/1 \/ 6/)).toBeVisible();
  });
  it('allows in-memory play but does not claim saving after quota failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    render(<App />);
    openFish();
    const equation = screen.getByTestId('equation').textContent!.split(' ');
    enter(
      String(
        equation[1] === '+'
          ? Number(equation[0]) + Number(equation[2])
          : Number(equation[0]) - Number(equation[2]),
      ),
    );
    submit();
    expect(document.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Progress cannot be saved',
    );
    expect(
      screen.queryByText('Every little step is saved here'),
    ).not.toBeInTheDocument();
  });
  it('handles denied localStorage access and blocks updates that cannot save', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    pwa.waiting = true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Save & update' }));
    expect(pwa.acceptUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/The update was not applied/)).toBeVisible();
  });
  it('never accepts an update until requested, and supports deferral to settings', () => {
    pwa.waiting = true;
    pwa.ready = true;
    render(<App />);
    openFish();
    expect(screen.getByText('Ready for offline play')).toBeVisible();
    expect(pwa.acceptUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(
      screen.queryByRole('button', { name: 'Save & update' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Help & settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & update' }));
    expect(pwa.acceptUpdate).toHaveBeenCalledOnce();
    expect(saved().attempts.fish).toBeDefined();
  });
  it('shows cache failures with a retry control', () => {
    pwa.error = true;
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry offline setup' }),
    );
    expect(pwa.retry).toHaveBeenCalled();
  });
});
