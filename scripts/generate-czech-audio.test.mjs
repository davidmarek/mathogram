import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { czechWords } from '../src/content/czechWords.ts';
import { generateAudio } from './generate-czech-audio.mjs';

const fs = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
}));
const delay = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ ...fs, default: fs }));
vi.mock('node:timers/promises', () => ({
  setTimeout: delay,
  default: { setTimeout: delay },
}));
const env = {
  AZURE_SPEECH_KEY: 'test-only-not-a-real-key',
  AZURE_SPEECH_REGION: 'westeurope',
};
const mp3 = Buffer.alloc(300);
mp3.write('ID3');
const voices = [{ ShortName: 'cs-CZ-VlastaNeural', Locale: 'cs-CZ' }];
const audioResponse = () => ({
  ok: true,
  headers: new Headers({ 'content-type': 'audio/mpeg' }),
  arrayBuffer: async () => mp3,
});

beforeEach(() => {
  vi.clearAllMocks();
  fs.readFile
    .mockReset()
    .mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(audioResponse()));
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('checks every file offline and fails clearly for missing or invalid clips', async () => {
  await expect(generateAudio(['--check'], {})).rejects.toThrow(
    '105/105 recordings missing',
  );
  expect(fetch).not.toHaveBeenCalled();
  fs.readFile.mockResolvedValue(Buffer.from('<html>not audio</html>'));
  await expect(generateAudio(['--check'], {})).rejects.toThrow('105/105');
  fs.readFile.mockResolvedValue(mp3);
  await expect(generateAudio(['--check'], {})).resolves.toBeUndefined();
  expect(fs.writeFile).not.toHaveBeenCalled();
});

it('makes no Azure requests without credentials, with an invalid region, or for a complete catalog', async () => {
  await expect(generateAudio([], {})).rejects.toThrow('Set AZURE_SPEECH_KEY');
  await expect(
    generateAudio([], { ...env, AZURE_SPEECH_REGION: 'evil.example/path' }),
  ).rejects.toThrow('Set AZURE_SPEECH_KEY');
  await expect(generateAudio(['--unknown'], env)).rejects.toThrow('Usage');
  fs.readFile.mockResolvedValue(mp3);
  await generateAudio([], env);
  expect(fetch).not.toHaveBeenCalled();
});

it('generates the entire catalog with Czech SSML, throttling, and atomic file replacement', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => voices });
  await generateAudio([], env);
  expect(fetch).toHaveBeenCalledTimes(czechWords.length + 1);
  expect(fetch.mock.calls[0][0]).toBe(
    'https://westeurope.tts.speech.microsoft.com/cognitiveservices/voices/list',
  );
  for (const [index, word] of czechWords.entries()) {
    const [url, request] = fetch.mock.calls[index + 1];
    expect(url).toBe(
      'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1',
    );
    expect(request.method).toBe('POST');
    expect(request.redirect).toBe('error');
    expect(request.headers['X-Microsoft-OutputFormat']).toBe(
      'audio-24khz-48kbitrate-mono-mp3',
    );
    expect(request.body).toContain(`rate="-10%">${word.text}</prosody>`);
    expect(request.body).toContain('xml:lang="cs-CZ"');
    expect(request.body).toContain('cs-CZ-VlastaNeural');
    expect(fs.writeFile.mock.calls[index][0]).toMatch(
      new RegExp(`${word.id}\\.mp3\\.tmp$`),
    );
    expect(fs.writeFile.mock.calls[index][1]).toEqual(mp3);
    const [temporary, destination] = fs.rename.mock.calls[index];
    expect(temporary).toBe(`${destination}.tmp`);
  }
  expect(delay).toHaveBeenCalledTimes(105);
  expect(delay).toHaveBeenCalledWith(3100);
});

it('preserves completed clips when resuming an interrupted batch', async () => {
  fs.readFile
    .mockResolvedValue(mp3)
    .mockRejectedValueOnce(
      Object.assign(new Error('Missing'), { code: 'ENOENT' }),
    );
  fetch.mockResolvedValueOnce({ ok: true, json: async () => voices });
  await generateAudio([], env);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fs.writeFile).toHaveBeenCalledTimes(1);
});

it('rejects unavailable voices, authorization errors, synthesis errors and invalid responses without saving', async () => {
  for (const response of [
    { ok: false, status: 401 },
    { ok: true, json: async () => [] },
  ]) {
    fetch.mockResolvedValueOnce(response);
    await expect(generateAudio([], env)).rejects.toThrow();
  }
  for (const response of [
    { ok: false, status: 429 },
    {
      ...audioResponse(),
      headers: new Headers({ 'content-type': 'text/html' }),
    },
    { ...audioResponse(), arrayBuffer: async () => Buffer.from('truncated') },
  ]) {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => voices })
      .mockResolvedValueOnce(response);
    await expect(generateAudio([], env)).rejects.toThrow();
  }
  expect(fs.writeFile).not.toHaveBeenCalled();
  expect(fs.rename).not.toHaveBeenCalled();
});

it('surfaces unexpected filesystem errors', async () => {
  fs.readFile.mockRejectedValue(new Error('Disk error'));
  await expect(generateAudio(['--check'], {})).rejects.toThrow('Disk error');
});
