import { vi } from 'vitest';

export const recordings: TestAudio[] = [];
export class TestAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  playbackRate = 1;
  pause = vi.fn();
  play = vi.fn(() => Promise.resolve());
  constructor(public src = '') {
    recordings.push(this);
  }
}

export function installAudioMock() {
  recordings.length = 0;
  vi.stubGlobal('Audio', TestAudio);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['recording'], { type: 'audio/mpeg' }),
    })),
  );
  const BaseUrl = URL;
  vi.stubGlobal(
    'URL',
    class extends BaseUrl {
      static createObjectURL = vi.fn(() => 'blob:test-recording');
      static revokeObjectURL = vi.fn();
    },
  );
}
