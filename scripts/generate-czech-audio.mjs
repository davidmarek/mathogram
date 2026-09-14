import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { czechWords, wordAudioPath } from '../src/content/czechWords.ts';

const voice = 'cs-CZ-VlastaNeural';
const format = 'audio-24khz-48kbitrate-mono-mp3';
const publicDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
);

function looksLikeMp3(data) {
  return (
    data.length >= 256 &&
    data.length <= 1_000_000 &&
    (data.subarray(0, 3).toString() === 'ID3' ||
      (data[0] === 0xff && (data[1] & 0xe0) === 0xe0))
  );
}

async function existing(path) {
  try {
    return looksLikeMp3(await readFile(path));
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function escapeXml(text) {
  return text.replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character],
  );
}

export async function generateAudio(
  args = process.argv.slice(2),
  env = process.env,
) {
  if (args.some((arg) => arg !== '--check') || args.length > 1)
    throw new Error('Usage: npm run audio:generate OR npm run audio:check');
  const missing = [];
  for (const word of czechWords) {
    const path = join(publicDirectory, wordAudioPath(word.id));
    if (!(await existing(path))) missing.push({ ...word, path });
  }
  if (args.includes('--check')) {
    if (missing.length)
      throw new Error(
        `${missing.length}/${czechWords.length} recordings missing or invalid. Run npm run audio:generate with Azure Speech credentials before releasing Czech practice.`,
      );
    console.log(
      `All ${czechWords.length} Czech recordings have valid file headers. Listen to them before release.`,
    );
    return;
  }
  if (!missing.length) {
    console.log('All recordings already exist. No Azure requests made.');
    return;
  }
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9]+$/.test(region))
    throw new Error(
      'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in your local environment. Never use VITE_ variables for credentials.',
    );
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices`;
  const headers = { 'Ocp-Apim-Subscription-Key': key };
  const voicesResponse = await fetch(`${endpoint}/voices/list`, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!voicesResponse.ok)
    throw new Error(
      `Azure voice lookup failed (HTTP ${voicesResponse.status}).`,
    );
  const voices = await voicesResponse.json();
  if (
    !Array.isArray(voices) ||
    !voices.some((item) => item.ShortName === voice && item.Locale === 'cs-CZ')
  )
    throw new Error(`${voice} is not available in the configured region.`);
  console.log(
    `Generating ${missing.length} recordings with ${voice}; Azure character charges may apply.`,
  );
  for (const word of missing) {
    // Stay below the free-tier 20 requests/minute limit; reruns skip completed clips.
    await delay(3_100);
    const ssml = `<speak version="1.0" xml:lang="cs-CZ"><voice name="${voice}"><prosody rate="-10%">${escapeXml(word.text)}</prosody></voice></speak>`;
    const response = await fetch(`${endpoint}/v1`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        ...headers,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': format,
        'User-Agent': 'MathogramAudioGenerator',
      },
      body: ssml,
    });
    if (!response.ok)
      throw new Error(
        `Azure synthesis failed for ${word.id} (HTTP ${response.status}). Completed files are safe; retry later.`,
      );
    const audio = Buffer.from(await response.arrayBuffer());
    if (
      !response.headers.get('content-type')?.startsWith('audio/') ||
      !looksLikeMp3(audio)
    )
      throw new Error(
        `Azure returned invalid audio for ${word.id}; no recording was saved.`,
      );
    await mkdir(dirname(word.path), { recursive: true });
    await writeFile(`${word.path}.tmp`, audio);
    await rename(`${word.path}.tmp`, word.path);
    console.log(`Saved ${word.id}`);
  }
  console.log(
    'Done. Run npm run audio:check, review pronunciation, then commit the MP3 files.',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  generateAudio().catch((error) => {
    // Do not log response bodies or request objects, which may contain credentials.
    console.error(error.message);
    process.exitCode = 1;
  });
}
