import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePuzzleTime } from './usePuzzleTime';

const analytics = vi.hoisted(() => ({
  enabled: true,
  allowed: true,
  trackPuzzleTime: vi.fn(),
}));
vi.mock('./analytics', () => ({
  get analyticsEnabled() {
    return analytics.enabled;
  },
  analyticsAllowed: () => analytics.allowed,
  trackPuzzleTime: analytics.trackPuzzleTime,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  analytics.enabled = analytics.allowed = true;
  analytics.trackPuzzleTime.mockClear();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}
function event(target: Window | Document, type: string) {
  act(() => target.dispatchEvent(new Event(type)));
}

it('reports non-overlapping seconds periodically and on exit, including StrictMode', () => {
  const view = renderHook(() => usePuzzleTime('fish'), {
    wrapper: StrictMode,
  });
  advance(30_000);
  event(document, 'keydown');
  advance(30_000);
  expect(analytics.trackPuzzleTime).toHaveBeenCalledExactlyOnceWith('fish', 60);
  advance(12_900);
  view.unmount();
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([
    ['fish', 60],
    ['fish', 12],
  ]);
  advance(120_000);
  expect(analytics.trackPuzzleTime).toHaveBeenCalledTimes(2);
});

it('caps inactivity at one minute and resumes only on interaction', () => {
  const view = renderHook(() => usePuzzleTime('fish'));
  advance(180_000);
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([['fish', 60]]);
  event(document, 'pointerdown');
  advance(5_000);
  view.unmount();
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([
    ['fish', 60],
    ['fish', 5],
  ]);
});

it('caps the trailing idle portion after recent activity', () => {
  const view = renderHook(() => usePuzzleTime('fish'));
  advance(50_000);
  event(document, 'keydown');
  advance(70_000);
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([
    ['fish', 60],
    ['fish', 50],
  ]);
  view.unmount();
  expect(analytics.trackPuzzleTime).toHaveBeenCalledTimes(2);
});

it('pauses in hidden pages and handles pagehide/visibility ordering without duplicates', () => {
  const view = renderHook(() => usePuzzleTime('fish'));
  advance(10_000);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  event(document, 'visibilitychange');
  event(window, 'pagehide');
  advance(90_000);
  event(document, 'pointerdown');
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([['fish', 10]]);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  event(window, 'pageshow');
  event(document, 'visibilitychange');
  advance(5_000);
  view.unmount();
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([
    ['fish', 10],
    ['fish', 5],
  ]);
});

it('discards unsent offline time and never backfills it on reconnect', () => {
  const view = renderHook(() => usePuzzleTime('fish'));
  advance(10_000);
  analytics.allowed = false;
  event(window, 'offline');
  advance(120_000);
  analytics.allowed = true;
  event(window, 'online');
  advance(4_000);
  view.unmount();
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([['fish', 4]]);
});

it('discards time when privacy signals block reporting', () => {
  const view = renderHook(() => usePuzzleTime('fish'));
  advance(10_000);
  analytics.allowed = false;
  view.unmount();
  expect(analytics.trackPuzzleTime).not.toHaveBeenCalled();
});

it('does not time disabled analytics, hidden pages, or non-playing screens', () => {
  analytics.enabled = false;
  const disabled = renderHook(() => usePuzzleTime('fish'));
  advance(90_000);
  disabled.unmount();
  analytics.enabled = true;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const hidden = renderHook(() => usePuzzleTime('fish'));
  advance(90_000);
  hidden.unmount();
  const gallery = renderHook(() => usePuzzleTime(null));
  advance(90_000);
  gallery.unmount();
  expect(analytics.trackPuzzleTime).not.toHaveBeenCalled();
});

it('flushes the old puzzle and excludes paused screens without mixing puzzle IDs', () => {
  const view = renderHook(({ id }) => usePuzzleTime(id), {
    initialProps: { id: 'fish' as string | null },
  });
  advance(8_000);
  view.rerender({ id: null });
  advance(120_000);
  view.rerender({ id: 'owl' });
  advance(3_000);
  view.unmount();
  expect(analytics.trackPuzzleTime.mock.calls).toEqual([
    ['fish', 8],
    ['owl', 3],
  ]);
});
