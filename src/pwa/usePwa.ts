import { useEffect, useRef, useState } from 'react';

export function usePwa() {
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [retry, setRetry] = useState(0);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const accepted = useRef(false);
  const changedController = useRef(false);
  const reloading = useRef(false);
  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const serviceWorker = navigator.serviceWorker;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let previousController = serviceWorker.controller;
    let replacingActiveWorker = false;
    const fail = () => {
      if (!disposed) setError(true);
    };
    const checkInstall = () => {
      if (disposed || !installing) return;
      if (installing.state === 'redundant') fail();
      if (installing.state === 'installed') {
        setError(false);
        if (replacingActiveWorker) setWaiting(true);
        else setReady(true);
      }
    };
    const watchInstall = () => {
      installing?.removeEventListener('statechange', checkInstall);
      installing = registration?.installing ?? null;
      replacingActiveWorker =
        !!registration?.active && registration.active !== installing;
      installing?.addEventListener('statechange', checkInstall);
      checkInstall();
    };
    const onControllerChange = () => {
      if (disposed) return;
      const hadController = previousController !== null;
      previousController = serviceWorker.controller;
      if (accepted.current && !reloading.current) {
        reloading.current = true;
        if (updateTimeout.current) clearTimeout(updateTimeout.current);
        window.location.reload();
      } else if (hadController) {
        // Another tab may accept an update. Never interrupt this tab's game.
        changedController.current = true;
        setWaiting(true);
      }
    };
    serviceWorker.addEventListener('controllerchange', onControllerChange);
    void serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        registrationRef.current = reg;
        setError(false);
        if (reg.active) setReady(true);
        if (reg.waiting && reg.active) setWaiting(true);
        reg.addEventListener('updatefound', watchInstall);
        watchInstall();
      })
      .catch(fail);
    const checkUpdate = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        registration
      ) {
        void registration.update().catch(fail);
      }
    };
    document.addEventListener('visibilitychange', checkUpdate);
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', watchInstall);
      installing?.removeEventListener('statechange', checkInstall);
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkUpdate);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
    };
  }, [retry]);

  useEffect(() => {
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  function acceptUpdate(): boolean {
    const worker = registrationRef.current?.waiting;
    if (changedController.current) {
      window.location.reload();
      return true;
    }
    if (!worker) {
      setError(true);
      return false;
    }
    accepted.current = true;
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      accepted.current = false;
      if (!(error instanceof DOMException)) throw error;
      setError(true);
      return false;
    }
    if (updateTimeout.current) clearTimeout(updateTimeout.current);
    updateTimeout.current = setTimeout(() => {
      accepted.current = false;
      setError(true);
    }, 15_000);
    return true;
  }
  return {
    ready,
    waiting,
    error,
    offline,
    acceptUpdate,
    retry: () => setRetry((value) => value + 1),
  };
}
