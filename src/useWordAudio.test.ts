import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installAudioMock, recordings, TestAudio } from './test/audio';
import { useWordAudio } from './useWordAudio';

beforeEach(() => {
  installAudioMock();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('requires a full listen and supports a slower, non-overlapping replay', async () => {
  const hook = renderHook(() => useWordAudio('cs-001', false));
  expect(recordings).toHaveLength(0);
  await act(async () => hook.result.current.listen());
  const first = recordings[0]!;
  expect(first.src).toBe('blob:test-recording');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/audio\/cs\/v2\/cs-001.mp3$/),
    expect.anything(),
  );
  expect(hook.result.current.heard).toBe(false);
  act(() => first.onplaying?.());
  expect(hook.result.current.status).toBe('playing');
  act(() => first.onended?.());
  expect(hook.result.current.heard).toBe(true);
  act(() => hook.result.current.listen(true));
  const slow = recordings[1]!;
  expect(slow.playbackRate).toBe(0.8);
  act(() => hook.result.current.listen());
  expect(slow.pause).toHaveBeenCalled();
  expect(slow.onended).toBeNull();
  hook.unmount();
  expect(recordings[2]!.pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-recording');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('reports missing audio, play rejections and timeouts, and allows retries', async () => {
  vi.useFakeTimers();
  const hook = renderHook(() => useWordAudio('cs-001', false));
  act(() => hook.result.current.listen());
  act(() => recordings[0]!.onerror?.());
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.heard).toBe(false);
  act(() => hook.result.current.listen());
  act(() => vi.advanceTimersByTime(15_000));
  expect(hook.result.current.status).toBe('error');
  const play = vi
    .fn()
    .mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
  vi.stubGlobal(
    'Audio',
    class extends TestAudio {
      play = play;
    },
  );
  await act(async () => hook.result.current.listen());
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.heard).toBe(false);
});

it('cancels playback for dialogs, hidden pages and unmount; stale completions cannot count', () => {
  const hook = renderHook(
    ({ suspended }) => useWordAudio('cs-001', suspended),
    { initialProps: { suspended: false } },
  );
  act(() => hook.result.current.listen());
  const ended = recordings[0]!.onended!;
  hook.rerender({ suspended: true });
  expect(recordings[0]!.pause).toHaveBeenCalled();
  act(() => {
    ended();
    hook.result.current.listen();
  });
  expect(recordings).toHaveLength(1);
  expect(hook.result.current.heard).toBe(false);
  hook.rerender({ suspended: false });
  act(() => hook.result.current.listen());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(recordings[1]!.pause).toHaveBeenCalled();
  expect(hook.result.current.status).toBe('idle');
});

it('reports failed fetches and non-audio bodies without attempting playback', async () => {
  const hook = renderHook(() => useWordAudio('cs-001', false));
  for (const response of [
    { ok: false },
    { ok: true, blob: async () => new Blob(['html'], { type: 'text/html' }) },
    { ok: true, blob: async () => new Blob([], { type: 'audio/mpeg' }) },
  ]) {
    vi.mocked(fetch).mockResolvedValueOnce(response as Response);
    await act(async () => hook.result.current.listen());
    expect(hook.result.current.status).toBe('error');
    expect(recordings.at(-1)!.play).not.toHaveBeenCalled();
  }
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
  await act(async () => hook.result.current.listen());
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.heard).toBe(false);
});

it('ignores a download that finishes after leaving the word', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const hook = renderHook(() => useWordAudio('cs-001', false));
  act(() => hook.result.current.listen());
  const options = vi.mocked(fetch).mock.calls[0]![1];
  hook.unmount();
  expect(options?.signal?.aborted).toBe(true);
  await act(async () =>
    finish({
      ok: true,
      blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
    } as Response),
  );
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(recordings[0]!.play).not.toHaveBeenCalled();
});
