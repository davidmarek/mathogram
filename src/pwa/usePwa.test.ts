import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePwa } from './usePwa';

class Worker extends EventTarget {
  state = 'installing';
  postMessage = vi.fn();
  transition(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}
class Registration extends EventTarget {
  active: Worker | null = null;
  installing: Worker | null = new Worker();
  waiting: Worker | null = null;
  update = vi.fn().mockResolvedValue(undefined);
}
class Container extends EventTarget {
  controller: Worker | null = null;
  register = vi.fn();
}
let container: Container;
let registration: Registration;
beforeEach(() => {
  vi.stubEnv('PROD', true);
  container = new Container();
  registration = new Registration();
  container.register.mockResolvedValue(registration);
  vi.stubGlobal('navigator', { serviceWorker: container, onLine: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('shows ready only after successful caching and scopes registration', async () => {
  const { result } = renderHook(usePwa);
  expect(result.current.ready).toBe(false);
  await waitFor(() =>
    expect(container.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }),
  );
  act(() => registration.installing!.transition('installed'));
  expect(result.current.ready).toBe(true);
  expect(result.current.error).toBe(false);
});

it('does not mistake first activation for an update when active already points at the installing worker', async () => {
  const { result } = renderHook(usePwa);
  await act(async () => {});
  registration.active = registration.installing;
  act(() => registration.installing!.transition('installed'));
  expect(result.current.ready).toBe(true);
  expect(result.current.waiting).toBe(false);
});

it('detects another tab updating after this tab performed its first install', async () => {
  const { result } = renderHook(usePwa);
  await act(async () => {});
  container.controller = new Worker();
  act(() => container.dispatchEvent(new Event('controllerchange')));
  expect(result.current.waiting).toBe(false);
  container.controller = new Worker();
  act(() => container.dispatchEvent(new Event('controllerchange')));
  expect(result.current.waiting).toBe(true);
});
it('reports registration failures and retries without changing the game', async () => {
  container.register.mockRejectedValueOnce(new TypeError('network'));
  const { result } = renderHook(usePwa);
  await waitFor(() => expect(result.current.error).toBe(true));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe(false));
  expect(container.register).toHaveBeenCalledTimes(2);
});
it('reports failed precaching rather than offline readiness', async () => {
  const { result } = renderHook(usePwa);
  await act(async () => {});
  act(() => registration.installing!.transition('redundant'));
  expect(result.current.error).toBe(true);
  expect(result.current.ready).toBe(false);
});
it('requires explicit acceptance and reports activation timeouts', async () => {
  registration.active = new Worker();
  registration.waiting = new Worker();
  const { result } = renderHook(usePwa);
  await waitFor(() => expect(result.current.waiting).toBe(true));
  expect(result.current.ready).toBe(true);
  expect(registration.waiting.postMessage).not.toHaveBeenCalled();
  vi.useFakeTimers();
  act(() => {
    expect(result.current.acceptUpdate()).toBe(true);
  });
  expect(registration.waiting.postMessage).toHaveBeenCalledWith({
    type: 'SKIP_WAITING',
  });
  act(() => vi.advanceTimersByTime(15_000));
  expect(result.current.error).toBe(true);
});
it('surfaces a missing waiting worker or a failed update message', async () => {
  const { result } = renderHook(usePwa);
  await act(async () => {});
  act(() => {
    expect(result.current.acceptUpdate()).toBe(false);
  });
  registration.waiting = new Worker();
  registration.waiting.postMessage.mockImplementation(() => {
    throw new DOMException('Cannot message', 'InvalidStateError');
  });
  act(() => {
    expect(result.current.acceptUpdate()).toBe(false);
  });
  expect(result.current.error).toBe(true);
});
it('tracks connectivity and checks for updates on return to the app', async () => {
  const { result } = renderHook(usePwa);
  await act(async () => {});
  act(() => window.dispatchEvent(new Event('offline')));
  expect(result.current.offline).toBe(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(result.current.offline).toBe(false);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(registration.update).toHaveBeenCalledOnce();
  registration.update.mockRejectedValueOnce(new TypeError('offline'));
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(() => expect(result.current.error).toBe(true));
});
it('never reloads on another tab accepting an update without this tab agreeing', async () => {
  container.controller = new Worker();
  const reload = vi.fn();
  vi.stubGlobal('location', { reload });
  const { result } = renderHook(usePwa);
  await act(async () => {});
  act(() => container.dispatchEvent(new Event('controllerchange')));
  expect(reload).not.toHaveBeenCalled();
  expect(result.current.waiting).toBe(true);
  act(() => {
    result.current.acceptUpdate();
  });
  expect(reload).toHaveBeenCalledOnce();
});
it('reloads only after accepted worker takes control and cleans listeners on unmount', async () => {
  registration.active = new Worker();
  registration.waiting = new Worker();
  const reload = vi.fn();
  vi.stubGlobal('location', { reload });
  const { result, unmount } = renderHook(usePwa);
  await act(async () => {});
  act(() => {
    result.current.acceptUpdate();
  });
  act(() => container.dispatchEvent(new Event('controllerchange')));
  expect(reload).toHaveBeenCalledOnce();
  unmount();
  act(() => container.dispatchEvent(new Event('controllerchange')));
  expect(reload).toHaveBeenCalledOnce();
});
