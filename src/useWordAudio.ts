import { useEffect, useRef, useState } from 'react';
import { wordAudioPath } from './content/czechWords';

export function useWordAudio(wordId: string, suspended: boolean) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'playing' | 'heard' | 'error'
  >('idle');
  const [heard, setHeard] = useState(false);
  const playback = useRef<{
    audio: HTMLAudioElement;
    timeout: ReturnType<typeof setTimeout>;
    controller: AbortController;
  } | null>(null);
  const recordingUrl = useRef<string | null>(null);

  function stop() {
    const current = playback.current;
    playback.current = null;
    if (!current) return;
    clearTimeout(current.timeout);
    current.controller.abort();
    current.audio.onended = null;
    current.audio.onerror = null;
    current.audio.onplaying = null;
    current.audio.pause();
  }

  useEffect(
    () => () => {
      stop();
      if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    },
    [],
  );
  useEffect(() => {
    function pause() {
      if (!playback.current) return;
      stop();
      setStatus('idle');
    }
    if (suspended) pause();
    function visibility() {
      if (document.visibilityState === 'hidden') pause();
    }
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [suspended]);

  function listen(slow = false) {
    if (suspended) return;
    stop();
    setStatus('loading');
    const audio = new Audio();
    audio.playbackRate = slow ? 0.8 : 1;
    function fail() {
      if (playback.current?.audio !== audio) return;
      stop();
      setStatus('error');
    }
    const controller = new AbortController();
    playback.current = { audio, timeout: setTimeout(fail, 15_000), controller };
    audio.onplaying = () => {
      if (playback.current?.audio === audio) setStatus('playing');
    };
    audio.onerror = fail;
    audio.onended = () => {
      if (playback.current?.audio !== audio) return;
      stop();
      setHeard(true);
      setStatus('heard');
    };
    async function start() {
      if (!recordingUrl.current) {
        // Full-file blobs avoid media range requests against the offline precache.
        const response = await fetch(
          `${import.meta.env.BASE_URL}${wordAudioPath(wordId)}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          fail();
          return;
        }
        const blob = await response.blob();
        if (playback.current?.audio !== audio) return;
        if (!blob.size || !blob.type.startsWith('audio/')) {
          fail();
          return;
        }
        recordingUrl.current = URL.createObjectURL(blob);
      }
      if (playback.current?.audio !== audio) return;
      audio.src = recordingUrl.current;
      await audio.play();
    }
    void start().catch(fail);
  }

  return { status, heard, listen };
}
