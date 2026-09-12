import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { puzzles } from './content/animals';
import { createAttempt, currentExercise } from './domain/game';
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
  return String(currentExercise(attempt)!.equation.c);
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
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('dialog', { name: 'Help' })).toBeVisible();
    expect(screen.getByText(/Turn on Open as Web App/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(screen.getByText(messages.en.storageBody)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset all my animals' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(saved()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.queryByText('Make yourself at home')).not.toBeInTheDocument();
  });
  it('persists row hints and hides the active row visually and from screen readers', () => {
    let view = render(<App />);
    openFish();
    expect(document.querySelector('.row-pill')).toBeVisible();
    expect(document.querySelector('.active-row')).toBeVisible();
    const before = saved().attempts.fish;
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const setting = screen.getByRole('checkbox', { name: 'Show row hints' });
    expect(setting).toBeChecked();
    fireEvent.click(setting);
    expect(saved().showRowHints).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back to play' }));
    expect(document.querySelector('.row-pill')).not.toBeInTheDocument();
    expect(document.querySelector('.active-row')).not.toBeInTheDocument();
    expect(document.querySelector('.active-row-label')).not.toBeInTheDocument();
    expect(screen.getByTestId('pixel-grid')).not.toHaveAccessibleName(/Row /);
    expect(document.querySelector('.row-label')).toBeVisible();
    view.unmount();
    view = render(<App />);
    openFish();
    expect(saved().attempts.fish).toEqual(before);
    expect(document.querySelector('.row-pill')).not.toBeInTheDocument();
    enter(firstAnswer());
    submit();
    expect(screen.getByText('Lovely! A new pixel!')).toBeVisible();
    expect(screen.queryByText(/Pixel revealed:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const translated = screen.getByRole('checkbox', {
      name: 'Zobrazovat nápovědu řádku',
    });
    expect(translated).not.toBeChecked();
    fireEvent.click(translated);
    fireEvent.click(screen.getByRole('button', { name: 'Zpátky ke hře' }));
    expect(document.querySelector('.row-pill')).toBeVisible();
    expect(document.querySelector('.active-row')).toBeVisible();
    view.unmount();
  });
  it('keeps settings focus when a deferred exercise finishes its feedback', () => {
    vi.useFakeTimers();
    render(<App />);
    openFish();
    enter(firstAnswer() === '1' ? '2' : '1');
    submit();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const setting = screen.getByRole('checkbox', { name: 'Show row hints' });
    act(() => setting.focus());
    act(() => vi.advanceTimersByTime(900));
    expect(setting).toHaveFocus();
  });
  it.each(['en', 'cs'] as const)(
    'separates labeled help and settings and restores their focus in %s',
    (language) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(emptyProgress(language)),
      );
      pwa.waiting = true;
      const t = messages[language];
      render(<App />);
      const helpButton = screen.getByRole('button', {
        name: t.help,
      });
      const settingsButton = screen.getByRole('button', {
        name: t.settings,
      });
      expect(helpButton).toHaveTextContent(t.help);
      expect(settingsButton).toHaveTextContent(t.settings);
      fireEvent.click(helpButton);
      const help = within(screen.getByRole('dialog', { name: t.help }));
      expect(help.getByText(t.howBody)).toBeVisible();
      expect(help.getByText(t.installBody)).toBeVisible();
      expect(help.getByText(t.offlineHelp)).toBeVisible();
      expect(help.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(help.queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        help.queryByRole('button', { name: t.resetAll }),
      ).not.toBeInTheDocument();
      expect(
        help.queryByRole('button', { name: t.update }),
      ).not.toBeInTheDocument();
      fireEvent.click(help.getByRole('button', { name: t.close }));
      expect(helpButton).toHaveFocus();
      fireEvent.click(settingsButton);
      const settings = within(screen.getByRole('dialog', { name: t.settings }));
      expect(settings.getByRole('combobox', { name: t.language })).toHaveValue(
        language,
      );
      expect(
        settings.getByRole('checkbox', { name: t.showRowHints }),
      ).toBeChecked();
      expect(settings.getByRole('button', { name: t.resetAll })).toBeVisible();
      expect(settings.getByRole('button', { name: t.update })).toBeVisible();
      expect(settings.queryByText(t.howBody)).not.toBeInTheDocument();
      expect(settings.queryByText(t.installBody)).not.toBeInTheDocument();
      fireEvent.click(settings.getByRole('button', { name: t.close }));
      expect(settingsButton).toHaveFocus();
    },
  );
  it('keeps local-data permission controls in settings, not help', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    vi.stubGlobal('navigator', {
      languages: ['en'],
      storage: { persist },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(
      screen.queryByRole('button', { name: 'Ask to keep local data' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Ask to keep local data' }),
      );
    });
    expect(persist).toHaveBeenCalledOnce();
    expect(screen.getByText(messages.en.notPersisted)).toBeVisible();
  });
});

describe('pixel game', () => {
  it('normalizes two digits and defers range/wrong answers without filling pixels', () => {
    vi.useFakeTimers();
    render(<App />);
    openFish();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    enter('009');
    expect(screen.getByRole('textbox')).toHaveValue('0');
    submit();
    expect(screen.getByText(messages.en.range)).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole('textbox')).toHaveValue('');
    enter('99');
    submit();
    expect(saved().attempts.fish!.solved).toEqual([]);
    act(() => vi.advanceTimersByTime(900));
    enter(firstAnswer() === '1' ? '2' : '1');
    submit();
    expect(screen.getByText(messages.en.retry)).toBeVisible();
    expect(saved().attempts.fish!.solved).toEqual([]);
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
  it('defers a missed pixel once, resumes the next exercise, and returns after the others', () => {
    vi.useFakeTimers();
    const progress = emptyProgress('en');
    const attempt = createAttempt(puzzles[0]!, () => 0.2);
    attempt.solved = attempt.queue.slice(0, -3).map(({ pixelId }) => pixelId);
    progress.attempts.fish = attempt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    const missed = currentExercise(attempt)!;
    let view = render(<App />);
    openFish();
    enter(missed.equation.c === 1 ? '2' : '1');
    submit();
    const deferred = saved().attempts.fish!;
    expect(deferred.solved).toEqual(attempt.solved);
    expect(deferred.queue.at(-1)).toEqual(missed);
    expect(currentExercise(deferred)!.pixelId).not.toBe(missed.pixelId);
    submit();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(saved().attempts.fish).toEqual(deferred);
    view.unmount();
    view = render(<App />);
    openFish();
    expect(saved().attempts.fish).toEqual(deferred);
    expect(screen.getByRole('textbox')).toHaveValue('');
    for (let index = 0; index < 2; index += 1) {
      enter(firstAnswer());
      submit();
      act(() => vi.advanceTimersByTime(650));
    }
    expect(currentExercise(saved().attempts.fish!)).toEqual(missed);
    expect(screen.getByTestId(`cell-${missed.pixelId}`)).toHaveAttribute(
      'data-filled',
      'false',
    );
    enter(firstAnswer());
    submit();
    expect(
      screen.getByRole('heading', { name: 'Look who you found!' }),
    ).toBeVisible();
    view.unmount();
  });
  it('inserts practice after missing the final pixel without revealing or completing it', () => {
    vi.useFakeTimers();
    const progress = emptyProgress('en');
    const attempt = createAttempt(puzzles[0]!, () => 0.2);
    attempt.solved = attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId);
    progress.attempts.fish = attempt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    render(<App />);
    openFish();
    const last = currentExercise(attempt)!;
    enter(last.equation.c === 1 ? '2' : '1');
    submit();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText('A LITTLE PRACTICE')).toBeVisible();
    expect(document.querySelector('.row-pill')).not.toBeInTheDocument();
    expect(document.querySelector('.active-row')).not.toBeInTheDocument();
    expect(saved().attempts.fish!.solved).toEqual(attempt.solved);
    const review = currentExercise(saved().attempts.fish!)!;
    enter(review.equation.c === 1 ? '2' : '1');
    submit();
    act(() => vi.advanceTimersByTime(900));
    expect(currentExercise(saved().attempts.fish!)!.pixelId).not.toBe(
      review.pixelId,
    );
    enter(firstAnswer());
    submit();
    expect(screen.getByText(messages.en.practiceCorrect)).toBeVisible();
    expect(document.querySelector('.new-pixel')).not.toBeInTheDocument();
    expect(saved().attempts.fish!.solved).toEqual(attempt.solved);
    expect(saved().completed).toEqual([]);
    act(() => vi.advanceTimersByTime(650));
    expect(currentExercise(saved().attempts.fish!)).toEqual(last);
    expect(document.querySelector('.row-pill')).toBeVisible();
    enter(firstAnswer());
    submit();
    expect(saved().completed).toEqual(['fish']);
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
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
